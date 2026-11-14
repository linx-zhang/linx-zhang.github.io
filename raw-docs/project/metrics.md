---
pin: 4
---

# 代码量与复杂度：这个个人站的真实体量

写这个站的过程中，最容易骗自己的是「感觉」：感觉前端挺大了、感觉后端挺简单。这篇把「感觉」换成数字——全部按真实仓库统计，前端取 `src/`，后端取干净的部署分支工作区，构建产物取最近一次 `npm run build` 的结果。

**口径说明**：行数含空行与注释（不做有效代码折算，因为它更接近维护者实际要读的量）；后端统计排除 `.venv`、`python_modules` 这类依赖目录，只算 `src`、`migrations`、`scripts`；构建体积取 `docs/assets/` 下的实际文件大小。数字会随迭代变化，结论（比例与热点）比绝对值更值得记住。

## 一、总量

| 侧 | 文件 | 行数 |
| --- | --- | --- |
| 前端 `src/` | 98 | 14979 |
| 前端 `scripts/`（构建脚本） | 3 | 421 |
| 后端（`src` + `migrations` + `scripts`） | 50 | 4602 |
| 合计 | 151 | 20002 |

前后端行数比 **3.25 : 1**（14979 : 4602）。这个比例很能说明性格：这是一个「以界面为主」的项目，后端只负责把数据写进 D1 再读出来，没有复杂的领域模型。

## 二、前端：98 个文件怎么分布

按目录：

| 目录 | 行数 | 占比 | 内容 |
| --- | --- | --- | --- |
| `pages` | 9254 | 61.8% | 七个页面 + 后台五个分区 + 五个工具 |
| `components` | 3747 | 25.0% | 19 个自研组件 |
| `api` | 726 | 4.8% | 7 个模块：client / auth / blog / admin / memos / clips / errors |
| `hooks` | 382 | 2.6% | `useCopy` / `useInfiniteList` / `usePagedList` / `useResource` |
| `utils` | 277 | 1.8% | 日历、剪贴板、文档索引、格式化、Markdown 编辑 |
| `activity` | 212 | 1.4% | 事件采集与上报 |
| 根目录 | 175 | 1.2% | `main.tsx`、`routes.ts`、`constants.ts`、`types.ts` 等 |
| `auth` | 134 | 0.9% | Provider 与权限 hook |
| `styles` | 72 | 0.5% | `layers.css` + `shared.css` |

按扩展名：

| 类型 | 文件 | 行数 |
| --- | --- | --- |
| `.tsx` | 45 | 7585 |
| `.ts` | 28 | 2097 |
| `.css` | 25 | 5297 |

样式占了前端的 **35.4%**——这个比例在「没有 UI 库」的项目里是正常的：按钮、下拉、日期面板、弹窗、表格、后台五分区全靠自己的 CSS。

## 三、后端：50 个文件、4602 行、33 个端点

按目录：

| 目录 | 行数 | 占比 |
| --- | --- | --- |
| `src/api` | 2506 | 54.5% |
| `scripts/agent`（冒烟/运维脚本，不进 Worker） | 493 | 10.7% |
| `src/infra` | 398 | 8.6% |
| `src/core` | 385 | 8.4% |
| `src/services` | 341 | 7.4% |
| `src/tasks` | 112 | 2.4% |
| 根（`entry.py` 等） | 89 | 1.9% |

路由分布（33 个端点）：

| 文件 | 行数 | 端点 | 说明 |
| --- | --- | --- | --- |
| `routers/admin.py` | 467 | 9 | 用户管理 + 邀请码 + 批量删除 |
| `routers/posts.py` | 306 | 7 | 列表/详情/新建/修改/删除/相邻篇 |
| `routers/activity.py` | 210 | 2 | 登录批量上报 + 匿名窗口 |
| `routers/auth.py` | 176 | 5 | 登录/注册/me/改密码/退出 |
| `routers/clips.py` | 197 | 3 | 创建/读/删 |
| `routers/memos.py` | 173 | 5 | 备忘录 CRUD |
| `routers/comments.py` | 153 | 2 | 发评论 / 删评论 |

数据侧：**7 张业务表**（`users`、`posts`、`comments`、`invite_codes`、`activity_events`、`memos`、`cache_entries`）、**13 个 migration**、全部增量式，无一次推倒重建。

## 四、依赖与产物

运行时依赖 **12 个**，devDependencies **7 个**：

| 依赖 | 用途 |
| --- | --- |
| `react` / `react-dom` | 19.x |
| `react-router-dom` | 路由 |
| `react-markdown` / `rehype-raw` / `rehype-prism-plus` | 阅读与写作预览 |
| `remark-frontmatter` / `remark-gfm` | frontmatter 处理与表格支持 |
| `sql-formatter` | SQL 工具，按需加载 |
| `github-markdown-css` / `prism-themes` | 正文与代码高亮样式 |
| `react-to-print` | 简历导出 PDF |

没有一个 UI 组件库、没有一个状态管理库、没有一个数据请求库。这三样通常是包体积的大头，这里全都换成了手写实现——代价是 `pages` 与 `components` 的行数，收益是依赖数量和升级风险。

构建产物：

| 类别 | 文件数 | 体积 |
| --- | --- | --- |
| JS chunk | 13 | 1584.8 KB |
| CSS | 6 | 103.0 KB |

其中 `MarkdownView-*.js` 917.8 KB，占 JS 总量 **57.9%**；首屏主包 `index-*.js` 336.8 KB 占 21.3%。也就是说，**接近六成的 JS 是「只有读文章/写文章时才需要」的 Markdown 栈**，它被完整地关在懒加载边界后面。

## 五、复杂度热点

按单文件行数排（前后端合并）：

| 文件 | 行数 | 性质 |
| --- | --- | --- |
| `pages/Admin/Admin.css` | 1186 | 后台五分区共用样式 |
| `pages/Tools/Tools.css` | 788 | 工具箱列表 + 五个工具页 |
| `pages/Space/Space.css` | 632 | 备忘录列表、表单、筛选 |
| `pages/Blog/Blog.css` | 570 | 列表 + 详情 + 写作面板 |
| `pages/Space/index.tsx` | 537 | 列表 + 筛选 + 表单 + 删除确认 |
| `api/models.py` | 478 | 请求/响应模型 |
| `pages/Blog/PostDetail.tsx` | 472 | 正文 + 评论 + 上下篇 |
| `routers/admin.py` | 467 | 9 个管理端点 |
| `pages/Blog/index.tsx` | 398 | 列表 + 筛选 + 写作入口 |

两个观察：

1. **样式是行数大户，但结构简单**。`Admin.css` 单文件 1186 行，平均每行都是选择器或声明，没有嵌套逻辑，读起来累但改起来不危险。真正难的是 `Space/index.tsx` 537 行：里面同时有列表状态、筛选、新建/编辑表单、到期日、删除确认五条逻辑线。
2. **后端最大的两个文件性质完全不同**。`models.py` 是「长而可读」（全是声明），`admin.py` 是「长而该拆」（9 个端点挤一个文件，邀请码那三个完全可以独立）。

局部密度：`src` 里 120 个 `useState`、31 个 `useEffect`，分布在 45 个 `.tsx` 里，平均每个组件不到 3 个状态——说明没有把全局状态堆到一个 store 里。`aria-*` 出现 98 次，无障碍不是补丁式加上的。

## 六、结构性指标：唯一出口的数量

规模之外，更值得数的是「同一件事有几份实现」。这个站的答案是刻意压到 1：

| 结构 | 实现数量 | 位置 |
| --- | --- | --- |
| HTTP 请求入口 | 1 | `api/client.ts`（`src` 内 `fetch` 共 5 处，其中 2 处是 activity beacon、3 处是静态资源，接口请求全部走 client） |
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
| P1 | `Space/index.tsx` 537 行 | 表单状态与提交逻辑混在页面里 | 抽一个 `useMemoEditor`，页面只留编排；这是目前最值得动的一处 |
| P1 | `routers/admin.py` 467 行 / 9 端点 | 用户管理与邀请码同文件 | 拆 `routers/invites.py`，URL 不用变 |
| P1 | 跨仓常量漂移 | `src/constants.ts` 与后端约束各写一份 | 有注释与冒烟脚本兜底，但没有自动校验；改后端忘了改前端会 422 |
| P2 | `Admin.css` 1186 行 | 五分区共用一个文件 | 目前靠注释分节，暂不拆——拆成多文件后按需加载会让后台首屏多出若干请求 |
| P2 | 文章列表与相邻篇两段 SQL | 谓词已复用，SQL 仍分开 | 再加筛选维度时容易只改一处 |
| P2 | 构建脚本 3 文件 421 行 | `build-docs` / `build-wiki` / 404 兜底 | 逻辑集中，注释齐全，属于健康区 |
| P3 | 无自动化测试 | 靠 19 条冒烟脚本 + 手测 | 单人项目可接受，但 `usePagedList` 的竞态逻辑值得补几条单测 |

## 八、结论

- **体量**：两万行、151 个文件、12 个运行时依赖、33 个端点、7 张表。属于「一个人能完整持有」的规模，任何一处改动都能在半天内评估完影响面。
- **重心**：61.8% 的前端代码在页面层，35.4% 是样式，组件层只占 25%——这是「页面驱动」而不是「组件库驱动」的形态，与自研控件的选择一致。
- **复杂度**：热点集中在两个文件（`Space/index.tsx`、`routers/admin.py`）和两处结构性成本（跨仓常量、无自动化测试）。没有隐藏的深坑：没有全局 store、没有循环依赖、没有第二套请求实现。
- **扩展成本**：新增页面 ≈ 1 条路由 + 1 个 api 函数 + 1 个目录；新增后端资源 ≈ 1 个 router + 1 组模型 + 1 个 migration。这个成本没有随代码量上升而变差，是这套结构最值钱的地方。
