---
order: 10
---

# 机器人平台：FAQ 检索与多轮任务的双引擎设计

对应归档里的 `webot3_robot/`（`monarch/models/question.py`、`taskbot.py`、`external/es_search.py`、`doc/数据库设计.md`、`doc/接口设计.md`）。

## 一、为什么是「双引擎」

访客问一句「我的订单到哪了」，可能的意图分两类：

- **知识型**：答案是静态的，比如「退货运费谁承担」。一次检索就能回。
- **任务型**：答案要做动作，比如「帮我查订单」→ 需要确认身份、要订单号、调接口。一次检索不够。

所以机器人被拆成两个引擎，由同一个入口依次尝试：

```json
"debug_ret": {
  "faq":  [],     // FAQ 模块请求结果
  "task": {}      // 多轮模块请求结果
}
```

**先 FAQ，后 task**，还是反过来？从 `answer_detail.source` 只有 `faq` / `task` 两个取值来看，二者是**平级候选**，由匹配得分决定。FAQ 答不上来才进多轮，是「检索优先」的常见策略：**静态知识的命中成本远低于走一遍对话流**。

这套结构还有一个额外好处：`debug_ret` 同时保留了**两个引擎的原始返回**。出问题时不用猜「为什么机器人答错了」，直接看两边的候选和分数。

## 二、FAQ 引擎：知识不是「一条问答」，是「一个答案 + N 个问法」

### 2.1 表结构

```python
class Question(Base, TimestampMixin):
    robot_id        = Column(Integer, comment="机器人ID")
    question_number = Column(String(64), default=gen_random_key, comment="问题编码")
    question        = Column(String(128), comment="问题")          # 标准问
    answer          = Column(JSON, comment="答案")
    tag_id          = Column(Integer, comment="分类ID")
    enabled         = Column(Boolean, comment="true启用, false禁用")
    status          = Column(Integer, comment="1 永久有效 2 生效日期设定")
    valid_at        = Column(DateTime, comment="生效时间")
    expired_at      = Column(DateTime, comment="失效时间")
    reply_type      = Column(Integer, default=0, comment="回复类型")
    recommend_type  = Column(Integer, default=0, comment="0手动 1热门 2相似")
    auto_recommend_count = Column(Integer, default=0, comment="自动推荐数量")
    audit_status    = Column(Integer, comment="0待审核 1通过 2未通过")

class SimilarQuestion(Base, TimestampMixin):
    question_id      = Column(Integer, comment="问题ID")
    similar_question = Column(String(128), comment="相似问题")
```

关键点：

**① 标准问 + 相似问是一对多。** 一条知识可以有 N 个相似问法，用户怎么问都能命中同一条答案。相似问是「人工扩充的训练集」，比纯模型匹配更可控。

**② 答案用 JSON 而不是文本。** `answer` 是一个结构化对象（卡片/富文本/多段/按钮），前端按类型渲染。这让「同一个匹配结果」可以呈现成完全不同的形态。

**③ 有效期是一等公民。**

```python
if cls.status == QUESTION_STATUS['time_effective']:
    query = query.filter(or_(
        cls.valid_at > time_now,
        and_(cls.valid_at <= time_now, cls.expired_at >= time_now)
    ))
```

注意这个 `or_` 的写法其实等价于 `cls.expired_at >= time_now`——第一个条件（`valid_at > now`，还没生效）是冗余的，属于**「显式列出所有情形」风格的代码**。写法冗余但可读，问题在于**没有排除 `valid_at IS NULL`**：`valid_at` 为空的记录这两个条件都不成立，会被过滤掉。所以必须保证「设定了时间范围」时两个字段都有值，否则知识会凭空消失（模型上也确实允许 `nullable=True`）。这是个容易被测试漏掉的边界。

**④ 审核状态独立于启用状态。** `audit_status` 与 `enabled` 是两个开关：前者是「运营审核」，后者是「业务开关」。**同时存在是必要的**——审核通过但临时下线的知识，不能因为审核通过就被检索到。

### 2.2 未知问题挖掘：把「答不上来」变成资产

```python
class UnknownQuestion(Base, TimestampMixin):
    robot_id         = Column(Integer, comment="机器人id")
    unknown_question = Column(String(128), comment="访客提问")
    nums             = Column(Integer, comment="提问次数")
    status           = Column(Integer, default=STATUS_NORMAL,
                              comment="1正常 2忽略 3新建 4合并")
```

这是机器人产品里最值钱的一张表。逻辑链是：

```
用户提问 → 未命中 FAQ → 落 unknown_question（nums + 1）
       → 运营按 nums 排序 → 高频未命中 = 知识缺口
       → 新建知识 / 合并到已有标准问 → status = 3/4
```

**「未命中」不是失败，是数据采集点。** 没有这张表的机器人，永远只能靠人工猜该补什么知识。

`nums` 用累加而不是每条都存一行，是必须的——否则高频问题会把表撑爆。

### 2.3 检索：ES 在外部服务里，本服务只负责「训练」

`external/es_search.py` 不是直接查 ES，而是调一个「ES 检索服务」的 HTTP 接口：

```python
class ESSearch:
    APIS = dict(
        train="/es_search/train",
        update="/es_search/update",
        delete="/es_search/delete",
        search="/es_search/search",
    )
```

`build_up_for_es` 把一条 FAQ 展开成「1 + N」个文档：

```python
def build_up_for_es(self, question):
    ret = [dict(id=question.id, question=question.question, answer=question.answer,
                tag=self.tags.get(question.tag_id), type="faq")]
    for similar in question.similar_questions:
        ret.append(dict(id=question.id, question=similar.similar_question,
                        answer=question.answer, tag=self.tags.get(question.tag_id),
                        type="faq"))
    return ret
```

**注意：每个相似问都是一条独立文档，但 `id` 指向同一条知识。** 这样检索时「命中任意一个问法」都能返回同一个答案，且**不需要 ES 侧做任何聚合**。用冗余文档换检索简单性，是标准做法。

`train` 是全量重建：

```python
def train(self):
    questions = Question.get_questions_by_robot_id(self.robot_id)
    result = []
    for question in questions:
        result.extend(self.build_up_for_es(question))
    if not result:
        return {"msg": "公司{}机器人{}没有FAQ数据，无需训练"}
    request_data = dict(company_code=self.company_code.lower(),
                        robot_id=self.robot_key.lower(), data=result)
    return self._request("train", data=request_data, method="POST", timeout=1000)
```

三个细节：

1. **`timeout=1000` 秒**。全量训练是长任务，短超时必然失败。
2. **`company_code` / `robot_key` 全部 `.lower()`**。检索服务的索引名/路由依赖这两个值，大小写不统一会写到不同索引里——**这是最容易造成「明明训练了却搜不到」的原因**。
3. **没有数据时直接返回，不调接口**。省一次长连接，也避免在检索服务里留下空索引。

`update(ids)` / `delete_doc(ids)` 则是增量维护，配合业务侧的「保存知识时触发」。**全量 + 增量两条路径必须都实现**，只用增量的话，某次漏更新的文档会永久留在索引里。

## 三、任务型引擎：BOT → 意图 → 句式/词槽 → 对话流

```python
class TaskBot(Base, TimestampMixin):
    robot_id    = Column(Integer, comment="机器人ID")
    name        = Column(String(20), comment="BOT名称")
    model_id    = Column(String(100), comment="BOT模型ID")
    status      = Column(Integer, default=1, comment="BOT生效状态")
    recall_key  = Column(String(64), comment="bot训练唯一标识")

class TaskBotIntention(Base, TimestampMixin):
    bot_id        = Column(Integer, comment="bot_id")
    intention_name = Column(String(20), comment="意图名称")
    dialogue_flow = Column(LONGTEXT, comment="对话流")           # 整个流程图存这里
    status        = Column(Integer, default=0, comment="意图生效状态")
    push_version  = Column(String(32), comment="对话流发布版本")
    last_push_version = Column(String(32), comment="上一个对话流发布版本")

class TaskBotSentence(Base, TimestampMixin):
    intention_id = Column(Integer, comment="意图ID")
    sentence     = Column(String(100), comment="句式")
    slotInfo     = Column(Text, comment="词槽信息")
    pattern      = Column(String(200))
    threshold    = Column(Float, default=1, comment="阈值")

class TaskBotSlot(Base, TimestampMixin):
    bot_id               = Column(Integer)
    slot_name            = Column(String(20), comment="词槽名称")
    relation_dictionary_id = Column(Integer, comment="关联词典ID")
```

四个设计要点：

**① `dialogue_flow` 用 LONGTEXT 存整个图形化对话流。**
前端是一个可视化编排器，产物是 JSON 图（节点 + 连线）。**不在数据库里拆成 node/edge 两张表**，是因为对话流是「整体编辑、整体发布」的产物，拆表会让并发编辑和版本回滚极其难做。

**② `push_version` / `last_push_version` 是版本发布机制。**
发布时把当前版本号写入 `push_version`，旧值挪到 `last_push_version`。**这支持一键回滚**：出问题时把两个字段对调即可，不用重新编排。代价是只保留一代历史；要更完整的历史得加 `task_intention_version` 表。

**③ 意图匹配靠「句式 + 词槽 + 阈值」。**
`TaskBotSentence` 是「这个意图能被怎么问」，句式里的词槽（slot）标记出可替换部分（如「查{订单号}的物流」）。`threshold` 是匹配阈值，可以按句式粒度调——**行业术语多的场景把阈值调低，通用句式调高**，比全局一个阈值灵活得多。

**④ 词槽关联词典，而不是内嵌枚举。**
`TaskBotSlot.relation_dictionary_id` 指向词典表。好处是「城市名、产品名、部门名」这类值可以集中维护、复用到多个意图；坏处是多一次 join，且词典变更要触发重新训练。

## 四、会话与日志：机器人侧的模型是精简版

```python
class RobotChatSession(Base):        # 机器人侧会话
    status     = Column(Integer, comment="1会话中 2已结束")
    create_way = Column(Integer, comment="1默认")
    stop_way   = Column(Integer, comment="1主动结束 2超时结束")

class RobotChatLog(Base):
    sender = Column(Integer, comment="发送者：1访客，2机器人")
    msg    = Column(JSON)
    raw    = Column(JSON)
```

对比第 8 篇的客服侧三层模型（Service → Session → Log），机器人侧只有 **Session → Log 两层**：

- 没有「服务」层，因为机器人不需要排队、不需要分配、没有客服归属；
- `sender` 只有两种（访客/机器人），没有「客服」「系统」。

**这正好说明「领域模型必须跟着业务复杂度走」，不能为了统一而统一。** 强行把机器人会话也塞进 `ChatService`，会带来一堆永远为 0 的字段。

`raw` 字段的用法也值得抄：

```json
{
  "is_solved": true,        // 点赞，默认 None
  "recommend_click": true   // 推荐点击，默认 None
}
```

**把「用户的隐性反馈」放进 `raw`，而不是加新字段。** 点赞、点推荐这些指标将来还会增加（比如「复制答案」「转人工」），用 JSON 扩展零成本；如果每个都加一列，表结构会被反馈指标撑爆。

## 五、全链路审计：ActionLog

```python
class ActionLog(Base, TimestampMixin):
    robot_id    = Column(...)
    user_id     = Column(...)          # SSO 授权操作人
    action      = Column(...)          # 执行动作
    action_level/action_set/content    # 动作层级、动作集合、执行内容
    component   = Column(...)          # 前端路由
    path/method/status_code/code       # HTTP 层信息
    result      = Column(...)
```

`doc/数据库设计.md` 里这张表列了 15 个字段，本质是**「谁、在哪个页面、做了什么、结果如何」**的操作审计。三个设计要点：

1. **`component`（前端路由）而不是只记 API 路径**。运营看的不是 `/api/v1/question/50`，而是「知识库-编辑页」。记前端路由才能让审计日志可读。
2. **`action_level` / `action_set`** 支持「批量操作」的归因——一次批量导入是 1 个 action_set、N 个 action。
3. **`status_code` 与 `code` 分开记**，与第 1 篇的「HTTP 码 / 业务码分离」一致。

这类审计表的价值在事后追查（「这条知识是谁改的」），成本是每次写操作多一条 insert。**建议异步写入**（走 Celery `low` 队列），不要阻塞业务接口。

## 六、这套机器人平台的可复用结论

1. **FAQ 与任务型必须分开建模**，一个检索、一个流程，混在一起两边都做不好。
2. **标准问 + N 个相似问**是提升召回最便宜的手段；ES 侧把每条相似问当独立文档，`id` 指回同一条知识。
3. **知识必须有有效期**，且要明确 `valid_at/expired_at` 的 NULL 语义（本次发现的边界问题值得写成规范）。
4. **审核状态与启停状态分开**，权限不同、变更节奏也不同。
5. **未命中要落表计数**，`unknown_question` 是知识库的「需求池」。
6. **训练接口要全量 + 增量两条路径**，且索引标识（company_code / robot_key）必须统一大小写。
7. **对话流存整块 JSON + 版本字段**，支持一键回滚，胜过拆表。
8. **会话模型按业务复杂度裁剪**，机器人侧不需要「服务层」。
9. **隐性反馈放 `raw` JSON**，别为每个指标加列。

---
