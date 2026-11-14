
# 深入前端：静态托管上的单页应用

这个站点的前端没有服务端渲染、没有构建流水线，也没有运维面板：构建产物提交进 `docs/`，GitHub Pages 直接托管，`push` 就等于上线。所有「像后端」的能力——账号、文章、评论、备忘录、共享剪切板、访问统计——都在浏览器里发出，跨域打到 Cloudflare Worker。

这种约束下，前端架构要解决的不是「怎么把页面画出来」，而是三件更硬的事：**在只有静态文件的环境里保住路由与深链**、**把接口契约收敛到一个入口**、**在没有框架兜底的情况下让列表、浮层、权限这些高频结构只有一份实现**。

先给结论：98 个文件、14979 行（`.tsx` 7585 / `.ts` 2097 / `.css` 5297），25 个页面级样式文件，19 个自研组件、4 个通用 hook。规模不大，但每一层都只留一个出口。

## 一、约束反过来决定架构

| 约束 | 直接后果 |
| --- | --- |
| 静态托管，没有服务端路由 | 深链刷新必须靠 `404.html` + `sessionStorage` 兜底 |
| 无 SSR，首屏只有 HTML 外壳 | 首屏内容必须由客户端渲染，因此首包体积直接等于首屏时间 |
| push 即上线，没有灰度 | 接口契约必须前后端同源声明，改一处就要改两处 |
| 后端是独立仓库的 Worker | CORS、错误码、分页参数只能靠约定，不能靠同仓类型共享 |

第三条是这套代码里最容易被忽视的设计动因：`src/constants.ts` 顶部写着「每一条都对应后端的一处约束」。分页大小 20、备忘录正文 2000、文章标题 200、评论 5000、共享剪切板 20000、事件批量 50/20……这些数字在前端只写一次，页面和组件统一引用，避免出现「前端放行、后端 422」的静默不一致。

## 二、入口：三层包裹，七条路由

`main.tsx` 只有一百来行，但顺序是刻意的：

```tsx
<BrowserRouter>
  {/* 错误边界必须在 Provider 外层：Provider 自己崩了也要能显示降级页 */}
  <ErrorBoundary>
    <AuthProvider>
      <ActivityTracker />
      <Routes>…</Routes>
    </AuthProvider>
  </ErrorBoundary>
</BrowserRouter>
```

- `ErrorBoundary` 在最外层，因为 `AuthProvider` 启动时要请求 `/auth/me`，它自己出错也要有降级页，而不是白屏。
- `ActivityTracker` 挂在 Provider 内部、路由之外：它需要登录态去批量上报事件，但不该随页面切换重建。
- 路由表本身只有 7 项，集中在 `src/routes.ts` 的 `APP_ROUTES`，页面代码不写裸路径字符串。

### 深链兜底的三步

GitHub Pages 对 `/blog/36` 这类路径没有对应文件，会返回 404 页面。兜底链路是：

1. `public/404.html` 把原始路径写进 `sessionStorage`，然后跳回 `/`；
2. `main.tsx` 在 `BrowserRouter` 初始化**之前**读出路径，用 `history.replaceState` 还原；
3. `isKnownDeepLink()` 做白名单校验，只恢复 `/wiki`、`/blog`、`/tools`、`/admin`、`/profile`、`/space` 下的路径。

第 3 步不是洁癖：`sessionStorage` 的内容可以被同源脚本写入，直接 `replaceState` 到任意 URL 等于把一个开放重定向入口交给外部输入。白名单把它关掉。

### 懒加载只切三刀

`Docs`、`Blog`、`PostDetail` 三块单独成包，理由是它们共享 `react-markdown` / `rehype` / `prism` 这一串重依赖；首页、知识库列表、空间、工具箱、后台保持静态导入，换页不闪占位。工具箱内部再切一刀：五个工具组件各自 `lazy()`，进 `/tools` 只加载图标列表，点进去才拉对应实现。

## 三、数据层：一个函数收口

`src/api/client.ts` 是全站唯一的数据传输入口，`auth` / `blog` / `admin` / `memos` / `clips` 这些模块只提供类型化的接口函数，不自己拼 `fetch`。

收口带来的第一件事是把错误语义定死：

```ts
if (response.status === 401 && !options.skipAuthReset) resetAuth()
```

- **401 才清登录态**：token 失效、密码重置、账号注销都属于这一类。
- **403 是业务结果**：没有权限删这篇文章，不该把用户直接踢下线；文案交给 `errorMessage`。
- `skipAuthReset` 专给登录/注册端点：那边 401 的含义是「这次填的密码不对」，如果也走「清 token + 广播 `auth:unauthorized`」，登录框会被自己的事件关掉，用户看到的现象就是「点登录 → 窗口消失 → 没有任何提示」。

第二件事是让「后端返回了不是 JSON 的东西」也能定位：

```ts
throw new ApiError(response.status, 'invalid_response', '响应不是 JSON，接口地址可能指向了错误的服务')
```

第三件事是信封解包只做一次。后端统一返回 `{ code, detail, data }`，`request<T>()` 校验 `data` 存在后直接返回业务数据，页面拿到的永远是类型化的对象，而不是 `any`。

## 四、列表：两套 hook、一个状态机

站内有 9 个列表（文章、评论、用户、邀请码、日志、分析、备忘录、剪切板记录……）。它们的取数语义只有两种，所以只留两个 hook：

| hook | 语义 | 用在 |
| --- | --- | --- |
| `usePagedList` | 「取一页、替换整页」 | 博客列表、后台各表 |
| `useInfiniteList` | 「先看一页、按需追加」 | 个人空间备忘录 |

`usePagedList` 的注释里写着一句教训：「任何 reload / reset 都不会把数据叠成两遍（个人空间曾因混用两种语义而出现重复条目）」。这句话是这个 hook 存在的全部理由——两种语义混用，症状是列表出现重复行，而且只在特定操作序列下复现。

几个容易写错的细节，现在都在 hook 里解决了：

- **竞态**：effect 里用 `cancelled` 标记，快速切页/切筛选时旧请求的 `then` 不再写入状态。
- **同页刷新**：页码不变不会触发 effect，所以 `reload()` / `goToPage(当前页)` 靠 `reloadKey` 自增来强制重取。
- **受控页码**：博客列表把页码放在 URL 里（分享链接能回到同一页），传 `page` + `onPageChange`，hook 不再自己维护页码，也不会重复 bump。
- **`total` 不糊弄**：接口没给 `total` 就是 `null`，不允许用 `items.length` 冒充——那会让「共 3 条」在第二页也显示 3。

渲染侧对应一个 `ListState`：loading / error / empty / missing 四态的唯一实现。之前每个列表页各写一份同样的占位 markup，文案和重试按钮位置全靠自觉；现在页面只决定「什么时候渲染列表」。`count` 参数解决了一个具体问题：加载中若还留着上一页数据，就不该显示「空空如也」。

## 五、组件与浮层：自研的代价与回报

19 个组件目录 + 4 个通用 hook，没有引入任何 UI 组件库。看着朴素，但代价和回报都很明确：

| 自研件 | 解决的现实问题 |
| --- | --- |
| `Select` / `DatePicker` / `DateRangePicker` | 原生控件在中文日期、范围选择、键盘操作上不可控；原生 `input[type=date]` 的显示格式随浏览器变 |
| `FloatingPanel`（`useFloatingPanel`） | 下拉、日期面板、菜单共用一套定位与关闭逻辑：点外部关闭、Esc 关闭、滚动跟随 |
| `DialogShell` / `Modal` / `ConfirmDialog` | 焦点锁定、Esc、遮罩、层级只有一份实现 |
| `RequirePermission` / `RequireRole` | 权限门是体验层守卫，服务端仍对每个管理请求做权威校验 |
| `ListState` / `RouteFallback` | 三态占位与懒加载占位的统一出口 |
| `AuthMenu` / `AuthModal` / `Avatar` / `ProfileDialog` | 登录、改资料、头像上传这一个闭环 |

`RequirePermission` 的注释特意写了「体验层路由守卫；服务端仍会对每个管理请求做权威校验」——这句话防止后来者把它当成安全边界。前端能做的只是别让用户看到进不去的页面，真正的判定在 Worker 的 `require_permission(code)`。

权限码本身也由后端下发：`/auth/me` 返回 `permissions` 数组，前端 `usePermission().has(code)` 消费，页面里不写 `role === 'admin'` 这种硬编码。角色改名、加一个 `internal` 角色，前端一行都不用改。

## 六、样式：全局层 + 页面层

25 个 CSS 文件、5297 行，结构是「两层」：

- `styles/layers.css` + `styles/shared.css`：跨页面共用的按钮、错误提示、根级重置。
- 各页面自己的 `*.css`：只写本页布局。

`shared.css` 的存在有个具体原因，注释写得很直白：

> Blog 页是懒加载路由，这些规则若留在 `Blog.css`，先进入 `/admin` 时按钮会没有样式。

同理，`html { scrollbar-gutter: stable }` 是为了修一个很隐蔽的抖动：列表从「短（无滚动条）」切到「长（有滚动条）」时，居中容器会被滚动条宽度推着左右抖——筛选、翻页、空态来回切最容易看见。

页面样式里体量最大的是 `pages/Admin/Admin.css`（1186 行）、`Tools.css`（788 行）、`Space.css`（632 行）、`Blog.css`（570 行）。这四个页面本身就是多个分区的复合体，样式集中在一处反而比拆成十几个文件更好定位——这是有意识的取舍，不是没整理。

## 七、体积：懒加载的账

最近一次构建的产物：

| 产物 | 体积 | 说明 |
| --- | --- | --- |
| `MarkdownView-*.js` | 917.8 KB | `react-markdown` + `rehype-raw` + `prism` 全在它里面 |
| `index-*.js` | 336.5 KB | 首屏主包：React、Router、布局、首页、列表、空间、后台外壳 |
| `SqlTool-*.js` | 260.4 KB | SQL 工具按需加载 |
| `index-*.css` | 52.3 KB | 全局 + 首屏页面样式 |
| `MarkdownView-*.css` | 35.2 KB | `github-markdown-css` + `prism-one-light` |

13 个 JS chunk 合计约 1584.5 KB，其中 MarkdownView 一个就占了 58%。这块钱花得值：它只在打开文章、知识库阅读、写作预览时出现，首屏不碰它。反过来，主包 336.5 KB 里有相当一部分是「常用页不闪占位」的代价——空间、工具箱、后台外壳都静态进包，换来的是切页零等待。

CSS 合计约 102.8 KB，主包 52.3 KB、MarkdownView 35.2 KB，基本和页面体量对应。

## 八、几个写进代码里的约定

1. **目录即组件名**：每个组件一个目录，入口固定 `index.tsx`，样式与逻辑同目录。好处是新增组件不用想文件放哪；代价是 `import` 路径里看不到文件名（编辑器里靠目录名辨认）。
2. **页面不写 `fetch`**：所有请求经 `api/*.ts` 的类型化函数 → `request()`。新增一个接口的标准动作是「加一个函数 + 一个类型」，不是「在页面里 `fetch` 一下」。
3. **常量单点**：前后端共用的数字只写 `src/constants.ts`。
4. **错误只抛 `ApiError`**：页面拿到的 `err` 统一走 `errorMessage()` 转文案，不各自 `String(err)`。
5. **懒加载按依赖切，不按页面切**：切的是「共享重依赖」的边界（Markdown 栈），不是「看起来更小的页面」。

## 九、热点与下一步

按行数排，前五名里有四个是样式：`Admin.css` 1186、`Tools.css` 788、`Space.css` 632、`Blog.css` 570；逻辑侧最大的是 `Space/index.tsx` 537 行、`Blog/PostDetail.tsx` 472 行、`Blog/index.tsx` 398 行。

`Space/index.tsx` 537 行里混了「备忘录列表 + 筛选 + 新建/编辑表单 + 到期日选择 + 删除确认」五件事，是最值得下一步拆的：把表单状态与提交逻辑抽成 `useMemoEditor`，页面只留编排。`Admin.css` 1186 行则是后台五个分区共用一个文件，等后台再长分区时，按分区加注释分节比拆文件更实际。

## 十、取舍清单

- 没有 SSR：SEO 与首屏速度都让给了「零运维」；知识库 md 还是运行时渲染，搜索引擎只能看到外壳。
- 没有 UI 库：省掉版本与主题适配，但每个控件都要自己处理键盘、焦点、移动端。
- 常用页静态进包：首包变大，换页不闪。
- 样式按页面集中：定位快，但单文件行数偏高。

一句话总结：这套前端不是「组件多得漂亮」，而是把每个高频结构都压成了唯一实现——路由只有一张表、请求只有一个入口、列表只有两套语义、占位只有一份、权限只有一个消费口。规模再翻一倍，新增页面仍然只是「加一条路由 + 一个 api 函数 + 一个页面目录」。
