```markdown
<!--
[LLM SYSTEM INSTRUCTION & CONTEXT]
You are a senior full-stack/frontend engineer maintaining this repository.
- Repo: linx-zhang.github.io
- Stack: Vite + React + TypeScript
- Deployment: GitHub Pages from branch 'main', folder '/docs' (vite config: build.outDir = 'docs', emptyOutDir = true, public/.nojekyll required).
- Core Routes:
  - / : Home (RootLayout)
  - /wiki : DocsHome (RootLayout -> WikiLayout)
  - /wiki/* : Docs viewer (RootLayout -> WikiLayout)
  - /profile : Standalone resume page (No Layout wrapper, clean for PDF print)
- Styling & UX: Minimalist engineer aesthetic, low saturation (#1f2937 body, #4b5563 muted, #e5e7eb border), PC-first responsive. github-markdown-css & prism-ghcolors for docs.
- Print Rule: All UI non-printable elements MUST have className="no-print". Profile page is strictly a bare layout.
- Markdown/HTML Loading: Vite compile-time glob: import.meta.glob('/raw-docs/**/*.{md,markdown,html}', { query: '?raw', import: 'default', eager: true }).
-->

# linx-zhang.github.io

Vite + React + TS 个人综合站点（全站门户 + Wiki 知识库 + 简历页），直接输出至 `/docs` 供 GitHub Pages 部署。

---

## 快速开始

```bash
npm install
npm run dev      # 启动本地开发 (http://localhost:5173)
npm run build    # 构建静态产物至 /docs

```

> **注意**：新增/删除 `raw-docs/` 内的 Markdown/HTML 文件需重启 Vite Dev Server 触发 glob 重新收集。

---

## 项目架构与路由分层

架构采用**嵌套路由分层**设计，预留未来扩展（如 `/tools`, `/lab`）：

1. **`RootLayout`（主壳）**：提供全站顶部导航和 Footer。门户首页 `/` 和新增业务模块默认套用此布局。
2. **`WikiLayout`（子壳）**：嵌套于主壳内，专为 `/wiki` 知识库提供左侧分类目录侧边栏、右侧内容区，以及独立的 `react-to-print` 打印能力。
3. **独立裸页 (`/profile`)**：完全脱离 Layout，没有任何导航和侧边栏，专门用于渲染纯净的简历并导出 PDF。

```tsx
<Route element="{<RootLayout"/>}>
  <Route element="{<Home" path="/"/>} />
  <Route element="{<WikiLayout" path="/wiki"/>}>
    <Route element="{<DocsHome" index/>} />
    <Route element="{<Docs" path="*"/>} /> {/* 使用 * 匹配多级目录 slug */}
  </Route>
  {/* 扩展模块示例 */}
  <Route element="{<ToolsHome" path="/tools"/>} />
</Route>
<Route element="{<Profile" path="/profile"/>} />

```

---

## 目录结构

```text
linx-zhang.github.io/
├─ src/
│  ├─ components/Layout/
│  │  ├─ RootLayout.tsx     # 全站主壳
│  │  └─ WikiLayout.tsx     # 知识库侧边栏子壳
│  ├─ pages/
│  │  ├─ Home/              # 门户首页
│  │  ├─ DocsHome/          # 知识库分类总览
│  │  ├─ Docs/              # 单篇笔记详情 (MD 渲染 / HTML iframe)
│  │  └─ Profile/           # 独立简历页
│  └─ utils/
│     └─ docs.ts            # glob 扫描 raw-docs
├─ raw-docs/                # 📝 笔记源文件 (支持 .md, .html, 多级目录)
├─ public/                  # 静态资源 (含 SPA 必备的 .nojekyll, 404.html)
└─ docs/                    # 📦 npm run build 产物 (GitHub Pages 部署源)

```

---

## 核心实现：文档渲染

1. **读取解析**：使用 Vite 的 `import.meta.glob(..., { query: '?raw', eager: true })` 静态扫描 `raw-docs/` 目录。根据一级目录自动生成分类（`docs.ts` & `DocsHome`）。
2. **Markdown 渲染**：
* 排版基础：`github-markdown-css`
* Markdown 引擎：`react-markdown` + `remark-frontmatter` (忽略 yaml) + `rehype-raw` (支持 HTML 混排) + `rehype-prism-plus` (代码块结构化)。
* 代码高亮配色：`prism-themes/themes/prism-ghcolors.css` (适配 GitHub 明亮风格)。


3. **HTML 渲染**：完整的独立 HTML 文件通过无边框 `<iframe srcDoc={...}>` 隔离嵌入，防止污染全站 CSS。

---

## 开发约束与约定

* **样式与配色**：简约工程师风。正文 `#1f2937`，次要文字 `#4b5563`，边框线 `#e5e7eb`。
* **打印与导出**：页面和组件中任何不应该出现在 PDF 里的元素（导航栏、侧边栏、按钮），必须统一加上 `className="no-print"`。打印样式通过 `@media print` 统一控制。
* **静态部署兼容 (SPA)**：由于部署在 GitHub Pages，刷新直接访问带 path 的 URL 会报 404。需在 `public/` 下提供 `404.html` (内容等同 `index.html` 复制) 配合 React Router 解决。

```

<FollowUp label="是否需要配置 404.html 解决 SPA 刷新报错的问题？" query="我在 public 目录下应该怎么配置 404.html 来解决 GitHub Pages 刷新报 404 的问题？"/>

```