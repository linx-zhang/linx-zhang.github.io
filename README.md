<!-- [LLM SYSTEM INSTRUCTION & CONTEXT] -->
<!--
You are a senior full-stack/frontend engineer maintaining this repository.
- Repo: linx-zhang.github.io
- Stack: Vite 8（Rolldown）+ React 19.3.1 + TypeScript（verbatimModuleSyntax）+ react-router-dom 7.18.5（BrowserRouter / Routes / Route 的 v6 风格 API）
- Deployment: GitHub Pages from branch 'main', folder '/docs'（vite config: build.outDir = 'docs'、emptyOutDir = true、base = '/'）。SPA 深链刷新由 public/404.html 兜底：把原始路径写入 sessionStorage.spa-fallback-path 后回到根路径，src/main.tsx 在 BrowserRouter 初始化前用 history.replaceState 恢复；`docs/.nojekyll` 由 `scripts/build-docs.mjs` 每次构建生成（关掉 GitHub Pages 的 Jekyll，否则 md 会被再渲染一份同名 html），不要手工删。
- Backend: Cloudflare Python Worker + FastAPI + D1，base 常量在 src/api/auth.ts 的 AUTH_API_BASE。响应统一为 { code, detail, data }，前端 request<T>() 解包 data；错误抛 ApiError(status, code, detail)。
- Core Routes（定义在 src/routes.ts 与 src/main.tsx）:
  - / : Home（RootLayout 内）
  - /wiki : DocsHome（RootLayout -> WikiLayout）
  - /wiki/* : Docs 文档详情（多级 slug）
  - /blog : Blog 列表 + 页内写作面板
  - /blog/:id : PostDetail 文章详情与评论
  - /admin : 管理后台，RequirePermission 守卫 invite_code:read:any；分区通过 ?tab=posts|invites|users|activity 深链（默认 posts）
  - /profile : 独立简历页（不套 RootLayout，A4 打印优化）
- Auth: 登录/注册成功后 token 存 localStorage（blog_access_token）；AuthProvider 启动时拉 GET /auth/me 获取 user + permissions，并监听 window 的 auth:unauthorized 事件清理登录态。request() 对 401（以及未跳过时的 403）清 token 并广播该事件；管理接口传 skipForbiddenLogout 以展示后端 detail。- Permission codes（后端下发、前端只消费）: account:read:self / account:update:self、post:create|update:own|update:any|delete:own|delete:any、comment:create|delete:own|delete:any、invite_code:read:any|create:any|delete:any、user:read:any|update:any|delete:any|reset_password:any、activity:read:any|write:self。
- User profile: users 有 nickname / first_name / last_name / avatar_url；展示名优先级 昵称 → 「名 姓」→ 邮箱前缀，已删除用户为「已注销」。GET /auth/me 与登录/注册响应带这四字段（无值为 null）；PATCH /auth/me 走 account:update:self，只接受这四字段（传 email/role 会 422），返回完整用户对象（含 permissions）；PATCH /admin/users/{id} 同时接受四字段与 email/role。
- Custom UI（无 antd / 任何第三方 UI 库）: src/components/Select 自定义下拉；src/components/DateRangePicker 自定义日期范围（复用 useFloatingPanel 的定位/翻转/点击外部与 resize+scroll 关闭）；src/components/ConfirmDialog + useConfirm；src/components/Modal 通用弹窗；src/components/Avatar 头像（图片加载失败回退首字母）；src/components/AuthMenu、ProfileDialog、AuthModal、RequirePermission。DateRangePicker 的 value 为 { from?, to? }（本地日 YYYY-MM-DD），页面按本地日界转 ISO 再交给后端。
- Activity tracking: src/activity/useActivityTracker.ts 在登录后上报 page_view（路由变化）、heartbeat（可见时每 60 秒）、page_leave（visibilitychange/pagehide，带 duration_ms，且每个隐藏周期只发一次）。page_leave 用 fetch(..., { keepalive: true }) 携带 Authorization: Bearer，不用 sendBeacon（无法附加请求头）；事件内存队列批量提交，失败静默丢弃。
- Bundle: 仍然没有代码分割 / 懒加载，所有页面静态 import，单包输出（docs/assets/index-*.js）。
- Styling & UX: 极简低饱和配色（#1f2937 正文、#4b5563 次要文字、#e5e7eb 边框），PC 优先响应式；组件样式就近放在同名 *.css，由组件内 import。
- Print Rule: 所有非打印 UI 加 className="no-print"，@media print 隐藏；简历页使用 A4 版式。
- Markdown/HTML Loading: 文档不再经 import.meta.glob 内联进 bundle。构建期 `scripts/build-wiki.mjs` 把 `raw-docs` 下的 md 复制成 `public/wiki/<slug>.md`（运行时用 MarkdownView 渲染，不预渲染 HTML），html 原样保真产成 `public/wiki/<slug>.html`（缺 `<html>` 的片段补壳，外链脚本改本地 `/wiki/vendor/`），并产出 `public/wiki/index.json`。前端运行时 `fetch('/wiki/index.json')` 取清单：md 取源文本就地渲染、正文列居中，html 用 iframe 直连（应用型页面固定 85vh，片段式由 `postMessage` 上报高度自适应）。硬约定：html 文档禁止外链 CDN。
-->

# linx-zhang.github.io

基于 **Vite 8 + React 19 + TypeScript + React Router 7** 的个人综合站点：门户首页、Wiki 知识库、博客（含评论与管理）、管理后台、可导出 PDF 的简历页。构建产物输出至 `/docs`，用于 GitHub Pages 部署。

---

## ✨ 核心特性

- **分层路由**：`RootLayout` 提供全站导航、账号菜单与页脚；`WikiLayout` 提供知识库侧边栏；`/profile` 是脱离布局的独立页面
- **账号体系**：登录 / 注册（邀请码）、权限码驱动的菜单与操作按钮、个人资料弹窗（昵称 / 名 / 姓 / 头像，保存后顶栏即时更新）
- **博客**：文章列表、详情、Markdown 渲染、评论与回复、页内写作面板
- **管理后台**：文章列表与批量删除、邀请码、用户管理（资料与账号分段的编辑弹窗、管理员重置密码：可手动指定或自动生成，并一次性展示生效密码）、活跃日志
- **自定义基础组件**：Select、DateRangePicker、ConfirmDialog、Modal、Avatar 均为自研，未引入第三方 UI 库
- **活跃采集**：登录后 60 秒心跳、路由级 `page_view`、离开时 `page_leave`（带停留时长，`fetch` + `keepalive` 携带 Bearer）
- **静态文档知识库**：构建期只把 `raw-docs` 的 md 复制成 `/wiki/<slug>.md`、html 产成 `/wiki/<slug>.html`，站内列表读 `index.json`；md 运行时渲染、可一键全屏阅读，html 用 iframe 直连或独立页打开
- **GitHub 风格排版**：`github-markdown-css` + `react-markdown` + `prism-one-light`
- **专业简历导出**：`react-to-print` 一键导出 PDF，A4 打印样式与 `no-print` 隐藏规则
- **GitHub Pages 部署**：产物固定输出到 `/docs`，`public/404.html` 兜底 SPA 深链刷新

---

## 🚀 快速开始

### 环境依赖

- Node.js `^20.19.0` 或 `>=22.12.0`（Vite 8 的要求）
- npm

### 常用命令

```bash
# 安装依赖
npm install

# 单独生成知识库产物（md 副本 + html 静态页 + index.json，进 public/wiki/，已在 .gitignore 中）
npm run wiki

# 启动开发服务器（默认 http://localhost:5173；predev 会先跑一次 wiki）
npm run dev

# 类型检查 + 生产构建，产物输出到 docs/（prebuild 会先跑一次 wiki）
npm run build

# 本地预览 docs/ 构建产物
npm run preview

# 运行 oxlint
npm run lint
```

> `npm run build` 实际执行 `tsc -b && vite build`。构建走 `scripts/build-docs.mjs`：先建到 `docs_build`，校验通过再整目录替换 `docs/`。**构建前先停掉 `npm run dev`**——vite 的文件监听会锁住项目目录，导致目录替换报 `EPERM`。
> 构建脚本同时会写一个空的 `docs/.nojekyll`：GitHub Pages 默认跑 Jekyll，会把 `docs/wiki/**/*.md` 再渲染成同名 `.html`，导致 md 内容多出一份、URL 排版和站内不一致；关掉 Jekyll 后站点只发原始静态文件。
>
> **注意**：新增或删除 `raw-docs/` 下的文件后，跑一次 `npm run wiki`（`dev` / `build` 会自动触发），再刷新浏览器。`public/wiki/` 是由源文件生成的，不要手工改。

---

## 🏗️ 架构与路由

```tsx
<BrowserRouter>
  <Routes>
    <Route element={<RootLayout />}>
      <Route path="/" element={<Home />} />
      <Route path="/wiki" element={<WikiLayout />}>
        <Route index element={<DocsHome />} />
        <Route path="*" element={<Docs />} />
      </Route>
      <Route path="/blog" element={<Blog />} />
      <Route path="/blog/:id" element={<PostDetail />} />
      <Route path="/admin" element={<RequirePermission permission="invite_code:read:any"><Admin /></RequirePermission>} />
    </Route>
    <Route path="/profile" element={<Profile />} />
  </Routes>
</BrowserRouter>
```

- 路由表直接写在 `src/main.tsx`，路径常量集中在 `src/routes.ts`；所有页面静态引入，**未做代码分割 / 懒加载**
- `/wiki/*` 由 `Docs` 组件通过 `useParams()['*']` 解析多级 slug
- `/admin` 的分区用查询参数深链：`?tab=posts`（默认）、`?tab=invites`、`?tab=users`、`?tab=activity`
- `/profile` 不包裹 `RootLayout`，因此没有全站导航与页脚

---

## 🔐 账号与权限

- 登录态：`AuthProvider` 把 token 存 `localStorage` 的 `blog_access_token`，启动时请求 `GET /auth/me`；`usePermission().has(code)` 读取后端下发的权限码
- 路由守卫：`RequirePermission` 负责未登录引导与无权限提示
- 传输层集中在 `src/api/client.ts`：`request()` 负责拼 base、注入 Bearer、解析 `{code,detail,data}` 信封、把错误转成 `ApiError(status, code, detail)`；base 常量 `API_BASE` 也在这里（硬编码，不读环境变量）
- 401（以及未跳过时的 403）由 `request()` 统一清 token 并广播 `auth:unauthorized`；管理接口传 `skipForbiddenLogout` 以展示后端错误详情
- 后端权限码：`account:*`、`post:*`、`comment:*`、`invite_code:*`、`user:*`、`activity:*`（细分为 `*:own` / `*:any` / `*:self`）
- 个人资料：`PATCH /auth/me`（权限 `account:update:self`）只接受 `nickname` / `first_name` / `last_name` / `avatar_url`，不能修改邮箱与角色；管理端 `PATCH /admin/users/{id}` 额外接受 `email` / `role`
- 重置密码：`POST /admin/users/{id}/reset-password`（权限 `user:reset_password:any`，仅管理员可见按钮）可传 `{ password }` 指定新密码，留空则由后端生成 16 位临时密码；生效的密码只在响应的 `data.password` 出现一次（`data.generated` 区分来源）。同时写入 `token_invalidated_at`（迁移 0009 由 `password_changed_at` 改名而来），重置前签发的 token 会立即 401，前端据 `auth:unauthorized` 退出登录
- 展示名优先级：昵称 → 「名 姓」→ 邮箱前缀；已删除用户显示「已注销」。头像统一使用 `Avatar`：有 `avatar_url` 显示图片，加载失败回退首字母

---

## 🧩 管理后台

`/admin` 提供五个分区：

| tab | 内容 |
| --- | --- |
| `posts` | 文章纯列表、全选与单次 `POST /posts/batch-delete` 批量删除 |
| `invites` | 邀请码创建、列表与删除 |
| `users` | 用户搜索 / 角色筛选 / 分页；行内操作从左到右为「编辑」「重置密码」「删除」（危险操作固定行尾），角色下拉即时保存并支持失败回滚；「重置密码」先二次确认，可手动填写新密码（留空则由后端生成 16 位临时密码），成功后弹窗一次性展示生效的密码并可一键复制（关闭后无法再查看）；「编辑」弹窗只改资料与邮箱，保存只提交改动字段 |
| `activity` | 按用户、类型、日期范围筛选活跃日志；日期范围使用自定义 `DateRangePicker`，按本地日界转 ISO；匿名行在用户列显示「匿名 · ip」 |
| `analytics` | 活动分析监控页（`GET /admin/analytics/summary`）：今日新增用户 / 活跃用户 / 匿名访客 / 页面浏览四张数字卡，近 7 / 30 天每日浏览柱图（纯 div，不引图表库），访问者表（身份、IP·地区、浏览次数、停留时长、最近时间），点一行展开该身份停留最久的 8 个页面与口径说明 |

---

## 📈 活跃采集

`src/activity/useActivityTracker.ts` 登录后上报完整事件，未登录访客上报匿名子集（两套端点的口径见下表）：

- `page_view`：路由变化时入队
- `heartbeat`：页面可见时每 60 秒一次
- `page_leave`：`visibilitychange` 进入 hidden 或 `pagehide` 时发送，带 `duration_ms`；同一隐藏周期只发一次（两个事件可能先后触发）
- 事件先进内存队列、批量提交（登录单批最多 50 条、匿名最多 20 条）；离开时用 `fetch(url, { keepalive: true, headers: { Authorization: Bearer … } })`，不用 `sendBeacon`（无法附加认证头）

两台端点的分工，改上报逻辑前先看这张表：

| | 登录（`POST /activity`） | 匿名（`POST /activity/visitor`） |
| --- | --- | --- |
| 鉴权 | `activity:write:self` + Bearer token | 无 |
| 事件 | `page_view` / `heartbeat` / `page_leave` | 只有 `page_view` / `page_leave`（禁 `heartbeat`，否则量级会盖过浏览） |
| 路径 | 不限（含 `/admin`、`/profile`） | 只 `/`、`/blog*`、`/wiki*`（`services/visitor_paths.py` 的同一份 allow-list） |
| 限流 | 每 user 10 秒 | 每 ip 30 秒（含 `page_leave` 的批次永远放行） |
| 身份 | `user_id` | `user_id = NULL` + 请求时的 `ip/country/region/city` |

匿名侧客户端还会自己排开批次（`VISITOR_WINDOW_MS = 30s`）：窗口内的 `page_view` 先攒在队列里，等 `page_leave` 一起发，因为服务端对含 leave 的批次无条件放行，这样不会有浏览被 429 静默丢掉。匿名在非公开页（如 `/profile`）完全不留痕。

---

## 📁 目录结构

```text
linx-zhang.github.io/
├─ index.html               # Vite 入口，挂载 /src/main.tsx
├─ vite.config.ts           # base / outDir 构建配置
├─ src/
│  ├─ main.tsx              # 路由表、ReactDOM 挂载、404 路径恢复
│  ├─ routes.ts             # 路由常量与深链判定
│  ├─ activity/             # ActivityTracker + useActivityTracker（page_view / heartbeat / page_leave）
│  ├─ api/                  # client.ts（fetch 封装 / token / ApiError）、auth.ts、blog.ts、admin.ts
│  ├─ auth/                 # AuthProvider、usePermission
│  ├─ components/
│  │  ├─ Layout/            # RootLayout 全站主壳、WikiLayout 知识库子壳
│  │  ├─ Select/            # 自定义下拉（浮层逻辑见 FloatingPanel）
│  │  ├─ DateRangePicker/   # 自定义日期范围（单月日历 + 快捷项 + 键盘）
│  │  ├─ FloatingPanel/     # useFloatingPanel：定位 / 翻转 / 点击外部与 resize+scroll 关闭
│  │  ├─ Modal/             # 通用弹窗（Escape / 遮罩关闭）
│  │  ├─ ConfirmDialog/     # useConfirm() 返回 { confirm, dialog }
│  │  ├─ Avatar/            # 头像与 displayName / initialOf
│  │  ├─ AuthMenu/          # 顶栏账号下拉（个人资料、退出登录）
│  │  ├─ ProfileDialog/     # 个人资料弹窗
│  │  ├─ AuthModal/         # 登录 / 注册弹窗
│  │  ├─ RequirePermission/ # 权限守卫
│  │  └─ MarkdownView/      # Markdown 渲染
│  ├─ pages/
│  │  ├─ Home/              # 门户首页
│  │  ├─ DocsHome/          # 知识库分类总览
│  │  ├─ Docs/              # 单篇文档（md 就地渲染 / html iframe 直连，支持全屏阅读）
│  │  ├─ Blog/              # 列表 + 写作面板、详情 + 评论
│  │  ├─ Admin/             # 管理后台（PostsTab / InvitesTab / UsersTab / UserEditDialog / ResetPasswordDialog / ActivityTab）
│  │  └─ Profile/           # 独立简历页（PDF 导出）
│  └─ utils/
│     ├─ docs.ts            # 运行时读取 /wiki/index.json（不再 glob 内联）
│     └─ useDocs.ts         # useDocList()：目录页 / 侧边栏 / 详情页共用的加载状态
├─ scripts/
│  ├─ build-wiki.mjs        # 构建期镜像 raw-docs（md → .md 副本、html → 静态页）+ index.json
│  └─ build-docs.mjs        # 先建到 docs_build 再整目录替换 docs/，附带 wiki 入口复制
├─ raw-docs/                # 笔记源文件；仅 .md / .markdown / .html 参与构建
├─ public/                  # favicon.svg（取自 icons.svg 的 #documentation-icon）、icons.svg 图标 sprite、404.html（SPA 深链兜底）
│  └─ wiki/                 # 生成物（gitignore）：<slug>.md、<slug>.html、index.json、vendor/
├─ .cache/wiki-vendor/      # 外链脚本的本地缓存（跨构建复用，gitignore）
├─ docs/                    # 构建产物，GitHub Pages 部署源
```

---

## 📝 文档渲染机制

知识库是"构建期只镜像源文件 + 运行时读索引渲染"，目的是减少构建产物体积，同时让 Markdown 的排版和博客保持同一套（不再为每篇 md 预渲染一份带内联 CSS 的 HTML）。

### 1. 构建期：镜像 + 索引

`scripts/build-wiki.mjs`（由 `predev` / `prebuild` 自动触发，也可 `npm run wiki` 单独跑）：

- 扫描 `raw-docs/**/*.{md,markdown,html}`，`.py` 等附件不参与
- **Markdown**：原样复制成 `public/wiki/<slug>.md`，**不再预渲染 HTML**；标题、摘要从源文本解析出来写进索引
- **HTML**：仍产成 `public/wiki/<slug>.html`，原样保真拷贝；两种情况会处理——
  - 文件里没有 `<html>`（片段式文档）：补 `doctype/html/head/meta/title` 外壳，摘掉外链 `<link rel="stylesheet">`，套上同款排版样式
  - 引用了外链脚本（CDN）：构建期下载一次存到 `.cache/wiki-vendor/`，改写为 `/wiki/vendor/<file>` 本地路径
- 产出 `public/wiki/index.json`：`slug / title / type / category / filePath / href / standalone`（md 的 `href` 指向 `.md`，html 的指向 `.html`）

### 2. 运行期：索引 + 分类型渲染

- `src/utils/docs.ts` 的 `loadDocList()` 拉 `/wiki/index.json`（并发共用一次请求、成功后内存缓存），`src/utils/useDocs.ts` 的 `useDocList()` 提供加载/错误状态，`DocsHome`、`WikiLayout`、`Docs` 三处共用
- **md**：`Docs` 页 `fetch('/wiki/<slug>.md')` 后交给 `src/components/MarkdownView` 渲染（按 slug 内存缓存，来回翻不重复请求），正文列 760px 居中
- **html**：`<iframe src="/wiki/<slug>.html">` 直连；完整应用型页面（`standalone: true`）固定 `85vh` 页内自滚，片段式页面由页面 `postMessage({ type: 'linx-wiki-height' })` 上报高度撑满
- 全屏阅读：详情页「全屏阅读」进入 `?full=1`，整屏白底、`Esc` 或「退出全屏」返回。md 收成 720px 居中窄栏；html 文档保留宽布局（最宽 1240px、iframe 铺满整屏高度），应用页也能直接全屏跑，不必跳出站外。目录列表里两种文档的行内操作都是「全屏」，要原文另点「源文件」。

### 3. 硬约定

- **HTML 文档禁止外链 CDN**：字体、CSS、JS、图片一律相对路径或内联。构建脚本会把外链脚本本地化并给出提示，但源文件本身仍应遵守这条，否则镜像/断网时排版会崩
- `public/wiki/` 是生成物，不要手改；改内容只改 `raw-docs/`
- md 没有独立静态页，旧的 `/wiki/<slug>.html` 分享链接会失效，需要长期可分享的文档请用 html 形式

### 4. Markdown 在站内其它位置

博客正文与知识库 md 都走 `src/components/MarkdownView`（`react-markdown` + `remark-frontmatter` + `rehype-prism-plus`），共用同一套主题：`github-markdown-css` + `prism-one-light`；每个代码块右上角自动挂「复制」按钮（复制失败时贴 `已复制`/`复制失败` 反馈，非 https 环境退回 `execCommand`）。

---

## 🎨 开发约定

- 正文文字：`#1f2937`；次要文字：`#4b5563`；边框分割线：`#e5e7eb`
- 页面与组件样式就近维护在各自的 `*.css`，通过组件内 `import './xxx.css'` 引入
- 不引入第三方 UI 库；下拉、日期范围、弹窗、确认框均使用 `src/components/` 下的自研组件
- 打印：所有不应出现在 PDF 中的 UI 统一加 `className="no-print"`，`Profile.css` 中使用 `@page { size: A4; margin: 15mm 16mm; }`；`.print-only` 元素仅在打印时显示

### 维护清单（上下文重置后先读这一段）

LLM 的上下文会被压缩/丢弃，写进对话的结论等于没写。下面这些是踩过的坑和必须遵守的流程，动手前先对一遍：

**改知识库**

1. 只在 `raw-docs/` 里写源文件，`public/wiki/` 是生成物；新增/删除后跑 `npm run wiki`（`dev`/`build` 会自动触发）。
2. md 一律运行时渲染，**不要**再给 md 建期预渲染 HTML；只有「完整应用页」才用 `.html`（iframe 直连 + 全屏）。
3. html 文档禁止外链 CDN；片段式 html 会被补壳，别手写 `<html>` 外壳。
4. md 的 `href` 指向 `.md`，旧 `/wiki/<slug>.html` 分享链接失效——这是既有取舍，不是 bug。

**发布**

5. `npm run build` 前先停 `npm run dev`（vite 的文件监听会锁目录）。报 `EPERM: rename docs_build -> docs` 说明没停干净：停 dev → 若 `docs/` 已变成 `.docs-trash` 就把 `docs_build` 改回 `docs` → 删 `.docs-trash` → 重跑。
6. 产物 `docs/` 入库，build 完直接 commit + push（push 即上线，不走 GitHub Actions）。
7. `docs/.nojekyll` 必须由构建脚本生成，不能手写也不能删（原因见上节）。

**验证线上**

8. 探针只用 **GET**：`HEAD` 对已删除的路径也回 200，会得出错误结论。
9. 看 `/wiki` 应返回约 600 字节 SPA 外壳；`/assets/index-*.js`、`/wiki/<slug>.md` 应 200。
10. 直接访问 `/wiki/js/finance-simulator`（带不带 `?full=1`）会被 Pages 补成 `.html` 命中静态页、绕过 SPA；验证应用页要从站内点进去。

**视觉改动**

11. 侧栏宽度与正文居中留白共用 `--wiki-gutter`（定义在 `.wiki-layout`，折叠时 44px），改宽度只改这一处，别两头写死。
12. 纯代码文档被缩窄的根因是「纵向 flex + `margin: auto` → shrink-to-fit」，`.doc-markdown` 必须同时有 `width: 100%` 和 `max-width: 760px`。

**数据接口**

13. 分页列表统一返回 `{items, has_next}`：服务端取 `limit + 1` 条、丢掉多余那条、给 `has_next`（后端 `split_page()`）。前端**只发 `limit`**，不再自己请求 `limit+1` 再切片；`usePagedFetch` 与 `blogApi.listPosts` 都按这个形状。
14. 「下一页」按钮只看 `has_next`，不要用 `total` 算：`total` 与当前页来自两条独立语句，并发写入时可能差一条（users / invite-codes 仍返回 `total`，但只用于「共 N 条 / 第 x 页」文案）。
15. 改列表响应形状属于**前后端同批上线**的改动：先后端 deploy、再站点 push；中间几十秒线上列表会因形状不匹配报错，别只改一边就 push。
16. 参数名只有 `limit` / `offset`；`page` / `page_size` 现在会被后端**直接 422**（`reject_legacy_paging()`），不再静默返回第一页。前端 `admin.ts` 也不再给 `limit` 兜 20，默认值只有后端一处真源。

---

## 🌐 部署到 GitHub Pages

1. 执行 `npm run build` 生成 `/docs` 目录产物
2. 提交并推送至仓库 `main` 分支
3. 在仓库 Settings → Pages 中配置：Source 选 Deploy from a branch，Branch 选 `main` / `/docs`
4. 等待部署完成后访问对应域名

### SPA 深链兜底（404.html）

GitHub Pages 为纯静态托管，直接访问或刷新 `/wiki/xxx`、`/blog/xxx`、`/admin`、`/profile` 会命中 404 页面。项目通过 `public/404.html` 自动恢复：

1. `404.html` 仅在路径属于已知深链时，把 `pathname + search + hash` 写入 `sessionStorage`，随后 `location.replace('/')`
2. 入口 `src/main.tsx` 在 `BrowserRouter` 初始化之前读取并清除该值，用 `history.replaceState` 把地址栏恢复为原始路径
3. React Router 随后正常命中目标路由，用户不会停在 404 或白屏

- 通过站内链接正常跳转时不会触发 404.html
- `docs/.nojekyll` 必须存在，由构建脚本每次生成：GitHub Pages 默认跑 Jekyll，会把 `docs/wiki/**/*.md` 再渲染成同名 `.html`（症状是**已删除的路径仍然 GET 200、内容是渲染好的 HTML**）。它不在源码里手写，因为构建是「建到 `docs_build` 再整目录替换」，手写的那份下次 build 就没了。
