<!-- [LLM SYSTEM INSTRUCTION & CONTEXT] -->
<!--
You are a senior full-stack/frontend engineer maintaining this repository.
- Repo: linx-zhang.github.io
- Stack: Vite 8（Rolldown）+ React 19.3.1 + TypeScript（verbatimModuleSyntax）+ react-router-dom 7.18.5（BrowserRouter / Routes / Route 的 v6 风格 API）
- Deployment: GitHub Pages from branch 'main', folder '/docs'（vite config: build.outDir = 'docs'、emptyOutDir = true、base = '/'）。SPA 深链刷新由 public/404.html 兜底：把原始路径写入 sessionStorage.spa-fallback-path 后回到根路径，src/main.tsx 在 BrowserRouter 初始化前用 history.replaceState 恢复；.nojekyll 不需要。
- Backend: Cloudflare Python Worker + FastAPI + D1，base 常量在 src/api/auth.ts 的 AUTH_API_BASE。响应统一为 { code, detail, data }，前端 request<T>() 解包 data；错误抛 ApiError(status, code, detail)。
- Core Routes（定义在 src/routes.ts 与 src/main.tsx）:
  - / : Home（RootLayout 内）
  - /wiki : DocsHome（RootLayout -> WikiLayout）
  - /wiki/* : Docs 文档详情（多级 slug）
  - /blog : Blog 列表 + 页内写作面板
  - /blog/:id : PostDetail 文章详情与评论
  - /admin : 管理后台，RequirePermission 守卫 invite_code:read:any；分区通过 ?tab=posts|invites|users|activity 深链（默认 posts）
  - /profile : 独立简历页（不套 RootLayout，A4 打印优化）
- Auth: 登录/注册成功后 token 存 localStorage（blog_access_token）；AuthProvider 启动时拉 GET /auth/me 获取 user + permissions，并监听 window 的 auth:unauthorized 事件清理登录态。request() 对 401（以及未跳过时的 403）清 token 并广播该事件；管理接口传 skipForbiddenLogout 以展示后端 detail。
- Permission codes（后端下发、前端只消费）: account:read:self / account:update:self、post:create|update:own|update:any|delete:own|delete:any、comment:create|delete:own|delete:any、invite_code:read:any|create:any|delete:any、user:read:any|update:any|delete:any|reset_password:any、activity:read:any|write:self。
- User profile: users 有 nickname / first_name / last_name / avatar_url；展示名优先级 昵称 → 「名 姓」→ 邮箱前缀，已删除用户为「已注销」。GET /auth/me 与登录/注册响应带这四字段（无值为 null）；PATCH /auth/me 走 account:update:self，只接受这四字段（传 email/role 会 422），返回完整用户对象（含 permissions）；PATCH /admin/users/{id} 同时接受四字段与 email/role。
- Custom UI（无 antd / 任何第三方 UI 库）: src/components/Select 自定义下拉；src/components/DateRangePicker 自定义日期范围（复用 useFloatingPanel 的定位/翻转/点击外部与 resize+scroll 关闭）；src/components/ConfirmDialog + useConfirm；src/components/Modal 通用弹窗；src/components/Avatar 头像（图片加载失败回退首字母）；src/components/AuthMenu、ProfileDialog、AuthModal、RequirePermission。DateRangePicker 的 value 为 { from?, to? }（本地日 YYYY-MM-DD），页面按本地日界转 ISO 再交给后端。
- Activity tracking: src/activity/useActivityTracker.ts 在登录后上报 page_view（路由变化）、heartbeat（可见时每 60 秒）、page_leave（visibilitychange/pagehide，带 duration_ms，且每个隐藏周期只发一次）。page_leave 用 fetch(..., { keepalive: true }) 携带 Authorization: Bearer，不用 sendBeacon（无法附加请求头）；事件内存队列批量提交，失败静默丢弃。
- Bundle: 仍然没有代码分割 / 懒加载，所有页面静态 import，单包输出（docs/assets/index-*.js）。
- Styling & UX: 极简低饱和配色（#1f2937 正文、#4b5563 次要文字、#e5e7eb 边框），PC 优先响应式；组件样式就近放在同名 *.css，由组件内 import。
- Print Rule: 所有非打印 UI 加 className="no-print"，@media print 隐藏；简历页使用 A4 版式。
- Markdown/HTML Loading: Vite 编译期 import.meta.glob('/raw-docs/**/*.{md,markdown,html}', { query: '?raw', import: 'default', eager: true })，仅 md/markdown/html 参与构建；DocsHome 分类由 slug 第一段生成，WikiLayout 侧边栏为全量文档平铺列表。
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
- **静态文档知识库**：构建期通过 `import.meta.glob` 读取 `raw-docs` 下的 Markdown / HTML，按 slug 一级目录生成分类
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

# 启动开发服务器（默认 http://localhost:5173）
npm run dev

# 类型检查 + 生产构建，产物输出到 docs/
npm run build

# 本地预览 docs/ 构建产物
npm run preview

# 运行 oxlint
npm run lint
```

> `npm run build` 实际执行 `tsc -b && vite build`。
>
> **注意**：新增或删除 `raw-docs/` 下的 Markdown / HTML 文件后，需重启 Vite 开发服务器以触发 glob 重新扫描。

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
- 重置密码：`POST /admin/users/{id}/reset-password`（权限 `user:reset_password:any`，仅管理员可见按钮）可传 `{ password }` 指定新密码，留空则由后端生成 16 位临时密码；生效的密码只在响应的 `data.password` 出现一次（`data.generated` 区分来源）。同时写入 `password_changed_at`，重置前签发的 token 会立即 401，前端据 `auth:unauthorized` 退出登录
- 展示名优先级：昵称 → 「名 姓」→ 邮箱前缀；已删除用户显示「已注销」。头像统一使用 `Avatar`：有 `avatar_url` 显示图片，加载失败回退首字母

---

## 🧩 管理后台

`/admin` 提供四个分区：

| tab | 内容 |
| --- | --- |
| `posts` | 文章纯列表、全选与单次 `POST /posts/batch-delete` 批量删除 |
| `invites` | 邀请码创建、列表与删除 |
| `users` | 用户搜索 / 角色筛选 / 分页；行内操作从左到右为「编辑」「重置密码」「删除」（危险操作固定行尾），角色下拉即时保存并支持失败回滚；「重置密码」先二次确认，可手动填写新密码（留空则由后端生成 16 位临时密码），成功后弹窗一次性展示生效的密码并可一键复制（关闭后无法再查看）；「编辑」弹窗只改资料与邮箱，保存只提交改动字段 |
| `activity` | 按用户、类型、日期范围筛选活跃日志；日期范围使用自定义 `DateRangePicker`，按本地日界转 ISO |

---

## 📈 活跃采集

`src/activity/useActivityTracker.ts` 仅在登录后上报：

- `page_view`：路由变化时入队
- `heartbeat`：页面可见时每 60 秒一次
- `page_leave`：`visibilitychange` 进入 hidden 或 `pagehide` 时发送，带 `duration_ms`；同一隐藏周期只发一次（两个事件可能先后触发）
- 事件先进内存队列、批量提交（单批最多 50 条）；离开时用 `fetch(url, { keepalive: true, headers: { Authorization: Bearer … } })`，不用 `sendBeacon`（无法附加认证头）

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
│  │  ├─ Docs/              # 单篇文档（Markdown 渲染 / HTML iframe）
│  │  ├─ Blog/              # 列表 + 写作面板、详情 + 评论
│  │  ├─ Admin/             # 管理后台（PostsTab / InvitesTab / UsersTab / UserEditDialog / ResetPasswordDialog / ActivityTab）
│  │  └─ Profile/           # 独立简历页（PDF 导出）
│  └─ utils/docs.ts         # 编译期扫描 raw-docs，生成文档清单
├─ raw-docs/                # 笔记源文件；仅 .md / .markdown / .html 参与构建
├─ public/                  # favicon.svg、404.html（SPA 深链兜底）
├─ docs/                    # 构建产物，GitHub Pages 部署源
└─ old/                     # 旧版站点源码，不参与当前构建
```

---

## 📝 文档渲染机制

### 1. 编译期扫描

`src/utils/docs.ts` 使用：

```ts
import.meta.glob('/raw-docs/**/*.{md,markdown,html}', {
  query: '?raw',
  import: 'default',
  eager: true,
})
```

- 只有 `.md`、`.markdown`、`.html` 会被打包；`raw-docs` 下的 `.py` 等文件仅作为笔记附件存在，不会被读取
- `slug` 由文件路径去掉 `/raw-docs/` 前缀与扩展名得到（如 `python/request-signing.md` → `python/request-signing`）
- 标题优先取 HTML 的 `<title>` 或 Markdown 第一行 `# 标题`，取不到则回退为 slug
- 列表统一按 `title.localeCompare` 排序
- `DocsHome` 的分类由 slug 第一段生成（无子目录归入「综合」）；`WikiLayout` 侧边栏直接平铺全部文档

### 2. Markdown 渲染

- 排版基础：`github-markdown-css`
- 渲染引擎：`react-markdown`
  - `remark-frontmatter`：解析并忽略文档头部的 YAML 元信息
  - `rehype-raw`：支持 Markdown 内混写原生 HTML
  - `rehype-prism-plus`：代码块结构化与语法高亮（`ignoreMissing: true`）
- 高亮主题：`prism-themes/themes/prism-one-light.css`

### 3. HTML 渲染

`.html` 文档不经过 Markdown 渲染，而是通过无边框 `<iframe srcDoc={...}>` 隔离嵌入（高度 `75vh`），避免外部 CSS 污染原文样式。

---

## 🎨 开发约定

- 正文文字：`#1f2937`；次要文字：`#4b5563`；边框分割线：`#e5e7eb`
- 页面与组件样式就近维护在各自的 `*.css`，通过组件内 `import './xxx.css'` 引入
- 不引入第三方 UI 库；下拉、日期范围、弹窗、确认框均使用 `src/components/` 下的自研组件
- 打印：所有不应出现在 PDF 中的 UI 统一加 `className="no-print"`，`Profile.css` 中使用 `@page { size: A4; margin: 15mm 16mm; }`；`.print-only` 元素仅在打印时显示

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
- `.nojekyll` 不需要提供：当前构建产物中没有以下划线开头的资源
