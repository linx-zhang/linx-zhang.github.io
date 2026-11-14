---
pin: 1
---

# 关于本站

一个个人站点，用同一套前端应用承担门户、知识库、博客、工具箱、个人空间和简历；页面托管在 GitHub Pages 上，需要写数据的功能（账号、文章、评论、备忘录、共享剪切板、活跃日志）走 Cloudflare Worker + D1。

## 站点由哪几块组成

| 路由 | 内容 |
| --- | --- |
| `/` | 门户首页：知识库 / 博客 / 简历三张入口卡，下面接最新文章列表 |
| `/wiki` | 知识库：分类总览、侧边栏、单篇阅读，支持全屏 |
| `/blog` | 博客：文章列表、详情与评论、页内写作面板（工具栏 + 实时预览） |
| `/tools` | 工具箱：五个中等图标入口，点进去独占整页 |
| `/space` | 个人空间：备忘录 / 待办，只有本人能读写；管理员额外看到「写文章 / 用户 / 分析」三个快捷入口 |
| `/profile` | 独立简历页，不套全站导航，按 A4 排版，可导出 PDF |
| `/admin` | 管理后台：文章、用户、日志、分析四个分区；邀请码是独立分区，入口在「用户」页标题行 |

## 技术栈

- **前端**：Vite 8 + React 19 + TypeScript + React Router 7；下拉、日期范围、弹窗、确认框、头像全部自研，没有引入第三方 UI 库
- **后端**：Cloudflare Python Worker（FastAPI 风格）+ D1；响应统一为 `{ code, detail, data }`，前端 `request()` 解包 `data`
- **部署**：构建产物固定输出到 `docs/`，`main` 分支的 `/docs` 目录直接由 GitHub Pages 托管；push 即上线，不经过构建流水线
- **深链兜底**：`public/404.html` 把原始路径暂存到 `sessionStorage` 再回根路径，`main.tsx` 在路由初始化前用 `history.replaceState` 恢复，刷新 `/blog/:id`、`/admin` 这类深链不会停在 404

## 知识库的内容是怎么进来的

源文件只放在 `raw-docs/`，`public/wiki/` 是生成物，不要手改。目录按「内容性质」分两层，而不是按语言分：

| 分类 | 目录 | 装什么 |
| --- | --- | --- |
| `project` | `raw-docs/project/` | 本站自身的工程长文：总览、前端、后端、代码度量 |
| `notes` | `raw-docs/notes/` | 语言与工具速查：`cpp` / `golang` / `js` / `python` / `devops` 各是二级主题 |

构建链路：

1. `npm run wiki`（`dev` / `build` 前自动触发）扫描 `raw-docs/**/*.{md,markdown,html}`
2. Markdown 原样复制成 `public/wiki/<slug>.md`，**构建期不预渲染 HTML**；标题、摘要、分类、二级主题、置顶权重抽出来写进索引
3. HTML 产成 `public/wiki/<slug>.html`：缺 `<html>` 的片段会补外壳，外链脚本在构建期下载到本地再改写路径
4. 产出 `public/wiki/index.json`，前端运行时 `fetch` 清单：md 取源文本用 `MarkdownView` 就地渲染，html 用 `iframe` 直连

两个约定：

- **置顶靠 frontmatter**：文件头写 `pin: 1`（正整数越小越靠前），`index.json` 里带 `pin`，列表页按它排序并显示「置顶」角标。本站 `project` 这一组固定占前四位。
- **分类排序按篇数**：分类 chip 按「篇数降序、同数按名字」排，新加的分类不会因为字母序被塞到列表最后。

硬约定：**HTML 文档禁止外链 CDN**，字体、样式、脚本、图片一律相对路径或内联，否则断网或镜像时排版会崩。md 没有独立静态页，需要长期可分享的文档请用 html 形式。

## 本站工程长文

- [深入前端：静态托管上的单页应用](/wiki/project/frontend)
- [深入后端：Cloudflare Worker + D1 的工程化](/wiki/project/backend)
- [代码量与复杂度：这个个人站的真实体量](/wiki/project/metrics)


## 工具箱里有什么

| 工具 | 说明 | 数据来源 |
| --- | --- | --- |
| JSON 格式化 | 格式化 / 压缩 / 树形折叠 / 报错定位 | 本地 |
| SQL 格式化 | 按子句换行、关键字大写 | 本地 |
| 时间戳转换 | 10 位秒 / 13 位毫秒与日期互转 | 本地 |
| UUID / 密码 | UUID、随机密码，字符集自选，可排除易混字符 | 本地 |
| 共享剪切板 | 贴一段日志生成免登录短链，24 小时自动失效 | 后端 `/clips` + D1 |

除共享剪切板外都在浏览器本地计算，不发请求、不留内容。短链的 code 本身就是凭据：不往 URL 里塞 token，也不提供列表接口，过期与非法码返回同一个 404，避免探测。

## 本地开发与发布

```bash
npm install        # Node 需要 ^20.19 或 >=22.12

npm run dev        # http://localhost:5173，predev 会先生成知识库产物
npm run wiki       # 只生成知识库产物
npm run build      # 类型检查 + 构建到 docs/
npm run preview    # 预览 docs/ 产物
npm run lint       # oxlint
```

两条容易踩的坑：

- **构建前先停掉 `npm run dev`**。dev server 的文件监听会锁住目录，报 `EPERM: rename docs_build -> docs`。构建脚本本身会先建到 `docs_build` 再整目录替换，失败时还会尝试还原，但别赌这一下。
- `docs/.nojekyll` 由构建脚本每次生成，**不能手写也不能删**。GitHub Pages 默认跑 Jekyll，会把 `docs/wiki/**/*.md` 再渲染一份同名 html，症状是已删除的路径 GET 还能 200。

## 账号与权限

- 登录态：token 存 `localStorage` 的 `blog_access_token`，启动时请求 `GET /auth/me` 拿用户与权限码
- 权限码由后端下发、前端只消费，形如 `resource:action:scope`（`post:update:own`、`user:delete:any`、`activity:read:any`…）；`RequirePermission` 负责未登录引导与无权限提示
- 个人空间、备忘录全部 self-scoped，owner 由 token 决定；`/admin` 需要 `invite_code:read:any`，更细的分区再各自校验
- 重置密码后旧 token 立即失效，前端收到 `auth:unauthorized` 自动退出

## 已知取舍

- 页面级只为 `Docs` / `Blog` / `PostDetail` 做了按需加载，工具箱里每个工具组件、写作面板的 `MarkdownView` 也是按需加载；首页、目录、空间、后台仍在主包里，换来的是常用页切换不闪占位
- 不引入任何 UI 组件库：看着朴素，但样式和交互都是自己的，不会为了改一个下拉去跟库的版本
- 知识库 md 是运行时渲染，所以没有「静态页面可被搜索引擎抓取」这层收益，这是体积与一致性的取舍

---

相关链接：[仓库 README](https://github.com/linx-zhang/linx-zhang.github.io#readme) · [返回首页](/)
