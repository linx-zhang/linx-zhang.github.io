
# README（精简上下文版，llm提示写在最顶部）
> prompt
> 仓库：linx-zhang.github.io
> 栈：Vite + React + TS
> 发布模式：`npm run build` 直接输出到根目录 `docs/`，GitHub Pages 来源：main 分支 /docs
> 目录约定：
> - `raw-docs/`：源笔记目录，自由放 md / html，前端扫描渲染
> - `src/pages/DocsHome`：知识库首页 `/`
> - `src/pages/Docs`：知识库文档页 `/docs/:slug`
> - `src/pages/Profile`：个人主页 `/profile`（独立页面，不套知识库布局）
> - `src/components/Layout/MainLayout`：知识库全局布局（顶部导航 + 可收起侧边抽屉目录，自带打印/PDF导出）
> - vite 配置：`build.outDir: "docs"`，`emptyOutDir:true`，`public/.nojekyll`
> - glob：`import.meta.glob('/raw-docs/**/*.md', { as: 'raw' })`
> - 路由：`/` 知识库目录首页；`/docs/:slug` 单篇笔记；`/profile` 个人主页
> - 构建流程：本地 `npm run build` → 生成 `docs/` 产物，git add docs 后 push，Pages秒发布
> - 导出能力：使用 react-to-print hook，打印/PDF时CSS自动隐藏导航、侧边栏
> - 别名：`@` 映射 `src/`

---

# 项目说明
Vite + React + TS 知识库 + 个人主页，托管于 GitHub Pages。
- 知识库首页：`/`，文档总目录
- 单篇笔记：`/docs/xxx`，源文件存放在 `raw-docs/`，支持随意新增、分类 md、html 文件
- 个人主页：`/profile`，独立页面，无知识库侧边与顶部菜单
- 布局：知识库统一使用【顶部导航 + 可收起侧边抽屉目录】；支持一键导出PDF，打印时自动屏蔽导航UI
- 构建：`npm run build` 直接打包输出到 `docs/`，用于 GitHub Pages 发布
- 本地开发：`npm run dev`

## 目录概览
```
linx-zhang.github.io/
├─ src/
│  ├─ components/Layout/
│  │  └─ MainLayout.tsx       # 知识库全局布局壳（导航+抽屉侧边+打印ref）
│  └─ pages/
│     ├─ DocsHome/            # / 知识库首页目录
│     ├─ Docs/                # /docs/:slug 笔记详情页
│     └─ Profile/             # /profile 独立个人主页
├─ raw-docs/                  # ✅ 笔记源文件，md/html 放这里
├─ public/                    # 静态资源，含 .nojekyll
├─ docs/                      # 📦 build产物，自动生成，不要手动修改
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


