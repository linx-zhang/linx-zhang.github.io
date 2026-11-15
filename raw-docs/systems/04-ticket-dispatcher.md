---
order: 5
---

# 客服调度引擎：可配置规则 + Redis 排队 + 五种分配策略

对应归档里的 `webot3/monarch/dispatcher/`、`monarch/corelibs/rule/`、`doc/process/celery优先级设计.md`。

## 一、调度到底要解决什么

一个在线客服平台，核心矛盾永远是这一句话：

> 有访客来了，该分给谁；没有可分的，人往哪儿放。

拆开看是四个问题：

1. **规则**：这家的分配规则是「指定客服张三」还是「转给售后组」？（可配置，每家不同）
2. **排队**：所有人都在忙时，访客进哪个队、排第几、怎么通知？
3. **触发**：什么时候重新尝试分配？（访客来了 / 客服上线了 / 客服结束会话了 / 排队超时了）
4. **策略**：给到组之后，组里五个人选谁？（最少负荷 / 轮流 / 随机 / 历史会话数 / 接待时长）

这份代码的答案分别是：**规则引擎**、**Redis ZSET**、**双向触发 + 定时自检**、**策略函数**。

## 二、规则引擎：把「if-else」变成可配置的 JSON

### 2.1 三件套

`corelibs/rule/` 是一个仿 jsonrules 的实现，只有 5 个文件，但把「变量 + 条件 + 动作」抽得很干净：

| 文件 | 职责 |
| --- | --- |
| `variables.py` | 定义「可用的变量」及类型（数值/字符串/布尔/单选/多选），供前端渲染下拉框 |
| `operators.py` | 定义每种类型支持的操作符（如 `contains`、`greaterThan`、`equalTo`） |
| `actions.py` | 定义「可执行的动作」，带参数与校验 |
| `utils.py` | `export_rule_data` 导出元数据；`check_conditions_recursively` 递归判断条件 |
| `engine.py` | `run_all_triggers` / `run` / `do_actions` |

变量与动作都靠装饰器注册：

```python
class RegularAssignmentVariables(BaseVariables):
    @select_rule_variable(label="ActionType")
    def action_type(self):
        return [ActionType.TO_KF, ActionType.TO_KF_GROUP]

    @select_rule_variable(label="Overflow")
    def overflow(self):
        return [True, False]

class RegularAssignmentActions(BaseActions):
    def __init__(self, reception, chat_user_id, company_id, rule, action_type,
                 distribution_way, exclude_user_ids=None, last_reception_user_id=None):
        ...

    @rule_action()
    def do_assign_user(self):
        """分配客服动作 溢出"""
        if self.action_type == ActionType.TO_KF:
            if self.rule in self.exclude_user_ids:
                return False, DispatcherWorkerEventType.ASSIGN_USER_NO_EXIST, None
            user = User.get_by_id(self.rule)
            if not user or not user.is_online or not user.is_services_available:
                return False, DispatcherWorkerEventType.ASSIGN_USER_NO_ONLINE, None
            if user.reception_num >= self.reception.get("user_max_serve_num", DEFAULT_USER_MAX_SERVE_NUM):
                return False, DispatcherWorkerEventType.ASSIGN_USER_FULL_LOAD, None
            return True, DispatcherWorkerEventType.ASSIGN_USER_SUCCESS, user.id
        else:
            return assign_user_by_group_policy(...)
```

`get_all_variables()` / `get_all_actions()` 通过 `inspect.getmembers` 扫描类属性上是否有 `is_rule_variable` / `is_rule_action` 标记，**自动生成给前端用的配置元数据**。这意味着「加一个新变量」只需要写一个方法加一个装饰器，前端配置页不用改代码。这是规则引擎最有价值的特性。

### 2.2 条件求值：all / any 递归

```python
def check_conditions_recursively(conditions, defined_variables):
    keys = list(conditions.keys())
    if keys == ["all"]:
        assert len(conditions["all"]) >= 1
        for condition in conditions["all"]:
            if not check_conditions_recursively(condition, defined_variables):
                return False
        return True
    elif keys == ["any"]:
        for condition in conditions["any"]:
            if check_conditions_recursively(condition, defined_variables):
                return True
        return False
    else:
        assert not ("any" in keys or "all" in keys)   # 防误写
        return check_condition(conditions, defined_variables)
```

`assert not ("any" in keys or "all" in keys)` 这一行很关键：它禁止了 `{"name": ..., "all": [...]}` 这种混写，把「组合节点」和「叶子节点」严格区分。**规则 JSON 是用户可编辑的，越严格的 schema 越少线上事故。**

### 2.3 调度用的是「精简版引擎」

`dispatcher/engine.py` 没有直接用 `corelibs.rule.engine`，而是自己写了一个更严格的版本：

```python
def run_all_dispatchers(rule_list, defined_variables, defined_actions):
    rule_list_validated = check_rule_list(rule_list)   # 有且只有一条规则
    if not rule_list_validated:
        return False, DispatcherWorkerEventType.INVALID_ASSIGNMENT_ACTION, None
    rule = rule_list[0]
    conditions, actions = rule["conditions"], rule["actions"]
    rule_triggered = check_conditions_recursively(conditions, defined_variables)
    action_validated = check_actions(actions)          # 有且只有一个动作
    if rule_triggered and action_validated:
        return do_actions(actions, defined_actions)
    return False, DispatcherWorkerEventType.INVALID_ASSIGNMENT_ACTION, None
```

**为什么要限制成 1 条规则 + 1 个动作？** 因为调度动作有副作用（改会话归属），多个动作的原子性、顺序、幂等性极难保证。限制成「一个条件组 → 一个动作」，等价于把调度变成一个**可判定、可重放**的纯函数式决策。这是很成熟的做法：**规则引擎的能力边界，应该由动作的后果决定，而不是技术可能性。**

## 三、「规则链」与溢出：配置里的 fallback

一条分配规则（`Assignment.execute_action`）实际是一个**动作列表**，每项带 `overflow` 标记：

```python
def do_regular_assign_user(self, execute_action):
    for action in execute_action:
        rule, overflow, action_type = action["rule"], action["overflow"], action["action_type"]
        rule_list = [{
            "conditions": {"all": [
                {"name": "action_type", "operator": "contains", "value": action_type},
                {"name": "overflow", "operator": "contains", "value": overflow},
            ]},
            "actions": [{"name": "do_check_user"}]
        }]
        is_success, _, _ = run_all_dispatchers(rule_list, RegularAssignmentVariables(),
                                               RegularAssignmentActions(self.company_id, self.user_id, rule, action_type))
        if is_success:
            return True
        else:
            if overflow:      # 允许溢出，继续下一条规则
                continue
    return False
```

语义是：**按顺序尝试每个动作，失败就往下走；某条动作不允许溢出（`overflow=False`）则链条终止。**

由此衍生出一个安全阀——**排除集合累积**：`exclude_user_ids` 会把「已经试过但满负荷/不在线」的客服记进去，避免在同一次分配里反复试同一个人。这是保证「链条有限」的关键。

## 四、排队：一个 ZSET 就是一条队

`join_queue.py` 开头的注释把数据结构写得很清楚：

```
R2CU(Rule-TO-ChatUser) 分配规则ID 对应的用户ID
CU2R(ChatUser-To-Rule) 用户ID 对应的分配规则ID
Q(ChatUserQueue)       Sorted-Set 用户排队队列
```

实际实现只用了第三项，key 为 `chat_user_queue:{assignment_id}`，**score 是入队时间戳**：

```python
current_timestamp = datetime_to_timestamp(datetime.now())
mc.zadd(self.cuq_key, {self.chat_user_id: current_timestamp}, ch=True)
index  = mc.zrank(self.cuq_key, self.chat_user_id)
position = index + 1                     # 排第几，从 1 开始
```

只用一个 ZSET 就同时得到了：**队列长度**（`ZCARD`）、**位置**（`ZRANK`）、**先进先出**（按 score 排序）、**超时筛选**（`ZRANGEBYSCORE`）。这是 Redis 做队列最经济的方案。

入队前还有容量限制与状态转换：

```python
def is_join_queue_channel(self):
    if self.cuq_length() >= self.max_queue_length:
        return False          # 队满，直接告知"坐席全忙"
    return self.join_queue_channel()
```

以及**会话段切换**——排队不是把访客挂起来，而是新建一个「排队段」（第 8 篇会展开）：

```python
if self.chat_service.last_session is None:
    self.chat_service = self.chat_service.create_session(CreateType.TO_QUEUE, user_id=None, _commit=True)
else:
    self.chat_service.transfer_robot_or_blank_2q_for_chat_user()
```

### 4.1 出队为什么要加锁

出队是「读队列 → 取第一个 → 删除 → 逐个通知后面的人」四步复合操作。客服 A、B 同时上线，两边都读到「张三排第一」，就会把同一个访客分给两个人——**重复分配**是调度系统最致命的 bug。

解法是分布式锁，粒度到「每条队列一把锁」：

```python
def _chat_user_queue_lock(error="处理超时"):
    def _(func):
        @wraps(func)
        def __(self, *args, **kw):
            _lock = CACHE_CHAT_USER_QUEUE_LOCK.format(assignment_id=self.assignment_id)
            try:
                with RedisLock(pc, _lock, timeout=3, blocking=True) as lock:
                    if not lock.is_acquired():
                        raise TimeoutError(error)
                    return func(self, *args, **kw)
            except LockNotOwnedError:
                logger.error("%s 运行超时，导致解锁失败!!!", func.__name__)
        return __
    return _
```

三个参数的选择都很讲究：

- **`timeout=3`**：锁持有上限 3 秒。出队是纯 Redis 操作，3 秒还没做完说明卡住了，宁可让锁自动过期也不能死锁。
- **`blocking=True`**：等锁而不是直接失败，因为出队请求通常会重试。
- **`LockNotOwnedError` 单独捕获**：业务执行超过 3 秒时锁已自动释放，此时 `release()` 会抛这个异常——**捕获它、只记日志、不改变业务结果**，是正确的处理方式（业务已经做完了，锁丢了也无所谓）。

### 4.2 出队后要「重新播报位置」

```python
def pick_first_one_leave_queue(self, company_id):
    broadcast_users = mc.zrange(self.cuq_key, 0, -1)
    first_chat_user_id = broadcast_users.pop(0)
    mc.zrem(self.cuq_key, first_chat_user_id)
    for position, chat_user_id in enumerate(broadcast_users, start=1):
        notice_for_chat_queue_position(company_id=company_id, chat_user_id=chat_user_id.decode(), position=position)
    return first_chat_user_id.decode()
```

离开一个人，后面所有人的位置都变了。**排队体验的关键就是这行「位置广播」**——不通知的话，前端显示的「您前面还有 3 人」会一直停在旧值，用户会以为系统挂了。

代价是 O(n) 次消息推送。队列长度小（通常几十）时没问题；上千人的队列要改成「只播报前面 N 位 + 定时刷新」。

## 五、五种分配策略：同一个接口，五种排序

组内选人集中在 `policy.py`，`AssignGroupPolicy.assign_user` 先做一轮过滤，再按 `distribution_way` 分支：

```python
online_available_users = [u for u in users if u.is_online if u.is_services_available]
# 历史优先：上次接待过这个访客的客服，优先
if last_reception_user:
    if deliver or last_reception_user.reception_num < max_reception_num:
        return True, ASSIGN_USER_SUCCESS, last_reception_user.id
```

然后五种策略本质都是「先排序，再取第一个未满负荷的」：

| 策略 | 排序键 | 适合场景 |
| --- | --- | --- |
| `IDLE`（最少负荷） | `reception_num` | 最常用，追求均摊 |
| `POLLING`（轮流） | `(reception_num, created_at)` | 老员工优先接、新人兜底 |
| `SESSIONS`（历史会话数） | `(reception_num, yesterday_sessions)` | 昨天接待少的人今天多接 |
| `DURATION`（最短接待时长） | `(reception_num, reception_duration)` | 避免某人被一个超长会话长期占住 |
| 默认 / `RANDOM` | `random.shuffle` | 无偏，最简单 |

三处设计值得记录：

1. **所有策略都以 `reception_num` 为第一排序键**，业务策略只做第二排序键。这样「不超负荷」这个硬约束优先于「公平」这个软目标，逻辑上不会错。
2. **`deliver=True` 单独一条快捷路径**，跳过「是否满负荷」检查。用于「客服主动转交给某人」——人力决策优先于负载均衡。
3. **`group_ids` 里出现 `0` 视为「全部客服组」**：

```python
if group_ids and 0 in group_ids:
    group_ids = None
```

这是配置层的约定（0 = 不限），但**它把「空」和「全部」混在了一个值里**，属于容易踩的隐式约定。建议改成显式的 `scope: all`。

### 5.1 已知缺陷：三条策略缺 return

`assign_by_polling` / `assign_by_sessions` / `assign_by_minimum_duration` 在**非 `deliver` 分支、且所有客服都满负荷**时，函数末尾没有 `return`：

```python
def assign_by_polling(self, online_available_users, deliver=False):
    sorted_users = sorted(online_available_users, key=lambda u: (u.reception_num, u.created_at))
    if deliver:
        return True, ASSIGN_USER_SUCCESS, sorted_users[0].id
    for user in sorted_users:
        if user.reception_num < max_reception_num:
            return True, ASSIGN_USER_SUCCESS, user.id
    # 走到这里返回 None
```

调用方 `assign_user` 会做三元解包：

```python
is_success, dispatch_type, user_id = self.assign_by_polling(reception_users, deliver)
```

对 `None` 解包会抛 `TypeError: cannot unpack non-iterable NoneType object`。而 `assign_by_load` / `assign_by_random` 都老老实实 `return False, ASSIGN_USER_FULL_LOAD, None`。

**结论**：当「组内所有人都满负荷」且策略为轮流/历史会话/最短时长时，这条路径会抛异常。这类**只在极端分支出现的缺 return**，单测不覆盖就很难发现，且异常发生在 Celery worker 里，前端只会看到「分配失败」。修复只需三行。

## 六、双向触发：谁在推动「分配」

这是全文最容易被忽视、但对正确性影响最大的部分。分配不是单向的，而是**两个方向各自发力**：

### 方向一：访客来了 → 找客服

`dispatcher/chat_user/worker.py`（20 KB，最核心的文件）负责：先按规则找可用客服，找不到就进队（`join_queue`）。

### 方向二：客服空了 → 找访客

客服上线 / 结束会话时触发：

```python
def trigger_allocate_user_to_chat(self):
    user = User.get(self.user_id)
    if not user or not user.is_services_available:
        return False
    if user.reception_num >= self.reception.get("user_max_serve_num", DEFAULT_USER_MAX_SERVE_NUM):
        return False

    for assignment in Assignment.gets_valid_by_company_id(self.company_id):
        leave_queue = LeaveRedisQueue(assignment_id=assignment.id)
        if leave_queue.is_exist_queue():
            is_success = self.do_regular_assign_user(assignment.execute_action)
            if is_success:
                chat_user_id = leave_queue.pick_first_one_leave_queue(company_id=self.company_id)
                chat = Chat(self.company_id, chat_user_id)
                chat.transfer_q2h_for_dispatch(user_id=self.user_id)   # 排队段 → 人工段
                return True

    # 所有常规规则都没命中，兜底：其他规则里有排队就直接取一个
    other_assignment = Assignment.get_valid_other_by_company_id(self.company_id)
    ...
```

**为什么要双向？** 只做「访客来了找客服」，那所有客服都在忙的时候访客只能进队，等客服空了却没人来捞他——除非再轮询。双向触发把「捞人」变成事件驱动的即时动作，延迟从「下一轮询周期」降到毫秒级。

`transfer_q2h_for_dispatch` 这个命名也说明了状态迁移：`q → h`（queue → human），与第 8 篇的会话段模型对应。

### 方向三：兜底的自检

即便如此，仍有漏网之鱼：消息推送失败、Celery 任务丢失、客服异常掉线。所以还有第三条腿——**定时自检**，`config.py` 里一长串 beat 任务：

```python
"auto_offline_kefu":  {"task": "monarch.tasks.user.auto_offline_kefu",              "schedule": 30 秒},
"auto_offline_chat_user": {"task": "monarch.tasks.chat_user.auto_offline_chat_user", "schedule": 30 秒},
"company_chat_auto_check": {"task": "monarch.dispatcher.tasks.auto_check.company_chat_auto_check", "schedule": 60 秒},
```

以及 `offline_user_to_transfer_or_close` / `force_offline_user_to_transfer_or_close` 两个任务：

- **普通下线**：把该客服正在接待的会话转给随机一个在线客服，没人就关会话；
- **强制下线**：同上，但如果**没有在线客服**，还要把「正在排队的访客」批量关掉（`batch_close_for_queue_not_user`），避免访客无限等待。

**「客服全下线时，队列里的人怎么办」是这类系统必答题**，代码里的答案是：关掉并告知，而不是让他们一直排着。

## 七、可复用的结论

1. **规则引擎的价值在元数据导出**，不在求值。前端能用 `export_rule_data` 自动渲染配置页，才叫可配置。
2. **动作有副作用时，把规则限制成 1 条件 + 1 动作**，换取可判定性。
3. **规则链 + `overflow` 标记 + 排除集合** 是实现 fallback 的最小完备方案。
4. **一个 ZSET 就能承担队列**：长度、位置、FIFO、超时筛选全都有。
5. **出队必须加锁，粒度按队列分**，锁超时要小于业务 SLA，且要单独处理 `LockNotOwnedError`。
6. **出队后必须广播位置变更**，这是排队体验的命门。
7. **分配策略统一「先排序再取」**，硬约束（负荷）永远做第一排序键。
8. **必须双向触发 + 定时自检**，只做单向一定会漏。

---
