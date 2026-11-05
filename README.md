<!--
[LLM SYSTEM INSTRUCTION & CONTEXT]
You are a senior full-stack/frontend engineer maintaining this repository.
- Repo: linx-zhang.github.io
- Stack: Vite + React + TypeScript + React Router v6
- Deployment: GitHub Pages from branch 'main', folder '/docs' (vite config: build.outDir = 'docs', emptyOutDir = true). public/.nojekyll + 404.html required for SPA compatibility.
- Core Routes:
  - / : Home (wrapped by RootLayout)
  - /wiki : DocsHome (nested in RootLayout -> WikiLayout)
  - /wiki/* : Docs viewer (nested in RootLayout -> WikiLayout, multi-level slug support)
  - /profile : Standalone resume page (NO layout wrapper, clean layout optimized for PDF export)
- Styling & UX: Minimalist engineer aesthetic, low saturation palette (#1f2937 body text, #4b5563 muted text, #e5e7eb border). PC-first responsive.
  - Docs rendering: github-markdown-css for typography, prism-github theme for syntax highlighting (aligned with GitHub native style).
- Print Rule: All non-printable UI elements MUST have className="no-print", hidden via @media print. Profile page has dedicated print container with A4 layout optimization.
- Markdown/HTML Loading: Vite compile-time static glob: import.meta.glob('/raw-docs/**/*.{md,markdown,html}', { query: '?raw', import: 'default', eager: true }). Auto-generate categories from top-level directories.
-->

# linx-zhang.github.io

基于 **Vite + React + TypeScript** 构建的个人综合站点，集成门户首页、Wiki 技术知识库与可导出 PDF 的简历页。构建产物直接输出至 `/docs` 目录，原生适配 GitHub Pages 一键部署。

---

## ✨ 核心特性

- **分层路由架构**：嵌套式布局设计，主壳统一全站导航，子模块独立布局，预留 `/tools` `/lab` 等扩展位
- **静态文档知识库**：编译期自动扫描 `raw-docs` 目录下的 Markdown/HTML 文件，按一级目录自动生成分类导航
- **GitHub 原生渲染**：采用 `github-markdown-css` 排版 + `prism-github` 代码高亮，与 GitHub 阅读体验完全对齐
- **专业简历导出**：独立纯净简历页，针对 A4 纸张优化排版，支持一键导出高清 PDF
- **极简工程审美**：低饱和度配色方案，PC 优先响应式设计，专注内容可读性
- **开箱即用部署**：内置 SPA 路由刷新兼容方案，无缝适配 GitHub Pages 静态托管

---

## 🚀 快速开始

### 环境依赖
- Node.js >= 16
- npm / pnpm

### 本地开发
```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev
# 访问 [http://localhost:5173](http://localhost:5173)
```

### 生产构建

```
# 构建静态产物至 /docs 目录
npm run build
```

> 
> **注意**：新增或删除 `raw-docs/` 目录下的 Markdown / HTML 文件后，需重启 Vite 开发服务器以触发 glob 重新扫描。

---

## 🏗️ 架构与路由设计

项目采用**嵌套路由分层**设计，兼顾统一性与扩展性：

1. **RootLayout（全站主壳）**
提供全站顶部导航栏与底部 Footer，门户首页与所有业务模块默认继承此布局。
2. **WikiLayout（知识库子壳）**
嵌套于主壳内部，为 `/wiki` 知识库提供左侧分类侧边栏与右侧内容区，支持多级目录路由。
3. **Profile 独立裸页**
完全脱离全站布局，无导航与侧边栏，专门用于渲染纯净简历并优化 PDF 导出效果。

### 路由结构示意

```
// 全站主壳路由
<Route element={<RootLayout />}>
  <Route path="/" element={<Home />} />
  <Route path="/wiki" element={<WikiLayout />}>
    <Route index element={<DocsHome />} />
    <Route path="*" element={<Docs />} /> {/* 匹配多级目录 slug */}
  </Route>
  {/* 预留扩展模块 */}
  <Route path="/tools" element={<ToolsHome />} />
</Route>

// 独立简历页（无布局包裹）
<Route path="/profile" element={<Profile />} />
```

---

## 📁 目录结构

```
linx-zhang.github.io/
├─ src/
│  ├─ components/Layout/
│  │  ├─ RootLayout.tsx     # 全站主壳布局
│  │  └─ WikiLayout.tsx     # 知识库侧边栏子布局
│  ├─ pages/
│  │  ├─ Home/              # 门户首页
│  │  ├─ DocsHome/          # 知识库分类总览页
│  │  ├─ Docs/              # 单篇文档详情页（MD 渲染 / HTML 隔离嵌入）
│  │  └─ Profile/           # 独立简历页（PDF 导出专用）
│  └─ utils/
│     └─ docs.ts            # 静态扫描 raw-docs，生成文档目录数据
├─ raw-docs/                # 📝 笔记源文件，支持 .md / .html / 多级子目录
├─ public/                  # 静态资源，包含 .nojekyll、404.html 等部署必备文件
└─ docs/                    # 📦 构建产物目录，GitHub Pages 部署源
```

---

## 📝 文档渲染机制

### 1. 静态读取与解析

使用 Vite 原生 `import.meta.glob` 在编译期静态扫描 `raw-docs/` 全目录，根据一级目录自动生成文档分类与侧边栏导航。

### 2. Markdown 渲染

- 排版基础：`github-markdown-css`，完美复刻 GitHub 原生排版
- 渲染引擎：`react-markdown` 配套插件体系
  - `remark-frontmatter`：自动忽略文档头部 YAML 元数据
  - `rehype-raw`：支持 Markdown 内混写原生 HTML
  - `rehype-prism-plus`：代码块结构化与语法高亮
- 高亮主题：`prism-github`，与 GitHub 网页代码配色完全对齐

### 3. HTML 渲染

完整独立的 HTML 文件通过无边框 `<iframe srcDoc={...}>` 隔离嵌入，避免外部 CSS 污染文档原有样式。

---

## 🎨 开发约定与规范

### 样式与配色

遵循极简工程师审美，统一色板：

- 正文文字：`#1f2937`
- 次要文字：`#4b5563`
- 边框分割线：`#e5e7eb`

### 打印与 PDF 导出

- 所有不应出现在 PDF 中的 UI 元素（导航栏、侧边栏、操作按钮），必须统一添加 `className="no-print"`
- 打印样式通过 `@media print` 媒体查询全局控制
- 简历页针对 A4 纸张做了分页、边距与行高专项优化

### SPA 静态部署兼容

由于 GitHub Pages 为静态托管，直接访问带路径的 URL 会触发 404。项目通过以下方案解决：

- `public/.nojekyll`：禁用 Jekyll 处理，确保下划线开头的静态资源正常加载
- `public/404.html`：与 `index.html` 内容一致，配合 React Router 实现路由重定向

---

## 📦 部署到 GitHub Pages

1. 执行 `npm run build` 生成 `/docs` 目录产物
2. 将代码推送至仓库 `main` 分支
3. 在仓库 Settings → Pages 中配置：
   - Source：Deploy from a branch
   - Branch：`main` / `/docs`
4. 等待部署完成后访问对应域名即可
