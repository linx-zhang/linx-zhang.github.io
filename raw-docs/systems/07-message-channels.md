---
order: 8
---

# 多渠道消息接入：平台工厂 + 两套请求签名

对应归档里的 `webot3/monarch/config.py`（`PLATFORMS`）、`monarch/utils/signature.py`、`monarch/models/chat_user.py`、`doc/h5签名方案.md`。

## 一、十个渠道，一张表

在线客服的访客从哪来，决定了消息怎么送出去。这份系统里支持 10 个来源，全部挂在 `config.py` 的一张字典上：

```python
PLATFORMS = dict(
    h5=            {"source": "h5",           "name": "网页",           "url": CENTRIFUGO_URL,  "info": {"api_key": CENTRIFUGO_API_KEY}},
    wechat=        {"source": "wechat",       "name": "微信公众号",     "url": WECHAT_SEND_API, "info": {}},
    qq=            {"source": "qq",           "name": "QQ",             "url": QQ_SEND_API,     "info": {}},
    wxwork_h5=     {"source": "wxwork_h5",    "name": "企业微信应用H5", "url": "https://qyapi.weixin.qq.com", "info": {}},
    dingding_h5=   {"source": "dingding_h5",  "name": "钉钉H5",         "url": "https://oapi.dingtalk.com",   "info": {}},
    wxapp_h5=      {"source": "wxapp_h5",     "name": "微信小程序",     "url": "",              "info": {}},
    wechat_group=  {"source": "wechat_group", "name": "企业微信聊天",   "url": ".../message/send", "info": {}},
    wxapp=         {"source": "wxapp",        "name": "微信小程序聊天", "url": ".../cgi-bin/message/custom/send?access_token={access_token}", "info": {}},
    weibo=         {"source": "weibo",        "name": "微博聊天",       "url": "",              "info": {}},
    wxkf=          {"source": "wxkf",         "name": "微信客服",       "url": ".../cgi-bin/message/custom/send?access_token={access_token}", "info": {}},
)
```

四列的分工非常清晰：

| 列 | 作用 |
| --- | --- |
| `source` | 落库用的来源枚举，**必须与 `ChatSource` 里的常量一一对应** |
| `name` | 后台下拉框显示的中文名 |
| `url` | 出站地址。H5 指向长连接网关，其余指向各自的开放平台接口 |
| `info` | 该渠道专属的配置（如 H5 的 `api_key`） |

**这就是「平台工厂」最轻的实现**：不写类、不写注册器，只用一张配置表 + 一个字典查表。它带来的最大好处是——**新增一个渠道 = 加一段字典 + 加一个 `create_for_xxx` 方法**，不用改路由、不用改消息发送的核心逻辑。

## 二、访客身份：ChatUser 与 ChatUserSource 分开

一个访客可能同时出现在多个渠道（同一个人今天从公众号来、明天从网页来）。所以模型分成两层：

```
ChatUser（访客主体：company_id、昵称、头像、客户绑定、在线状态、最近活跃）
   └─ ChatUserSource（来源记录：source、source_id、extra）
```

```python
class ChatUserSource(Base, TimestampMixin):
    source    = Column(Integer, nullable=False, comment="用户来源 1 浏览器 2 微信")
    source_id = Column(String(64), nullable=False, comment="来源ID")
    extra     = Column(JSON)                      # {"openid": "...", "chatId": "..."}
    Index("idx_source_id", "source_id")
```

`source_id` 是渠道内的唯一标识：

- H5：用约定的固定值 `PLATFORMS["h5"]["default_source_id"]`（同一站点共用一个访客池）；
- 微信 / QQ：用 `appid`，`extra` 里存 `openid`；
- 企业微信聊天 / 小程序聊天：用 `chatId`；
- 企微应用 H5 / 钉钉 H5 / 小程序 H5：由外部系统传 `source_id` 进来。

`ChatUserSource` 上一堆 `create_for_*` 类方法，形态高度一致：

```python
@classmethod
def create_for_wechat(cls, chat_user_id, company_id, appid, openid):
    return cls.create(chat_user_id=chat_user_id, company_id=company_id,
                      source=cls.SOURCE_CODE[ChatSource.WECHAT],
                      source_id=appid, extra={"openid": openid})
```

**这其实是「枚举 + 工厂」的组合**：`SOURCE_CODE[ChatSource.X]` 把语义常量映射到数据库里的数字。好处是业务代码只认 `ChatSource`，不认 `1`/`2`；坏处是**数字一旦落库就改不动了**——所以注释里必须写清每个数字的含义（代码里确实写了 `comment="用户来源 1 浏览器 2 微信"`，这一点做对了）。

## 三、出站消息：三种形态，两条链路

按「消息怎么送到用户手上」，这 10 个渠道其实只有三种形态：

| 形态 | 渠道 | 链路 |
| --- | --- | --- |
| **长连接推送** | h5 | 服务端 → Centrifugo HTTP API → 浏览器 WebSocket |
| **开放平台调接口** | wechat / qq / wxapp / wxkf / wechat_group | 服务端 → 各平台 HTTP API（需 access_token） |
| **被动等待拉取** | wxwork_h5 / dingding_h5 / wxapp_h5 / weibo | 前端页面自己轮询/长连自己的宿主 App |

H5 走长连接是必然选择：**客服回复必须秒级到达，不能靠轮询**。代价是多一个中间件（Centrifugo），以及「消息补偿」的问题——推送失败时必须有兜底（重连后拉历史消息）。

`url` 里带 `{access_token}` 占位符的渠道（wxapp / wxkf）说明发送前要现取 token。**这是一个典型的坑点**：`access_token` 有效期 2 小时且有调用频率限制，必须集中缓存 + 提前刷新，绝不能在每次发消息时去换。

## 四、两套签名，服务两类调用方

系统里同时存在两套 MD5 签名，面向不同对象，**这是很多人读这份代码时最容易混淆的地方**：

| | 方案 A：访客 H5 签名 | 方案 B：服务端 API 签名 |
| --- | --- | --- |
| 实现位置 | `doc/h5签名方案.md` + 渠道入口校验 | `monarch/utils/signature.py` 的 `Signature` 类 |
| 调用方 | 浏览器 / 小程序前端 | 内部服务、第三方系统 server-to-server |
| 参数来源 | 请求 query 或 body 里的**基础类型字段** | 整个请求体 JSON |
| 拼接方式 | `k1=v1&k2=v2&...&appid=&noncestr=&timestamp=&secret=` | `data=<紧凑JSON>&<secret>` |
| 大小写 | **小写** `hexdigest()` | **大写** `hexdigest().upper()` |
| 有效期 | 10 分钟（`SIGN_VALID_INTERVAL`） | 3 分钟（`THREE_MINUTE_EXPIRED_AT`） |
| 传输位置 | 请求头 `appid / timestamp / noncestr / sign` | 请求体里的 `client_id / timestamp / sign` |

### 4.1 方案 A：H5 访客签名（六步）

原文的六步我原样保留，这是最好的「可直接照抄的实现规范」：

1. 取出 query 参数（GET）或请求 json（非 GET）中的**基础类型**（非 json、非数组）字段；
2. 按字母排序后用 `&` 拼接；
3. 生成毫秒级 `timestamp` 与 32 位 uuid 的 `noncestr`；
4. 末尾拼接 `&appid=xxx&noncestr=xxx&timestamp=xxx&secret=xxx`；
5. UTF-8 编码后 MD5，得到 `sign`；
6. 请求头带上 `appid / timestamp / noncestr / sign`。

**并附一条极易踩的注意点**（原文第 13 行）：

> 值类型为 `false`、`true` 或 `null` 时，转为 `0`、`1`、`""` 后进行签名。

为什么必须写死这条？因为 **JS 的 `false` 和 Python 的 `False` 序列化成字符串完全不同**（`"false"` vs `"False"`），`null` 与 `None` 同理。不做归一化，前端算出的 sign 后端永远对不上。用 `0/1/""` 这个映射虽然不直观，但胜在**跨语言稳定**。

一段能跑通的参考实现：

```python
def sign_h5(payload, appid, secret, timestamp, noncestr):
    basic = {k: v for k, v in payload.items() if isinstance(v, (str, int, float, bool, type(None)))}
    basic = {k: (1 if v is True else 0 if v is False else "" if v is None else v)
             for k, v in basic.items()}
    joined = "&".join(f"{k}={basic[k]}" for k in sorted(basic))
    raw = f"{joined}&appid={appid}&noncestr={noncestr}&timestamp={timestamp}&secret={secret}"
    return hashlib.md5(raw.encode("utf-8")).hexdigest()      # 小写
```

注意 `isinstance(v, (str, int, float, bool, type(None)))` 这一步：它会**把布尔当 int 处理**，所以 `True` 会先被 `1 if v is True` 处理掉，顺序不能反。

### 4.2 方案 B：服务端 API 签名

```python
class Signature():
    def __init__(self, expired_at=THREE_MINUTE_EXPIRED_AT):
        self._accesskeys = {SSO_CLIENT_ID: SSO_CLIENT_SECRET}   # client_id -> secret
        self.expired_at = expired_at

    def _check_timestamp(self, req_timestamp):
        now_timestamp = datetime_to_timestamp(datetime.datetime.now())
        return req_timestamp + self.expired_at >= now_timestamp

    def _sign(self, data):
        if "sign" in data:
            data.pop("sign")                                  # 关键：先剔签名本身
        accesskey_id = data["client_id"]
        param_splicing_str = "data=" + json.dumps(data, sort_keys=True, separators=(",", ":")) \
                             + self._accesskeys[accesskey_id]
        return hashlib.md5(param_splicing_str.encode("utf-8")).hexdigest().upper()

    def check(self, data):
        if not self._check_timestamp(data["timestamp"]):
            return False, "Request expired"
        if not self._check_accesskey_id(data["client_id"]):
            return False, "client_id error"
        if self._sign(data) != data["sign"]:
            return False, "verification failed"
        return True, ""
```

两个技术要点：

**① `sort_keys=True` + `separators=(",", ":")`**。这是「签名用的 JSON 必须完全确定」的标准做法。默认的 `json.dumps` 会带空格（`, ` 和 `: `），不同语言、不同版本的空格规则可能不一致；强制成紧凑格式，就消除了这一层歧义。

**② `data.pop("sign")` 必须放在最前面**。否则「拿包含 sign 的数据去算 sign」，永远不可能相等。这个坑几乎每个自研签名系统都踩过一次。

### 4.3 两套方案的共同问题（必须讲）

1. **MD5 已不适合做签名。** MD5 的碰撞攻击早已实用化。虽然「带密钥的拼接」不是标准 HMAC，长度扩展攻击也基本不成立（secret 在后面），但工程上没有任何理由继续用它。**直接换 `HMAC-SHA256(secret, canonical_string)`，前端一行 `CryptoJS.HmacSHA256` 就能对上。**
2. **字符串比较不是常量时间。** `self._sign(data) != data["sign"]` 用 `!=` 比较，理论上可做时序侧信道（虽然 MD5 场景下危害极小）。规范做法是 `hmac.compare_digest(a, b)`。
3. **`noncestr` 没有被存储、没有去重。** 方案 A 生成了 32 位 uuid，但校验逻辑只查了 timestamp 窗口——**同一个请求在 10 分钟内可以无限重放**。要真正防重放，必须把 `noncestr` 写进 Redis（`SET NX EX=600`），重复即拒。
4. **`print(param_splicing_str)` 留在生产代码里**（`signature.py` 第 41 行）。签名串包含 secret，**这是一条会把密钥打到 stdout / 容器日志的路径**，必须删掉或降级为 debug 且脱敏。
5. **`_accesskeys` 只有一个 client**。多接入方时得改成配置表（`APP_SECRET_MAP` 已经是雏形），并支持按 client 限流。

## 五、一份可以直接抄的「签名接口设计清单」

从这两套实现里提炼的通用规范，写新系统时逐条对照：

- [ ] 待签字符串必须**规范化**：字段排序、紧凑 JSON、空值/布尔归一、编码固定 UTF-8。
- [ ] 签名必须**覆盖请求方法 + 路径 + 关键参数**，只签 body 挡不住「改 URL 重放」。
- [ ] 必须带 `timestamp`，并服务端校验时间窗口（建议 ≤5 分钟）。
- [ ] 必须带 `nonce`，并**服务端存储去重**（Redis `SET NX EX`）。
- [ ] 验签失败统一返回 401，**不要区分「过期」和「签名错」**给外部调用方（内部日志可以区分）。
- [ ] 用 HMAC-SHA256 以上，常量时间比较。
- [ ] secret 只存服务端，**绝不进前端、绝不进日志、绝不进代码仓库**。
- [ ] 提供**服务端签名调试工具**（输入参数 → 输出待签串与 sign），把「对不上」这类工单一次性消灭。

## 六、可复用的结论

1. **渠道扩展用配置表 + 少量工厂方法**，不要为每个渠道写一个类继承体系——9 个渠道里 6 个的行为完全一样。
2. **访客主体与来源记录分离**，一个人多来源时不用改表结构。
3. **来源数字必须写进字段注释**，落库即冻结。
4. **H5 必须长连接推送**，其余渠道按平台能力选推送或拉取。
5. **`access_token` 类凭据必须集中缓存**，禁止每次发送现取。
6. **前端参与签名时，布尔与 null 的归一化规则要写进协议文档**，否则必然对不上。
7. **`json.dumps(sort_keys=True, separators=...)` 是跨语言签名的地基**；`pop("sign")` 要在最前面。
8. **MD5 + 无 nonce 存储 = 可重放**，这两条是这套方案最该升级的地方。

---
