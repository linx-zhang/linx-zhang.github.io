
# 会话域模型：服务 — 会话段 — 消息，三层结构与状态流转

对应归档里的 `webot3/monarch/models/chat.py`（1500 余行，是整个系统的领域核心）、`monarch/utils/chat.py`、`doc/会话系统.md`。

## 一、为什么不能只有一张 `chat_log`

最初的直觉设计是「一张消息表 + 一个会话 ID」，但这套系统很快就撞上三个问题：

1. **一次咨询里会有多个阶段**：先由机器人接待，访客说「转人工」，进入排队，再被分配给某个客服。这些阶段的**归属人不同、计时基准不同、统计口径不同**。
2. **「会话」这个词有歧义**：客服说的「我今天的会话数」指的是接到手的咨询次数；运营说的「会话时长」指的是从进线到结束的总时长（含排队）；质检要看的则是「人工段」里客服的回复质量。
3. **排队必须能被独立计数**：排队有超时、有位置、有转出，它既是流程的一环，又是一个独立可统计的对象。

于是模型被拆成三层：

```
ChatService（一次完整的接待服务）
   ├─ ChatSession × N（会话段：机器人段 / 排队段 / 人工段 / 空白段 / 营销段）
   │      └─ ChatLog × N（消息）
```

`doc/会话系统.md` 对这个结构有一句非常准确的概括：

> 一次会话服务可以包含多个会话段，每个会话段可以包含多条会话消息，会话消息按照时间顺序排列。

## 二、三张表的职责边界

### 2.1 `ChatService`：一次接待的全生命周期

```python
class ChatService(Base, TimestampMixin):
    __tablename__ = "chat_service"

    chat_user_id   = Column(String(32))                    # 访客
    company_id     = Column(Integer)
    create_way     = Column(Integer, default=0)            # 服务创建方式
    stop_way       = Column(Integer, default=0)            # 服务结束方式
    stop_time      = Column(DateTime)
    status         = Column(Integer, default=0)            # 1 会话中 2 排队中 3 已结束
    source         = Column(String(32))                    # 来源类型
    entry_id       = Column(String(32))                    # 渠道ID
    entry_extra    = Column(JSON, default={})              # 渠道对接数据
    satisfaction   = Column(Integer, default=0)            # 满意度 1-5
    satisfaction_describe = Column(String(500))
    last_session_id = Column(Integer)
    is_evaluation  = Column(Integer, default=0)            # 是否邀请评价
    is_human_asked = Column(Boolean, default=False)        # 访客是否在人工会话里说过话
```

它承担三类信息：

| 类别 | 字段 | 用途 |
| --- | --- | --- |
| 来源追踪 | `source` / `entry_id` / `entry_extra` / `ip` / `address` | 归因、渠道分析、风控 |
| 过程指标 | `status` / `create_way` / `stop_way` / `stop_time` | 流程统计、超时分析 |
| 结果指标 | `satisfaction` / `is_solved` / `consulation_type_id` | 满意度、解决率、咨询分类 |

**这里有一处作者自己标注的技术债**：

```python
# TODO: 该状态可在last_session中获取，此字段可删除
status = Column(Integer, nullable=False, default=0, comment="服务状态 1 会话中 2 排队中 3 已结束")
```

`status` 和 `last_session_id` 指向的会话段状态是**冗余**的：`last_session.type == QUEUE` 就意味着「排队中」，`last_session.stop_time` 非空就意味着这一段结束了。冗余字段的好处是**查询快、不用 join**，坏处是**两个真相来源必然漂移**。

这类冗余字段的正确管理方式是二选一：

- **要么承认冗余、把它升级成「物化状态」**：规定所有写路径必须同时更新（封装在 `Chat.transfer_*` 之类的统一入口里），并加定时任务做一致性校验；
- **要么删掉它，用 `last_session` 推导**：查询慢一点，但永不出错。

作者选了前者（保留字段 + 写 TODO），实际工程中很常见——但**必须补一条校验任务**，否则「会话中/排队中」迟早和真实状态对不上。

### 2.2 `ChatSession`：一段有明确归属的过程

```python
type          = Column(Integer(), comment="会话类型 1 机器人 2 排队 3 人工")
user_id       = Column(String(32), comment="客服ID")     # 机器人段/排队段为 0
chat_user_id  = Column(String(32), comment="用户ID")
company_id    = Column(Integer)
service_id    = Column(Integer, comment="服务ID")        # 反向指向 ChatService
create_way    = Column(Integer, comment="创建会话方式")
stop_way      = Column(Integer, comment="停止会话方式")
stop_time     = Column(DateTime, comment="会话结束时间")
quality_id    = Column(Integer, comment="质检ID")
is_top / star_mark / tag / is_solved / remark             # 客服工作台的标记位
```

五个索引很说明问题：`user_id`、`chat_user_id`、`company_id`、`service_id`、`created_at`。**几乎每一个查询维度都被建了索引**——因为这个表是工作台、报表、质检三处的共同热点。

两个派生属性体现了「把业务计算放在模型上」的取舍：

```python
@property
def wait_seconds(self):
    """当前排队等待时间"""
    if self.type == SessionType.QUEUE:
        return (dt.datetime.now() - self.created_at).total_seconds()

@property
def enter_queue_time(self):
    if self.type == SessionType.QUEUE:
        return self.created_at
```

`wait_seconds` 是**实时计算**（`now - created_at`），所以它只对未结束的排队段有意义；对已结束的段应改用 `stop_time - created_at`。这类 property 很好用，但**必须在语义上明确「是实时值还是历史值」**，否则报表口径一定出错。

### 2.3 `ChatLog`：不可变的消息事实

```python
SENDER_CHAT_USER = 1
SENDER_ROBOT     = 2
SENDER_USER      = 3
SENDER_SYSTEM    = 4

msg_id         = Column(String(32), nullable=False)   # 幂等键
sender         = Column(Integer)                      # 1访客 2机器人 3客服 4系统
msg            = Column(JSON, nullable=False)          # 消息体（类型/内容/媒体）
is_read        = Column(Boolean, default=False)
is_retracted   = Column(Boolean, default=False)        # 撤回而非删除
raw            = Column(JSON)                          # 日志附加信息
question_msg_id = Column(String(32))                   # 关联的「问题」消息
created_at     = Column(DATETIME(fsp=3))               # 毫秒精度
```

四个设计决策值得单独讲：

**① `msg_id` 是幂等键，不是自增 ID。**

```python
@classmethod
def get_by_msg_id_and_chat_user(cls, msg_id, chat_user_id):
    return cls.query.filter_by(msg_id=msg_id, chat_user_id=chat_user_id).first()
```

消息可能被重复投递（网络重试、IM 平台回调重复），靠 `msg_id` 去重是标准做法。

**② 撤回用 `is_retracted` 标志，不物理删除。**

```python
def query_chat_log(cls, chat_user_id, start_time=None, is_retracted=None, ...):
    if is_retracted is not None:
        query = query.filter_by(is_retracted=is_retracted)
```

同时还有 `deleted` 字段（软删）。**两个字段并存**：`is_retracted` 是「用户撤回」，`deleted` 是「数据被清理」。语义分开了，但查询时容易漏一个。

**③ `created_at` 用 `DATETIME(fsp=3)` 毫秒精度。**

在线聊天里同一秒会有多条消息，如果只到秒级，排序会不稳定，且「已读到某条消息」的边界判断会出错。**毫秒精度是聊天类表的必备**。

**④ `question_msg_id` 关联「问答对」。**

机器人回复需要知道「我在回答哪一句」，用于知识库命中分析、满意度归因、训练语料构建（`doc/会话系统.md` 里提到机器人段用于「知识库训练检查」）。

## 三、枚举体系：为什么分「会话级」和「服务级」两套结束原因

这是整套模型里最见功力的地方。任意一次结束，其实有两层语义：

- **这一段结束了**（`SessionStopWay`）——比如「人工段因客服超时结束」；
- **整次服务结束了**（`ServiceStopWay`）——比如「访客主动结束」。

两者经常同时发生，但并非总是一一对应（机器人段结束不代表服务结束）。代码里的做法是：

```python
class SessionStopWay:
    TO_ROBOT            = 201     # 转机器人
    USER                = 202     # 用户结束
    CHAT_USER_TIMEOUT   = 203     # 访客超时
    USER_TIMEOUT        = 204     # 客服超时
    CHECK_USER_OFFLINE  = 205     # 客服下线（检查）
    HUMAN_TIMEOUT       = 206     # 人工超时
    FORCE_OFFLINE       = 207     # 强制下线
    QUEUE_TIMEOUT       = 221     # 排队超时
    EXIT_QUEUE          = 222     # 退出排队
    QUEUE_NOT_USER      = 223     # 排队无客服
    ROBOT_TIMEOUT       = 241
    BLANK_TIMEOUT       = 261

class ServiceStopWay:
    ...（同上一组编号区间，但独立定义）

class CloseType:
    TO_ROBOT           = Close(SessionStopWay.TO_ROBOT,           ServiceStopWay.TO_ROBOT)
    USER               = Close(SessionStopWay.USER,               ServiceStopWay.USER)
    QUEUE_TIMEOUT      = Close(SessionStopWay.QUEUE_TIMEOUT,      ServiceStopWay.QUEUE_TIMEOUT)
    ...
```

`Close` 把「段结束原因」和「服务结束原因」打包成一个元组，业务代码只说 `CloseType.QUEUE_TIMEOUT`，模型层自己拆开放到两张表。

**这个设计解决了两个真实痛点：**

1. **统计口径统一**：报表里说「因排队超时结束的会话」，只需要按 `CloseType.QUEUE_TIMEOUT` 查，不用记两套编号；
2. **枚举值可读**：`221/222/223` 分组有语义（2xx 排队、4xx 机器人、9 转接），一眼能看出属于哪个阶段。

> 一处真实缺陷：`SessionStopWay.BLANK_TIMEOUT = 241` 与 `ROBOT_TIMEOUT = 241` **撞值**（`ServiceStopWay` 里则是 `BLANK_TIMEOUT = 261`）。数字表示层面能跑，但「空白段超时」和「机器人超时」在段级别将无法区分。这类**同值不同义**的常量，是枚举设计里最危险的一类错误，靠 review 很难发现，建议加一条「枚举值唯一性」的单元测试。

## 四、流程：一次咨询的完整状态流转

把 `create_way` / `stop_way` / `SessionType` 串起来，就是一条可复现的主流程：

```
① 访客进入页面（H5 渠道）
   ChatService.create(create_way=TO_BLANK/ACTIVATION, source=h5, entry_id=渠道)
   └─ ChatSession(type=BLANK)          空白段，等第一条消息

② 访客发第一条消息
   空白段 → 机器人段
   ChatSession(type=ROBOT, create_way=TO_ROBOT)

③ 访客点「转人工」，或机器人识别到关键词
   ChatSession(type=QUEUE, create_way=TO_QUEUE)     ← 排队段，进 Redis ZSET
   ChatService.status = STATUS_QUEUE

④ 调度引擎把访客分配出去（第 4 篇）
   ChatSession(type=HUMAN, create_way=TO_HUMAN)
   chat.transfer_q2h_for_dispatch(user_id=客服ID)
   ├─ 排队段 stop_way = EXIT_QUEUE      （因「成功出队」结束）
   └─ ChatService.status = STATUS_CHAT

⑤ 结束
   ChatSession.close_session(stop_way=USER / USER_TIMEOUT / CHECK_USER_OFFLINE ...)
   ChatService.status = STATUS_FINISH, stop_way, stop_time
   └─ 视配置发送结束语 / 邀请评价（is_evaluation）
```

每一步都对应一个 `CloseType`，也就是说**流程的每个分支都被编码成了枚举值**，而不是散落在 if-else 的字符串里。这是可统计性的基础。

### 4.1 「段切换」不是新建，而是「关一段 + 开一段」

以转人工为例，代码里不是把 `type` 改掉，而是：

```python
# 结束上一段（机器人/空白段）
self.last_session.close_session(CloseType.TO_ROBOT.session_stop_way, now)
# 新建排队段
new_session = ChatSession.create(type=SessionType.QUEUE, create_way=SessionCreateWay.TO_QUEUE, ...)
self.service.update(last_session_id=new_session.id, status=STATUS_QUEUE)
```

**为什么不用「一段到底、只改 type」？** 因为那样会丢掉「机器人段持续多久、排队等了多久」这两段关键时长，而这正是所有运营指标的分母。

代价是表行数变多（一次咨询 3-5 行），查询时必须「按 service_id 聚合」。这是典型的**用行数换可统计性**的取舍，在客服/工单类系统里几乎都是这么做的。

### 4.2 已读/未读：只保证最终一致

```python
@classmethod
def set_chat_log_readed(cls, msg_ids):
    if msg_ids:
        cls.query.filter_by(is_read=False).filter(cls.msg_id.in_(msg_ids)).update(
            {"is_read": True}, synchronize_session=False
        )
        db.session.commit()
```

`is_read` 是**冗余标记**（和 `ChatSession` 上的 `status` 同类）：真正的已读游标其实在「客服端记录了读到哪里」。用批量 `update` 更新是为了速度（`synchronize_session=False` 跳过 ORM 同步）。这类操作天然是最终一致的——**如果两边不一致，以「游标」为准**，标记只用于红点提示。

## 五、消息异步落 ES：为什么必须异步

`ChatSession.create_chat_log` 里有一行非常关键：

```python
from monarch.tasks.chat_log import chat_log_send_es
chat_log_send_es.delay(chat_log.to_dict(date_to_str=False), chat_log.id, chat_log.company_id)
```

**写 MySQL 是同步的，写 ES 是异步的**，并且进了 `low` 队列（第 5 篇）。这个顺序不能反：

1. **消息绝不能因为 ES 慢而发不出去**。聊天是核心链路，ES 是检索能力，主次必须先分清；
2. **ES 写失败可以重试**，从 `chat_log.id` 和 `company_id` 就能重建一条文档，天然可补偿；
3. **ES 是「派生视图」**，随时可基于 MySQL 全量重建（`train_es` 每天 0 点跑）。

这就是 CQRS 的迷你版本：**写库是事实来源，搜索是投影**。很多项目把两件事做成同步，结果 ES 一抖动，整个聊天就卡住。

> 一个需要注意的副作用：`chat_log_send_es.delay(...)` 是**在模型层调用的**。模型层引入 Celery 依赖，让「创建一条日志」变成了有外部副作用的行为，单测时必须 mock。更干净的写法是把「发送到 ES」放到 service 层或事件监听里（第 5 篇的 `blinker` 信号就是更好的位置）。

## 六、模型的三个可改进点

**① `ChatService.status` 与 `last_session` 的冗余没有守护。**
建议加一个每小时一致性校验任务：`status` 为「会话中」但 `last_session.stop_time` 非空的，自动修正并打点。数据漂移不发现，报表就永远有人质疑。

**② `ChatLog` 上 `deleted` 与 `is_retracted` 双标志。**
建议明确：「撤回」只改 `is_retracted`，「合规删除」只改 `deleted`，并在所有查询封装里强制带 `deleted == False`（现在是各处自己写）。

**③ 消息表会无限膨胀。**
`chat_log` 是最热的写入表。按 `company_id` + `created_at` 做分区，或者把 6 个月前的日志归档到独立表 / 冷存储，是迟早要做的。这份代码里只建了索引，没有归档策略——**索引能救查询，救不了单表几百 G 的写入压力**。

## 七、可复用的结论

1. **「一次服务」与「一段会话」必须分开建模**，否则时长、归属、统计全都会糊。
2. **段切换 = 关一段 + 开一段**，用行数换可统计性，值得。
3. **结束原因分「段级」与「服务级」，用一个 `CloseType` 元组打包**，业务只认一个枚举。
4. **枚举值必须唯一**，并加单测；同值不同义是隐性炸弹。
5. **消息表必须有业务幂等键（`msg_id`）和毫秒时间戳**。
6. **撤回用标志位、删除用软删**，语义必须分开且查询强制过滤。
7. **搜索/日志类写入一律异步**，主链路只写事实库，派生视图可重建。
8. **冗余状态字段必须配一致性校验任务**，否则它就是未来的工单。

---
