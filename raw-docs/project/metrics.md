---
pin: 4
---

# 代码量与复杂度：这个个人站的真实体量

写这个站的过程中，最容易骗自己的是「感觉」：感觉前端挺大了、感觉后端挺简单。这篇把「感觉」换成数字——全部按真实仓库统计，前端取 `src/`，后端取干净的部署分支工作区，构建产物取最近一次 `npm run build` 的结果。

**口径说明**：行数含空行与注释（不做有效代码折算，因为它更接近维护者实际要读的量）；后端统计排除 `.venv`、`python_modules` 这类依赖目录，只算 `src`、`migrations`、`scripts`；构建体积取 `docs/assets/` 下的实际文件大小。数字会随迭代变化，结论（比例与热点）比绝对值更值得记住。

## 一、总量

| 侧 | 文件 | 行数 |
| --- | --- | --- |
| 前端 `src/` | 119 | 19951 |
| 前端 `scripts/`（构建脚本） | 5 | 644 |
| 后端（`src` + `migrations` + `scripts`） | 55 | 5540 |
| 合计 | 179 | 26135 |

前后端行数比 **3.60 : 1**（19951 : 5540）。这个比例很能说明性格：这是一个「以界面为主」的项目，后端只负责把数据写进 D1 再读出来，没有复杂的领域模型。

（后端另有 `tests/` 7 个文件 1469 行、113 个用例，不计入上表——它是验证代码，不是运行时代码。）

## 二、前端：119 个文件怎么分布

按目录：

| 目录 | 行数 | 占比 | 内容 |
| --- | --- | --- | --- |
| `pages` | 11856 | 59.4% | 九个页面 + 后台五个分区 + 七个工具 |
| `components` | 4741 | 23.8% | 19 个自研组件（组件目录与样式文件各算一份） |
| `api` | 888 | 4.5% | 7 个模块 + 请求层单测：client / auth / blog / admin / memos / clips / errors |
| `utils` | 724 | 3.6% | 日历、农历、剪贴板、文档索引、格式化、Markdown 编辑 |
| `hooks` | 702 | 3.5% | 4 个 hook + 3 个测试文件 |
| `activity` | 552 | 2.8% | 事件采集与上报（含匿名窗口预算与去重） |
| 根目录 | 182 | 0.9% | `main.tsx`、`routes.ts`、`constants.ts`、`types.ts` 等 |
| `auth` | 152 | 0.8% | Provider、权限 hook、后台入口权限集合 |
| `styles` | 72 | 0.4% | `layers.css` + `shared.css` |
| `types` | 53 | 0.3% | 跨模块共用类型 |
| `test` | 29 | 0.1% | vitest setup |

按扩展名：

| 类型 | 文件 | 行数 |
| --- | --- | --- |
| `.tsx` | 53 | 9471 |
| `.ts` | 41 | 3859 |
| `.css` | 25 | 6621 |

样式占了前端的 **33.2%**——这个比例在「没有 UI 库」的项目里是正常的：按钮、下拉、日期面板、弹窗、表格、后台五分区全靠自己的 CSS。

## 三、后端：38 个 py 文件、5529 行、41 个路由装饰器（+ 根路由 = 42 个端点）

按目录：

| 目录 | 行数 | 占比 |
| --- | --- | --- |
| `src/api` | 2509 | 45.3% |
| `src/services` | 1098 | 19.8% |
| `scripts`（冒烟/运维/文档校验，不进 Worker） | 575 | 10.4% |
| `src/core` | 426 | 7.7% |
| `src/infra` | 398 | 7.2% |
| `migrations` | 254 | 4.6% |
| `src/tasks` | 218 | 3.9% |
| 根（`entry.py`） | 62 | 1.1% |

路由分布：

| 文件 | 行数 | 端点 | 说明 |
| --- | --- | --- | --- |
| `routers/admin.py` | 470 | 9 | 用户管理 + 邀请码 + 活动日志 + 分析汇总 |
| `routers/posts.py` | 306 | 7 | 列表/详情/新建/修改/删除/批量删/相邻篇 |
| `routers/activity.py` | 210 | 2 | 登录批量上报 + 匿名窗口 |
| `routers/clips.py` | 197 | 3 | 创建/读/删 |
| `routers/auth.py` | 176 | 5 | 登录/注册/me/改资料/退出 |
| `routers/memos.py` | 173 | 5 | 备忘录 CRUD + 汇总 |
| `routers/comments.py` | 152 | 3 | 评论列表 / 发评论 / 删评论 |

每个端点的鉴权、请求与响应形状不再重复列在这里，唯一真源是后端仓库的 `docs/api.md`（`python scripts/check-api-doc.py` 会核对它有没有漏写路由）。

数据侧：**9 张业务表**（`users`、`posts`、`comments`、`invite_codes`、`activity_events`、`memos`、`cache_entries`、`consumable_items`、`consumable_cycles`）、**16 个 migration**、全部增量式，无一次推倒重建。

## 四、依赖与产物

运行时依赖 **14 个**，devDependencies **10 个**（其中 `vitest` / `@testing-library/react` / `jsdom` 三个只服务于单测，不进产物）：

| 依赖 | 用途 |
| --- | --- |
| `react` / `react-dom` | 19.x |
| `react-router-dom` | 路由 |
| `react-markdown` / `rehype-raw` / `rehype-prism-plus` | 阅读与写作预览 |
| `remark-frontmatter` / `remark-gfm` | frontmatter 处理与表格支持 |
| `sql-formatter` | SQL 工具，按需加载 |
| `hash-wasm` | 文件哈希工具，WASM 直到开始算才加载 |
| `github-markdown-css` / `prism-themes` | 正文与代码高亮样式 |
| `lunar-javascript` | 万年历的农历、节气、节日与法定放假 / 调休数据 |
| `react-to-print` | 简历导出 PDF |

没有一个 UI 组件库、没有一个状态管理库、没有一个数据请求库。这三样通常是包体积的大头，这里全都换成了手写实现——代价是 `pages` 与 `components` 的行数，收益是依赖数量和升级风险。

构建产物：

| 类别 | 文件数 | 体积 |
| --- | --- | --- |
| JS chunk | 18 | 2127.2 KB |
| CSS | 5 | 118.1 KB |

其中 `MarkdownView-*.js` 917.8 KB，占 JS 总量 **43.1%**；首屏主包 `index-*.js` 652.7 KB 占 30.7%。也就是说，**一半的 JS 是「只有读文章/写文章时才需要」的 Markdown 栈**，它被完整地关在懒加载边界后面。

## 五、复杂度热点

按单文件行数排（前后端合并）：

| 文件 | 行数 | 性质 |
| --- | --- | --- |
| `pages/Tools/Tools.css` | 1298 | 工具箱列表 + 七个工具页 |
| `pages/Admin/Admin.css` | 1201 | 后台五分区共用样式 |
| `api/models.py` | 678 | 全资源请求 / 响应模型 |
| `pages/Blog/Blog.css` | 604 | 列表 + 详情 + 写作面板 |
| `pages/Space/SpaceMemos.tsx` | 588 | 列表 / 月历共用取数 + 输入区 + 就地编辑 |
| `api/routers/consumables.py` | 512 | 物品、周期与用完确认 |
| `pages/Blog/PostDetail.tsx` | 503 | 正文 + 评论 + 上下篇 |
| `pages/Space/SpaceConsumables.css` | 499 | 消耗品看板样式 |
| `components/DateRangePicker/index.tsx` | 483 | 日期范围面板：双月网格 + 快捷项 + 键盘 |
| `pages/Space/SpaceMemos.css` | 472 | 备忘录列表、输入区、就地编辑 |
| `api/routers/admin.py` | 394 | 用户管理 + 活动日志 + 分析汇总 |

两个观察：

1. **样式是行数大户，但结构简单**。`Admin.css` 单文件 1201 行，平均每行都是选择器或声明，没有嵌套逻辑，读起来累但改起来不危险。个人空间拆完后，样式热点不再集中在单个文件：最大的 `SpaceConsumables.css` 只有 499 行。前端最大的逻辑文件是 `SpaceMemos.tsx` 588 行；原来的 916 行消耗品组件已拆成 `useConsumables.ts` + 表单 / 单卡 / 详情三块，页面只剩 133 行编排。
2. **后端最大的文件性质不同**。`models.py` 678 行是「长而可读」（全是声明），`consumables.py` 512 行与 `admin.py` 394 行是「长而该继续拆」；邀请码三个端点已独立成 `invites.py`（96 行），URL 未变。

局部密度：`src` 里 206 个 `useState`、41 个 `useEffect`，分布在 53 个 `.tsx` 里，平均每个组件不到 4 个状态——说明没有把全局状态堆到一个 store 里。`aria-*` 出现 142 次，无障碍不是补丁式加上的。

## 六、结构性指标：唯一出口的数量

规模之外，更值得数的是「同一件事有几份实现」。这个站的答案是刻意压到 1：

| 结构 | 实现数量 | 位置 |
| --- | --- | --- |
| HTTP 请求入口 | 1 | `api/client.ts`（`src` 内 `fetch` 共 4 处，其中 2 处是 activity beacon、2 处是静态资源，接口请求全部走 client） |
| 列表分页语义 | 2 | `usePagedList`（替换）/ `useInfiniteList`（追加） |
| 列表三态占位 | 1 | `components/ListState` |
| 浮层定位与关闭 | 1 | `useFloatingPanel` |
| 权限判定（后端） | 1 | `core/permissions.py` 的码表 + `has_permission` |
| 所有权判定 | 1 | `ensure_resource_permission` |
| 分页参数校验 | 1 | `api/deps.py` 的 `pagination` / `reject_legacy_paging` |
| 错误信封 | 1 | `api/responses.py` 的 `install_error_handlers` |
| 缓存实现 | 1 | `infra/cache.py`（D1 表） |
| 前后端共用常量 | 1 | `src/constants.ts` |

这张表是「可扩展性」的实际度量：新增一个列表页只需要「一条路由 + 一个 api 函数 + 一个页面目录」，不需要重新发明加载态、错误态、分页、权限门。新增一个后端资源也是同样的路径。

## 七、技术债清单

按影响面排序，不是按行数：

| 优先级 | 项 | 现状 | 说明 |
| --- | --- | --- | --- |
| P2 | `Admin.css` 1201 行 | 五分区共用一个文件 | 目前靠注释分节，暂不拆——拆成多文件后按需加载会让后台首屏多出若干请求 |
| P2 | `api/models.py` 678 行 | 全资源模型同文件 | 全是声明、无逻辑，按资源拆只改善定位；等下一次大改再动 |
| P2 | 跨仓常量漂移 | `src/constants.ts` 与后端约束各写一份 | CI 已加 `check-contract.mjs` 对 10 项逐项比对；后端单独改仍要等前端 push 才暴露 |
| P2 | 文章列表与相邻篇两段 SQL | 谓词已复用，SQL 仍分开 | 再加筛选维度时容易只改一处 |
| P3 | 页面级测试仍空缺 | 已有 144 例单测（16 个文件）+ CI 闸门 | 覆盖的是「最容易静默出错」的逻辑；页面交互仍靠冒烟脚本与手测 |

## 八、结论

- **体量**：前端约一百个 ts/tsx、28 个 CSS；后端 38 个 py 文件 5529 行、**42 个端点**（41 个路由装饰器 + 根路由）、**9 张业务表**、**16 个 migration**。属于「一个人能完整持有」的规模，任何一处改动都能在半天内评估完影响面。
- **重心**：59.4% 的前端代码在页面层，33.2% 是样式，组件层只占 23.8%——这是「页面驱动」而不是「组件库驱动」的形态，与自研控件的选择一致。
- **复杂度**：热点集中在 `SpaceConsumables.tsx`（五件事同文件）与 `routers/admin.py`（9 端点同文件），外加一处结构性成本（跨仓常量靠契约脚本兜底）。没有隐藏的深坑：没有全局 store、没有循环依赖、没有第二套请求实现。测试与 CI 兜住了最容易静默出错的那几层（请求解包、分页 hook、权限门、常量漂移），页面交互仍靠手测。
- **扩展成本**：新增页面 ≈ 1 条路由 + 1 个 api 函数 + 1 个目录；新增后端资源 ≈ 1 个 router + 1 组模型 + 1 个 migration。这个成本没有随代码量上升而变差，是这套结构最值钱的地方。
