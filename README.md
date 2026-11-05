<!--
[LLM SYSTEM INSTRUCTION & CONTEXT]
You are a senior full-stack/frontend engineer maintaining this repository.
- Repo: linx-zhang.github.io
- Stack: Vite 8（Rolldown 打包器）+ React 19.3.1 + TypeScript + react-router-dom 7.18.5（仍使用 BrowserRouter / Routes / Route 的 v6 风格 API）
- Deployment: GitHub Pages from branch 'main', folder '/docs'（vite config: build.outDir = 'docs'、emptyOutDir = true、base = '/'）。SPA 深链刷新由 public/404.html 兜底：把原始路径写入 sessionStorage 后回到根路径，src/main.tsx 在 BrowserRouter 初始化前用 history.replaceState 恢复；.nojekyll 不需要。
- Core Routes:
  - / : Home (wrapped by RootLayout)
  - /wiki : DocsHome (nested in RootLayout -> WikiLayout)
  - /wiki/* : Docs viewer (nested in RootLayout -> WikiLayout, multi-level slug support)
  - /profile : Standalone resume page (NO layout wrapper, clean layout optimized for PDF export)
- Styling & UX: Minimalist engineer aesthetic, low saturation palette (#1f2937 body text, #4b5563 muted text, #e5e7eb border). PC-first responsive.
  - Docs rendering: github-markdown-css for typography, prism-themes 的 prism-one-light 主题做语法高亮。
- Print Rule: All non-printable UI elements MUST have className="no-print", hidden via @media print. Profile page has dedicated print container with A4 layout optimization.
- Markdown/HTML Loading: Vite compile-time static glob: import.meta.glob('/raw-docs/**/*.{md,markdown,html}', { query: '?raw', import: 'default', eager: true }). 仅 md/markdown/html 参与构建，raw-docs 下的 .py 等其它文件不加载。DocsHome 分类由 slug 第一段自动生成，WikiLayout 侧边栏为全量文档平铺列表。
-->

# linx-zhang.github.io

基于 **Vite 8 + React 19 + TypeScript + React Router 7** 构建的个人综合站点，集成门户首页、Wiki 技术知识库与可导出 PDF 的简历页。构建产物直接输出至 `/docs` 目录，用于 GitHub Pages 部署。

---

## ✨ 核心特性

- **分层路由架构**：`RootLayout` 提供全站导航与页脚，`WikiLayout` 提供知识库侧边栏；`/profile` 是脱离布局的独立页面
- **静态文档知识库**：构建期通过 `import.meta.glob` 读取 `raw-docs` 下的 Markdown/HTML，按 slug 一级目录生成分类
- **GitHub 风格排版**：`github-markdown-css` 排版 + `prism-themes` 的 `prism-one-light` 主题做代码高亮
- **专业简历导出**：`react-to-print` 一键导出 PDF，A4 打印样式与 `no-print` 隐藏规则
- **GitHub Pages 部署**：产物固定输出到 `/docs`，`public/404.html` 兜底 SPA 深链刷新
- **极简工程审美**：低饱和度配色方案，PC 优先响应式设计，专注内容可读性

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

## 🏗️ 架构与路由设计

项目采用**嵌套路由分层**设计：

1. **RootLayout（全站主壳）**：顶部导航与 Footer，`/`、`/wiki` 都挂载在它的 `Outlet` 下
2. **WikiLayout（知识库子壳）**：左侧文档侧边栏 + 右侧内容区，侧边栏可折叠
3. **Profile 独立裸页**：不套任何 Layout，专门用于渲染纯净简历并优化 PDF 导出

### 路由结构

```tsx
<BrowserRouter>
  <Routes>
    <Route element={<RootLayout />}>
      <Route path="/" element={<Home />} />
      <Route path="/wiki" element={<WikiLayout />}>
        <Route index element={<DocsHome />} />
        <Route path="*" element={<Docs />} />
      </Route>
    </Route>
    <Route path="/profile" element={<Profile />} />
  </Routes>
</BrowserRouter>
```

- 路由表直接写在 `src/main.tsx`，所有页面均为静态引入
- `/wiki/*` 由 `Docs` 组件通过 `useParams()['*']` 解析多级 slug
- `/profile` 不包裹 `RootLayout`，因此没有全站导航与页脚

---

## 📁 目录结构

```text
linx-zhang.github.io/
├─ index.html               # Vite 入口，挂载 /src/main.tsx
├─ vite.config.ts           # base / outDir 构建配置
├─ package.json             # dev / build / preview / lint 脚本
├─ src/
│  ├─ main.tsx              # 路由表、ReactDOM 挂载、404 路径恢复
│  ├─ App.tsx               # Vite 模板遗留组件，当前未被任何入口引用
│  ├─ App.css               # 仅被 App.tsx 引用（模板遗留）
│  ├─ index.css             # 模板遗留全局样式，当前未被引用
│  ├─ assets/               # hero.png / react.svg / vite.svg（仅 App.tsx 使用）
│  ├─ components/Layout/
│  │  ├─ RootLayout.tsx/.css   # 全站主壳
│  │  └─ WikiLayout.tsx/.css   # 知识库侧边栏子壳
│  ├─ pages/
│  │  ├─ Home/              # 门户首页
│  │  ├─ DocsHome/          # 知识库分类总览
│  │  ├─ Docs/              # 单篇文档详情（Markdown 渲染 / HTML iframe）
│  │  └─ Profile/           # 独立简历页（PDF 导出）
│  └─ utils/
│     └─ docs.ts            # 编译期扫描 raw-docs，生成文档清单
├─ raw-docs/                # 笔记源文件；仅 .md / .markdown / .html 参与构建
├─ public/                  # favicon.svg、icons.svg、404.html（SPA 深链兜底）
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
- `slug` 由文件路径去掉 `/raw-docs/` 前缀与扩展名得到（如 `python/sign.md` → `python/sign`）
- 标题优先取 HTML 的 `<title>` 或 Markdown 第一行 `# 标题`，取不到则回退为 slug
- 列表统一按 `title.localeCompare` 排序
- `DocsHome` 的分类由 slug 第一段生成（无子目录归入「综合」）；`WikiLayout` 侧边栏直接平铺全部文档

### 2. Markdown 渲染

- 排版基础：`github-markdown-css`
- 渲染引擎：`react-markdown`
  - `remark-frontmatter`：解析并忽略文档头部的 YAML 元信息
  - `rehype-raw`：支持 Markdown 内混写原生 HTML
  - `rehype-prism-plus`：代码块结构化与语法高亮（`ignoreMissing: true`）
- 高亮主题：`prism-themes/themes/prism-one-light.css`（浅色 GitHub 风格）

### 3. HTML 渲染

`.html` 文档不经过 Markdown 渲染，而是通过无边框 `<iframe srcDoc={...}>` 隔离嵌入（高度 `75vh`），避免外部 CSS 污染原文样式。

---

## 🎨 开发约定与规范

### 样式与配色

- 正文文字：`#1f2937`
- 次要文字：`#4b5563`
- 边框分割线：`#e5e7eb`
- 页面样式按目录就近维护在各自的 `*.css` 中，通过组件内 `import './xxx.css'` 引入

### 打印与 PDF 导出

- 所有不应出现在 PDF 中的 UI（导航栏、侧边栏、操作按钮）统一添加 `className="no-print"`
- 打印样式通过 `@media print` 控制，`Profile.css` 中使用 `@page { size: A4; margin: 15mm 16mm; }`
- 简历页通过 `useReactToPrint` 导出，`documentTitle` 为 `Linx_Zhang_Resume`
- `.print-only` 元素仅在打印时显示（如联系方式行）；`https` 链接打印时会附带 URL

---

## 🌐 部署到 GitHub Pages

1. 执行 `npm run build` 生成 `/docs` 目录产物
2. 提交并推送至仓库 `main` 分支
3. 在仓库 Settings → Pages 中配置：
   - Source：Deploy from a branch
   - Branch：`main` / `/docs`
4. 等待部署完成后访问对应域名

### SPA 深链兜底（404.html）

GitHub Pages 为纯静态托管，直接访问或刷新 `/wiki/xxx`、`/profile` 会命中 404 页面。项目通过 `public/404.html` 自动恢复：

1. `404.html` 仅在路径属于 `/wiki`、`/wiki/*`、`/profile` 时，把 `pathname + search + hash` 写入 `sessionStorage`，随后 `location.replace('/')`
2. 入口 `src/main.tsx` 在 `BrowserRouter` 初始化之前读取并清除该值，用 `history.replaceState` 把地址栏恢复为原始路径
3. React Router 随后正常命中目标路由，用户不会停在 404 或白屏

- 通过站内链接正常跳转时不会触发 404.html
- `.nojekyll` 不需要提供：当前构建产物中没有以下划线开头的资源
