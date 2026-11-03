# README（精简上下文版，llm提示写在最顶部）
> prompt
> 仓库：linx-zhang.github.io
> 栈：Vite + React + TS
> 发布模式：`npm run build` 直接输出到根目录 `docs/`，GitHub Pages 来源：main 分支 /docs
> 目录约定：
> - `raw-docs/`：源笔记目录，自由放 md / html，前端扫描渲染
> - `src/pages/Home`：全站首页 `/`（站点门户，入口导航）
> - `src/pages/DocsHome`：知识库首页 `/wiki`
> - `src/pages/Docs`：知识库文档页 `/wiki/:slug`
> - `src/pages/Profile`：个人主页 `/profile`（独立裸页，**不套任何布局、无导航侧边**，专门用于简历PDF导出）
> - `src/components/Layout/RootLayout`：**全站顶层布局**（全站主导航 + footer，所有常规页面默认嵌套，不含知识库侧边）
> - `src/components/Layout/WikiLayout`：**知识库子布局**，嵌套在 RootLayout 内部，包含可收起侧边抽屉目录、知识库文档打印ref
> - vite 配置：`build.outDir: "docs"`，`emptyOutDir:true`，`public/.nojekyll`
> - glob：`import.meta.glob('/raw-docs/**/*.md', { as: 'raw' })`
> - 路由：`/` 全站门户首页；`/wiki` 知识库目录首页；`/wiki/:slug` 单篇笔记；`/profile` 独立简历裸页
> - 构建流程：本地 `npm run build` → 生成 `docs/` 产物，git add docs 后 push，Pages秒发布
> - 导出能力：使用 react-to-print hook；WikiLayout 处理文档打印，Profile 自带独立打印；打印CSS统一标记 `.no-print` 隐藏导航、侧边栏、按钮
> - 别名：`@` 映射 `src/`

---

# 项目说明
Vite + React + TS 个人综合站点（全站门户 + 技术知识库 + 简历页），托管于 GitHub Pages。
- 全站门户首页：`/`，站点介绍 + 功能入口卡片，后续可扩展更多模块
- 知识库首页：`/wiki`，文档总目录
- 单篇笔记：`/wiki/:slug`，源文件存放在 `raw-docs/`，支持随意新增、分类 md、html 文件
- 个人简历页：`/profile`，独立裸页面，没有顶部导航、侧边栏，干净适合PDF导出分享
- 布局分层（扩展性优先）：
  1. `RootLayout`：全站通用壳，顶部主导航、footer；首页、知识库都套这个；新增 `/tools` `/lab` 等模块直接挂载在此
  2. `WikiLayout`：知识库专属子壳，嵌套在 RootLayout 之内，额外提供侧边抽屉目录、文档打印能力
- 打印/PDF：统一 `.no-print` 样式类控制打印时隐藏UI元素；知识库文档、简历页两套打印ref互相隔离，互不干扰
- 构建：`npm run build` 直接打包输出到 `docs/`，用于 GitHub Pages 发布
- 本地开发：`npm run dev`

## 目录概览
```
linx-zhang.github.io/
├─ src/
│  ├─ components/Layout/
│  │  ├─ RootLayout.tsx     # 全站顶层布局：全站主导航 + footer
│  │  └─ WikiLayout.tsx     # 知识库子布局：侧边抽屉目录 + 文档打印ref（嵌套RootLayout里面）
│  └─ pages/
│     ├─ Home/               # / 全站门户首页
│     ├─ DocsHome/          # /wiki 知识库首页目录
│     ├─ Docs/               # /wiki/:slug 笔记详情页
│     └─ Profile/            # /profile 独立简历裸页（无任何布局包裹）
├─ raw-docs/                 # ✅ 笔记源文件，md/html 放这里
├─ public/                   # 静态资源，含 .nojekyll
├─ docs/                     # 📦 build产物，自动生成，不要手动修改
├─ package.json
├─ vite.config.ts
└─ tsconfig.app.json
```

## 依赖说明
```bash
# 路由
npm install react-router-dom
# PDF打印导出（hook版本 useReactToPrint）
npm install react-to-print
# 类型支持
npm install -D @types/node
```

## 常用命令
```bash
npm run dev     # 本地开发预览
npm run build   # 打包，产物输出到 ./docs
npx tsc --noEmit # TS类型校验
```

## GitHub Pages 设置
Source: Deploy from a branch
Branch: main
Folder: /docs
