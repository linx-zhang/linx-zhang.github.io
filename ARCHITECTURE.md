# 前端架构与维护边界

这份文档说明**页面、组件、数据层怎么分，改动该放哪里，哪些依赖已经由脚本挡住**。
上线流程和命令看 `AGENTS.md`，产品级说明看 `README.md`，知识库写作规则看 `README.md` 的「文档渲染机制」。

## 1. 运行时形状

```
Vite 构建 ──► docs/ ──► GitHub Pages（静态托管）
                         │  深链 404
                         ▼
              public/404.html 记录路径 → / → BrowserRouter 恢复
                         │
                         ▼
              React 页面 ──► src/api/* ──► Pages 代理 linx-api-78i.pages.dev
                                             ──► Cloudflare Worker /api/*
```

前端不认 D1，也不拼 SQL；只认后端统一的 `{code, detail, data}`。所有业务路径都从 `src/api/client.ts` 的 `API_ROOT` 拼，不要用 `API_BASE` 直接拼 `/api` 以外的路径。

## 2. 源目录分层

| 层 | 目录 | 负责 | 不该做 |
|---|---|---|---|
| 装配 | `main.tsx`、`routes.ts` | Provider、路由、深链恢复、懒加载 | 业务状态、请求细节 |
| 页面 | `pages/*` | 一屏的编排、表单、交互、页面内状态 | 被别的层反向依赖 |
| 通用 UI | `components/*` | 可复用弹窗、选择器、编辑器、布局、空态 | 依赖具体页面 |
| 状态机 | `hooks/*` | `useResource` / `usePagedList` / `useInfiniteList` / 复制 | 依赖具体页面或视觉 |
| 数据 | `api/*` | 请求函数、响应类型、错误判定 | 依赖 React、组件、页面 |
| 横切 | `auth/*`、`activity/*` | 登录态/权限码、访问采集 | 依赖具体页面 |
| 工具 | `utils/*` | 日历、农历、格式化、Markdown 编辑、剪贴板 | 依赖任何上层 |
| 样式 | `styles/*`、各目录 `*.css` | 全局层叠、局部样式 | 用组件状态做选择器 |

页面内部允许再拆「同目录私有文件」（例如 `pages/Space/` 下的 `memoSort.ts`、`consumableFormat.ts`、`useConsumables.ts`），它们不是公共层，不要求被别处复用。

## 3. 依赖方向（CI 已强制）

`scripts/check-layers.mjs` 扫描 `src` 的静态 import，规则：

- `utils` 不能依赖 `api/auth/components/hooks/activity/pages`；
- `api` 不能依赖 `auth/components/hooks/activity/pages`；
- `hooks` 不能依赖 `components/pages`；
- `components` 不能依赖 `pages`；
- `auth`、`activity` 不能依赖 `pages`。

`pages` 可以依赖所有层；`main.tsx` 是组合根，不受限。同层依赖允许。
运行：

```powershell
npm run check:layers
```

CI 在 `npm run lint` 之后跑这一步。它挡的是「底层为了省事反向 import 页面」这种后期最难拆的依赖，不替代 code review。

## 4. 一次页面加载的数据流

1. `main.tsx` 装配 `ErrorBoundary → AuthProvider → ActivityTracker → Routes`。
2. 页面从 `hooks/` 拿状态机，从 `api/` 拿请求函数，不直接 `fetch`。
3. `api/client.ts` 统一加 token、解析 envelope、把非 2xx 变成 `ApiError`。
4. 页面用 `errorMessage()` 把错误转成中文；详情页可用 `treat404AsMissing` 把 404 当「不存在」。
5. 列表统一 `{items, has_next}`；「下一页」只看 `has_next`，不用 `total` 推算。

### 简历页的两个入口

| 路径 | 数据源 | 失效行为 |
|---|---|---|
| `/profile` | `GET /api/resumes/current` | 无默认简历或接口异常时回退 `utils/resumeTemplate.ts` |
| `/r/<code>` | `GET /api/resumes/shared/<code>` | 过期 / 撤销 / 简历删除一律 404，页面提示链接失效，不回落模板 |

两者都从 `api/resumes.ts` 取数据，正文渲染前统一过 `utils/resumeHtml.ts` 的标签/类名白名单；后台编辑器预览走同一函数。

### 三个列表 hook 怎么选

| hook | 场景 | 关键行为 |
|---|---|---|
| `useResource` | 单对象 / 一次性数据（详情、分析摘要） | 四态、`enabled`、404 可选 |
| `usePagedList` | 传统分页（用户、文章、日志、邀请码、简历） | 受控页码、`has_next`、翻页保留筛选 |
| `useInfiniteList` | 追加式列表（备忘录列表） | 首屏 + 追加、去重、删除后就地更新 |

不要在页面里另写一套 `loading/error` 布尔组合；四态语义已经在 `src/types` 统一。

## 5. 登录态与权限

- `AuthProvider` 负责 token 恢复、`/auth/me`、登录弹窗、权限码数组；`AuthModal` 目前由 Provider 直接渲染。
- `usePermission(code)` 只判断权限码，不判断角色；角色到权限码的映射在后端，前端不要复制角色矩阵。
- `RequirePermission anyOf={ADMIN_AREA_PERMISSIONS}` 是后台总入口；分区自己的权限在 `pages/Admin` 内部再判。
- `RootLayout` 里的「管理后台」入口也看 `ADMIN_AREA_PERMISSIONS`，六选一，不是只认 admin。

## 6. 访问采集

`activity/useActivityTracker.ts` 是唯一采集入口：

- 公开页面的匿名访问走 `visitorBudget` 本地窗口；登录用户按服务端节流。
- `page_leave` 在匿名场景发出后，本地先按「可能接受」推进窗口；服务端可能回 429，最坏只是少报一次，不会重复轰炸。
- 活动只上报 `page_view` / `heartbeat` / `page_leave`，路径白名单在服务端 `services/visitor_paths.py`。
- 改节流窗口要同时改后端 `src/api/routers/activity.py` 与 `src/constants.ts` 的契约常量。

## 7. 样式归属

- 全局层叠只在 `styles/layers.css`、`styles/shared.css`；页面/组件样式就近 `import './xxx.css'`。
- 一个页面只有一块样式时，允许 `Page.css` 单文件（Admin、Blog 现在如此）；工具箱是 `Tools.css` 外壳 + 每个工具自己的 `XxxTool.css` 就近 `import`。
- 当页面出现多个互不相关的区域、单文件超过约 500 行时，按区域拆（`pages/Space/` 已拆成 `Space.css` 外壳 + `SpaceMemos.css` / `SpaceConsumables.css` / `SpaceCalendar.css`）。
- 不引入颜色变量：颜色直接写 hex 是既有取舍，不要为了「主题化」重写全站 CSS。
- 打印：所有不该出现在 PDF 的元素加 `no-print`；`Profile.css` 负责 A4 页面规则，简历正文排版在 `styles/resume.css`，后台编辑器预览复用同一份。

## 8. 知识库产物

- 源文件只在 `raw-docs/`；`public/wiki/` 与 `public/wiki-files/` 是 `scripts/build-wiki.mjs` 的生成物，不入库。
- `.md` 运行时渲染；只有完整应用页才用 `.html`（iframe + 全屏）。
- `docs/` 是构建产物，`.gitignore` 已忽略；发布由 GitHub Actions 的 artifact 直出。
- 新增/删除文档后跑 `npm run wiki`，`dev` / `build` 会自动触发。

## 9. 改动落在哪

### 新增页面

1. `src/pages/<Name>/index.tsx` + 局部 CSS。
2. `src/routes.ts` 加常量；`src/main.tsx` 加路由（首屏页静态导入，深层页 `lazy`）。
3. 如果是深链，确认 `isKnownDeepLink()` 已覆盖；Pages 的 404 兜底只恢复已知路径。
4. 页面级测试放同目录 `*.test.tsx`，不要新建全局测试目录。

### 新增接口绑定

1. `src/api/<resource>.ts`：请求函数 + 导出类型。
2. `src/api/client.ts` 的 `request()` 已统一 envelope，不要自己 `fetch`。
3. 错误码映射放 `src/api/errors.ts`；不要在各页面重复字符串判断。
4. 后端契约变化时先 deploy 后端，再 push 前端；列表形状变化属于同批上线。

### 新增工具

1. `src/pages/Tools/<Name>Tool.tsx`。
2. `src/pages/Tools/index.tsx` 的 `TOOLS` 注册表加一条（slug、标题、说明、组件）。
3. 本地计算工具不要发请求；共享剪切板才走后端，且凭据只能是随机码本身。
4. `Tools.css` 只在必要时加区域样式；能复用 `components/` 就不要新造控件。

### 新增后台分区

1. `src/pages/Admin/<Name>Tab.tsx`。
2. `src/pages/Admin/index.tsx` 的 tab 注册与权限判断。
3. 复用 `usePagedList` / `ListState` / `Select` / `ConfirmDialog`，不要另起一套表格状态。
4. 需要新权限码时，后端 `core/permissions.py` 与前端 `auth/adminAccess.ts` 同步。

### 新增列表页

1. 先判断用 `usePagedList` 还是 `useInfiniteList`。
2. 服务端只回 `{items, has_next}`；前端不发 `limit+1`、不自己切片。
3. 空态、错误态、加载态用 `ListState`；不要在页面里手写三套骨架。

## 10. 测试地图

| 范围 | 位置 |
|---|---|
| API client / 错误 | `src/api/*.test.ts` |
| 通用 hooks | `src/hooks/*.test.tsx` |
| 通用组件 | `src/components/**/*.test.tsx` |
| 页面行为 | `src/pages/**/*.test.tsx` |
| 纯工具 | `src/utils/*.test.ts` |

`npm test` 是 vitest run；`npm run lint` 是 oxlint。当前 33 个测试文件、286 例，构建前 CI 会全跑。

## 11. 已知的、刻意保留的债

- `AuthProvider` 直接渲染 `components/AuthModal`，`components/AuthMenu` 又依赖 `auth`；这是 auth 与通用 UI 的层间环，运行时无碍，但拆 auth 时要一起动。要彻底解环，需要把弹窗改成由布局层注入。
- `pages/Tools/Tools.css`（约 1333 行）只保留工具箱入口 / 页头 / 共用表单骨架，工具页样式已按组件拆分；`pages/Admin/Admin.css`（约 1205 行）仍是单文件，在出现第三个独立区域或频繁冲突时再拆。简历分区已单独拆出 `pages/Admin/ResumeAdmin.css`。
- `pages/Space/SpaceMemos.tsx`（约 630 行）同时管列表、日历、编辑器三种视图；拆之前先用现有测试锁行为。
- `api/*.ts` 的响应类型是手写的，没有从 OpenAPI 生成；契约靠后端 `docs/api.md` + 前端 `check-contract.mjs`。
- `MarkdownView` 是最大的懒加载块（约 918KB），不要把它拖回主包。
- 请求没有全局超时；长请求靠页面状态机与用户操作兜底。

## 12. 相关文档

- `README.md`：功能、目录、文档渲染、维护清单。
- `AGENTS.md`：上线命令、CI、契约常量、线上口径。
- `raw-docs/project/frontend.md`：写给读者的工程叙事，不是操作手册。
- 后端仓库 `ARCHITECTURE.md`：API/服务/基础设施的分层与请求生命周期。
