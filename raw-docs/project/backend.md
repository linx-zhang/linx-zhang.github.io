---
pin: 3
---

# 深入后端：Cloudflare Worker + D1 的工程化

后端是挂在 `linx-api-78i.pages.dev` 上的一个 Cloudflare Python Worker，用 FastAPI 的写法跑在 Workers 运行时上，数据落在 D1（SQLite）。规模：**47 个 py 文件（`src` 43 + `scripts` 4；连同迁移与脚本共 69 个文本文件、7998 行）、55 个端点、11 张表、17 个 migration**（另有 `tests/` 15 个文件 2565 行、157 个用例，不计入运行时代码）。

它要支撑的东西不算少：登录与角色、文章增删改查与相邻篇、评论、访问事件与匿名事件、备忘录、日常消耗品、共享剪切板短链、邀请码、用户管理、重置密码、缓存与限流、定时清理。全部跑在一个 Worker 里，没有微服务、没有消息队列、没有 Redis。

这篇讲的是「怎么用最小的基础设施把边界划清楚」：入口只做 glue、错误只有一种形状、权限只有一份码表、分页谓词只有一处实现、缓存留在同一个数据库里。

## 一、为什么是 Worker + D1

| 选择 | 理由 | 代价 |
| --- | --- | --- |
| Cloudflare Worker | 无服务器、按请求计费、天然带 CDN 与 TLS | 运行时限制：CPU 时间、请求体、连接数、无长连接 |
| Python 运行时 | 与个人技术栈一致，FastAPI 写法可复用心智 | 生态比 JS 少，依赖要打包进 Worker |
| D1 | 与 Worker 同源、SQL 熟悉、事务简单 | 单库单写、延迟取决于区域，不能当高频 KV 用 |
| 不用 KV / Durable Object 做缓存 | 少一个绑定、少一套一致性模型、少一份配额 | 缓存与业务共享同一份存储配额 |

最后一条是关键取舍：缓存单独上 KV 看起来更「标准」，但这里缓存的数据全都由 D1 派生，多一套存储只会多一套失效逻辑。用一张 `cache_entries` 表，能 join、能查、能一条语句清空，认知成本最低。

## 二、入口只做 glue

`src/entry.py` 只有 62 行，因为它只做三件事：把 Worker 的 `Request` 转给 ASGI、补上 Cloudflare 的 geo 字段、把 `scheduled` 事件转给定时任务。

其中有一个不显眼但必要的桥：

```python
_GEO_HEADERS = (
    ("x-cf-country", "country"),
    ("x-cf-region", "region"),
    ("x-cf-city", "city"),
    ("x-cf-colo", "colo"),
)
```

`workers.asgi` 只从 method / path / headers 构造 ASGI scope，`request.cf` 里的城市、地区、机房是看不见的。入口把这四个字段克隆成请求头，应用层就能像读普通 header 一样读地理信息——同时这段克隆是 best-effort：失败就原样透传，绝不让站点因为拿不到城市而 500。

`Default.scheduled` 同理，方法名由运行时固定，真正的任务逻辑放在 `src/tasks/cron.py`。

## 三、分层地图

| 目录 | 行数 | 职责 |
| --- | --- | --- |
| `src/api` | 3936 | 应用装配、路由、依赖、请求/响应模型 |
| `src/services` | 1356 | 跨路由业务逻辑：邀请码、简历与分享、匿名路径白名单、分析 SQL、账本编排、纯折叠 |
| `scripts` | 1058 | 文档校验、schema 导出、发文助手（其中 `scripts/agent` 是冒烟与运维脚本，不进 Worker 包） |
| `src/core` | 464 | 权限码表、JWT、常量、时间工具 |
| `src/infra` | 398 | D1 访问、缓存、配置、密码哈希 |
| `migrations` | 347 | 17 个增量迁移 |
| `src/tasks` | 377 | 定时任务（事件保留、缓存清理、memos 墓碑、消耗品墓碑、失效分享短链、账本折叠） |
| `src/entry.py` | 62 | 运行时入口 |

分层的判定标准很朴素：**能不能脱离 FastAPI 单独测试**。`core/*` 全部与框架无关（权限码表就是纯字典 + 一个 `has_permission`），`infra/*` 只依赖 D1 binding，路由层只做「校验 → 调服务 → 返回」。

## 四、应用装配：十一行注册表

`api/app.py` 里没有任何业务代码，只有中间件、路由注册、异常处理器安装：

```python
API_PREFIX = "/api"
api = APIRouter(prefix=API_PREFIX)

api.include_router(auth.router, prefix="/auth")
api.include_router(posts.router, prefix="/posts")
api.include_router(comments.router, prefix="/posts")
api.include_router(comments.delete_router, prefix="/comments")
api.include_router(admin.router, prefix="/admin")
api.include_router(invites.router, prefix="/admin")
api.include_router(activity.router, prefix="/activity")
api.include_router(memos.router, prefix="/memos")
api.include_router(consumables.router, prefix="/consumables")
api.include_router(clips.router, prefix="/clips")
api.include_router(resumes.router, prefix="/resumes")

app.include_router(api)
```

业务端点统一在 `/api` 下，根路径留给平台自己：`/` 是健康检查，`/docs` 与 `/openapi.json` 是 FastAPI 自带的。这条前缀不是审美问题——一旦哪天要在同一个 Worker 上挂 `/rss`、`/og` 这类非 API 端点，没有前缀就得逐个改名。

一个细节：评论的「创建」挂在 `/api/posts` 下（属于文章），「删除」挂在 `/api/comments` 下（属于评论自身），所以同一模块导出两个 router。URL 语义优先于模块内聚。

CORS 也不是默认配置：Starlette 对预检请求回 200，而这个 API 统一回 204（`Preflight204CORSMiddleware`）。前端不依赖预检响应体，但保持「无内容即 204」能让缓存与日志里的语义一致。

## 五、统一信封与错误

每个响应都是 `{ code, detail, data }`：

- `code` 是机器可读的错误码（`unauthorized`、`forbidden`、`validation_error`、`rate_limited`…）；
- `detail` 是给人看的英文句子（`resource not found`、`permission denied`…）；
- `data` 是业务载荷，`204` 时没有 body。

`install_error_handlers()` 把 FastAPI 的三类异常全部映射进同一个形状：`ApiError`（业务错误）、`RequestValidationError`（422）、`StarletteHTTPException`（404/405 等）。前端 `request()` 因此只需要认一种结构：

```ts
if (typeof body === 'object' && body !== null) {
  const { code, detail } = body
  if (typeof code === 'string' && typeof detail === 'string') {
    return new ApiError(status, code, detail)
  }
}
```

字符串常量集中在 `core/constants.py`，路由里不写死文案。这一条在跨仓协作里尤其重要：前端只判断状态码与 `code`，文案由后端给，避免两边各写一份然后慢慢漂移。

## 六、认证：角色永远从数据库读

`get_current_user()` 做了两件容易被省略的事：

```python
payload = decode_access_token(token, settings)
# The role is always read from the database, never from the token.
user_id = int(payload["sub"])
...
if invalidated_at and _issued_before_reset(payload.get("iat"), invalidated_at):
    raise _UNAUTHORIZED
```

1. **token 里只放 `sub` 与 `iat`，不放角色**。角色从 `users` 表现读，这样改角色、封号、软删除立刻生效，不需要等 token 过期。
2. **密码重置 / 登出会给 `token_invalidated_at` 打戳**，`iat` 早于这个戳的 token 一律 401。用 JWT 最常见的安全债就是「改了密码旧 token 还能用」，这里在依赖层一次性关掉。

客户端 IP 的取值顺序是 `cf-connecting-ip` → `x-real-ip` → `x-forwarded-for` 首段：Cloudflare 自己写第一个，另外两个只在经过其它代理（本地开发、Pages 中转）时才有意义。

## 七、权限：一张码表就是契约

权限码形如 `resource:action:scope`，只有三组常量 + 一张角色映射：

| 集合 | 数量 | 说明 |
| --- | --- | --- |
| `_MEMBER_PERMISSIONS` | 9 | 所有登录用户：读改自己账号、发文章、改删自己的文章、发评论、删自己的评论、写自己的事件、删自己的剪切板 |
| `_ADMIN_PERMISSIONS` | 13 | 管理员额外：改删任意文章/评论、邀请码三条、用户四条、读任意事件、删任意剪切板、管理简历 |
| `PUBLIC_PERMISSIONS` | 2 | 只描述公开端点：`post:read:any`、`comment:read:any`，永不合并进用户权限 |

`user` 与 `internal` 共用 member 集合，这是刻意的：内部账号不是特权，只是来源不同。

两个使用方式：

```python
@router.get("", dependencies=[Depends(require_permission(ACTIVITY_READ_ANY))])
async def list_events(...): ...
```

以及所有权判定：

```python
def ensure_resource_permission(user, owner_id, own_code, any_code) -> None:
    if owner_id == user["id"] and has_permission(user["role"], own_code):
        return
    if has_permission(user["role"], any_code):
        return
    raise _forbidden()
```

「本人 + own 码 / 任意人 + any 码」这两段，是删文章、删评论、删剪切板共用的唯一写法。写成一处的收益很直接：任何一个资源加进来，权限判定不需要重新推演一遍。

`/api/auth/me` 返回的 `permissions` 也来自同一张表（`permissions_for_role`），所以「前端拿到的权限」和「后端校验的权限」不可能不一致。

## 八、分页与过滤：谓词只写一次

全站分页参数只有 `limit` / `offset`：

```python
DEFAULT_PAGE_LIMIT = 20
MAX_PAGE_LIMIT = 100

def pagination(limit: int = Query(20, ge=1, le=100), offset: int = Query(0, ge=0)):
    return limit, offset
```

`has_next` 不靠 `count(*)`，而是多取一条：

```python
rows, has_next = split_page(posts, limit)   # 内部 LIMIT limit + 1
```

省掉一次全表 count，代价只是多取一行。

真正值得说的是过滤谓词的复用。文章列表支持 `q`（标题搜索）、`author`（邮箱前缀）、`author_id`（精确作者，前端「我的」开关用它）：

```python
def _filter_conditions(q, author, author_id=None):
    """共享 q / author / author_id 谓词，让列表与相邻篇永不漂移"""
```

`_filter_conditions` 同时被列表和 `/api/posts/{id}/neighbors` 使用。相邻篇必须在**同一个结果集**里找上一篇/下一篇，否则「筛选后点下一篇文章跳到了集合外」这种缺陷一定会出现。谓词写一处，两个端点就不可能给出不同答案。

还有一个显式的拒绝：

```python
LEGACY_PAGING_PARAMS = ("page", "page_size", "pageSize")
```

调用方传了这三个名字，直接 422，而不是「忽略它们然后返回第一页」——后者会被读成「第二页怎么还是第一页」，是最难查的一类静默错误。

## 九、数据层：11 张表、17 个 migration

| 表 | 用途 |
| --- | --- |
| `users` | 账号、角色、软删除、最后活跃、token 失效戳 |
| `posts` | 文章（`author_id`、`title`、`body_md`） |
| `comments` | 评论（关联文章、作者） |
| `invite_codes` | 邀请码（角色、备注、创建人） |
| `activity_events` | 访问事件（登录批量 + 匿名窗口） |
| `memos` | 个人备忘录（self-scoped） |
| `consumable_items` | 日常消耗品（名称、类别、可选数量/单位、提前提醒天数） |
| `consumable_cycles` | 消耗品周期：一次开封→用完一行，`ended_on IS NULL` 表示进行中 |
| `cache_entries` | 缓存行（key、value、过期时间） |
| `resumes` | HTML 简历（标题、备注、正文、默认标记） |
| `resume_shares` | 简历限时分享：12 位码、过期时间、撤销时间 |

17 个 migration 里只有 `0012_activity_anonymous` 为放开匿名访客重建过 `activity_events`，其余都是纯增量；没有一次全库推倒重建。四处值得记住的做法：

- **迁移只加不删**：`0003_user_soft_delete` 加 `deleted_at`、`0009_token_invalidated_at` 加失效戳、`0010_list_order_indexes` 只加索引。回滚靠「代码兼容旧列」，而不是「数据库回退」。
- **表结构大改时重建再改名**：`0012_activity_anonymous` 先建 `activity_events_v12`、灌数据、再改名，避免在原表上做破坏性 DDL。
- **状态交给约束，不交给接口自觉**：`0016_consumables` 用 partial unique index（`item_id WHERE ended_on IS NULL AND deleted_at IS NULL`）保证一个物品同时只有一轮进行中；并发点两次也写不出两条。`0017_resumes` 同样用 `is_default = 1 AND deleted_at IS NULL` 的 partial unique index 保证全站最多一份默认简历，服务层先清旧再设新，只是让「暂时没有默认」这个窗口可以回退到内置模板。

软删除是统一约定：`posts`、`users`、`memos`、`consumable_items`、`resumes` 都靠 `deleted_at IS NULL` 过滤，列表、相邻篇、权限查询全都要带上这个条件——少写一处，就会出现「删掉的文章还能被翻到」。消耗品的软删还要连带把它的周期一起标记，否则重建同名物品时会带出旧历史；简历软删后分享短链也必须失效，公开读要重新检查 `resumes.deleted_at`。

## 十、缓存与限流：留在同一个数据库

`src/infra/cache.py` 明确用了 Django 的缓存语义：`timeout=None` 永不过期、`timeout=0` 删除、`set` 覆盖、`add` 只在键不存在（或已过期）时创建。读的时候忽略过期行，所以「清理没跑到」只是延迟问题，不是正确性问题。

值的序列化是 `pickle` + `base64`，落到 D1 里是一列 TEXT。文档里写了两条后果：pickle 不是传输格式，只能反序列化自己写进去的数据；payload 对 SQL 不透明，键是唯一句柄，所以要便宜且可推导（`posts:list:v1:20:0`）。

限流用的也是这张表：`record_hit(key, ttl)` 做原子自增，共享剪切板的读接口按「每 IP 60 次/分、每 code 120 次/分」两个固定窗口计数，超了回 429 + `Retry-After`。这样不需要额外的限流服务，也不会因为「先读后写」的竞态把计数算少——`add` 只在上一把键还活着时失败，正好当作互斥。

## 十一、一次真实的读成本治理：账本 + 增量折叠（实测）

分析页最初是「每次请求扫一遍窗口」：`days=7` 与 `days=30` 各查一次 30 天内的 `activity_events`，一次请求读 2–3 万行。免费额度是 5M rows read/天，这个页面刷新十几分钟就能吃掉二十万，属于还没等用户量上来就先烧穿配额的那种设计。

改成账本之后，读路径只剩「一行缓存 + 一条尾巴」：

1. 账本一行存在 `cache_entries`（key `analytics:ledger:v2`，`timeout=None`），内容是 `cursor` + 最近的每日桶 + 每个身份按天拆的明细；
2. 请求时先读账本，再查一次 `MAX(id)`，把 `cursor < id <= MAX(id)` 的增量折叠进内存；
3. 只对请求窗口（7 或 30 天）内的天桶求和后渲染；**暖读不写库**，所以并发刷新不会互相覆盖；
4. 小时级 cron（`0 * * * *`）才真正把账本写回；日更 cron 只做保留清理与墓碑，不再顺手折账本——小时级只差 45 分钟，且管理页读取时本来就会在内存补折尾巴。账本缺失、结构损坏或尾巴超过 500 行时，回落到 `build_summary`（全量重建的参考实现）并把它存下来。

日更清理的取舍：`activity_events` 留 30 天，`memos` 墓碑留 180 天，`consumable_items` / `consumable_cycles` 墓碑留 90 天，`resume_shares` 一旦撤销、过期或指向已软删简历立即删。`users`、`resumes`、`posts`、`comments`、`invite_codes` 永不清理——账号、简历、博客内容与邀请历史都是有价值数据，软删墓碑也保留；简历只删它失效的分享短链，不碰简历正文。

折叠本身是纯函数（`services/analytics_merge.py`，不碰数据库、不读时钟），因此「账本路径」与「参考实现」能逐字段对账；这条断言在 `tests/test_analytics_ledger.py` 里对 `days=7` 与 `days=30` 各做一遍。

线上实测（连续 15 个样本、间隔约 1 分钟，同一份数据）：

| 视图 | 中位耗时 | 范围 | 返回身份数 | 区间浏览总量 |
| --- | --- | --- | --- | --- |
| `days=7` | 651 ms | 345–3144 ms | 25 | 1029 |
| `days=30` | 944 ms | 299–2690 ms | 44 | 1586 |

15/15 全部成功。耗时波动几乎全部来自 Python Worker 冷启动：数据没变，同一组查询仍在 0.3 s ↔ 3.1 s 之间跳，所以这组数字应读成「运行时冷启动成本区间」，而不是「数据量增长曲线」。账本行本身约 **37 KB**（45 个身份 / 11 个日期桶 / 65 个身份-天单元），一次读的成本是一行 `cache_entries` 加一小段尾巴，而不是两万行事件。

这轮实测还抓到一个只有对账才会暴露的缺陷：旧账本（v1）的访客明细只存「窗口内累计」，7 天视图因此报了 30 天的数字（单个身份 API 显示 183，参考口径 176），而序列与今日块都是对的——错的是结构不是算法。修法是把访客明细按「身份 × 按天」存，渲染时按窗口求和，并把 key 从 `v1` 换成 `v2`（换后缀就是迁移：旧行被忽略，下一次读取自动重建）。

还有一个附带观察，属于数据口径而不是代码：`dwell_ms` 来自 `page_leave` 的 `duration_ms`，一个挂了一夜的标签页会诚实地报出 9 小时停留。要拿它做任何判断，前端得先给单次时长设上限。

## 十二、部署：一次真实的回滚事故

部署方式是 `uv run --frozen pywrangler deploy`，环境变量 `UV_PROJECT_ENVIRONMENT` 指到临时 venv 里，依赖按 lock 装。

踩过的坑值得写下来：有一次从**本地落后于远端的仓库**直接 deploy，结果把已经上线的 clips 新功能覆盖回了旧版本。原因不是 pywrangler 有问题，而是「部署产物 = 当前工作区」，工作区旧了，产物就旧了。现在的规矩是：**部署前先对齐远端分支，只从干净的最新提交打补丁**。

迁移与代码的发布顺序也有约束：先上兼容新旧两种 schema 的代码，再跑 migration，最后才删旧列/旧分支逻辑。D1 的 migration 是顺序执行的，`wrangler d1 migrations apply` 记录已执行版本，所以文件名一旦发布就不能改。

## 十三、热点与技术债

按行数，最大的三个文件是 `api/models.py`（787 行）、`api/routers/consumables.py`（512 行）、`api/routers/admin.py`（394 行）。`src/services` 仍是分析这条线最厚的地方（约 930 行，分在 SQL、账本编排、纯折叠三个文件里），读改任何一处都要同时看另外两个。

- `models.py` 787 行全是请求/响应模型与校验规则，行数多但结构单一，属于「长而可读」，暂不动。
- `admin.py` 已从 470 行收到 394 行：邀请码三个端点拆到 `routers/invites.py`（96 行），路径仍是 `/api/admin/invite-codes`，URL 未变；剩下的用户管理、活动日志、分析汇总继续留在这里。
- `consumables.py` 512 行装物品 CRUD、周期、用完确认；三块共享同一套物品/周期模型，暂时合在一起比利大于弊，等下一个消耗品功能再评估。
- `posts.py` 的 `_filter_conditions` 已经复用，但列表与相邻篇仍是两段 SQL；如果再加「按标签筛选」，谓词复用是唯一不会漂移的写法。

真正需要盯的不是行数，而是**契约漂移**：前端 `src/constants.ts` 里那些数字（分页 20、正文 2000、标题 200、评论 5000、剪切板 20000）每一个都对应后端一处约束，改后端忘了改前端，症状是 422 或者前端截断。这条现在由前端 CI 的 `scripts/check-contract.mjs` 逐项比对挡住——但它只挡前端一侧，后端单独改模型时后端仓库不会红。

## 小结

这个后端没有复杂的东西，只有几个「只允许一个出口」的决定：入口只做 glue、错误只有一种形状、权限只有一张码表、所有权判定只有一个函数、分页谓词只有一处、缓存只有一张表。规模翻一倍时，这些约束比任何框架特性都更能挡住腐化。
