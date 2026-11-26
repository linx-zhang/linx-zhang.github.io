# 个人站 · 上线与运维速查

给 AI 助手和未来的自己看的操作手册。**先读这一页，不要凭记忆猜命令。**
（本文件只记"怎么跑、怎么验证、哪里会炸"，不讲业务设计；业务说明见 `README.md`，**分层与改动落点见 `ARCHITECTURE.md`**。）

## 0. 两个仓库、两个线上

| 角色 | 本地路径 | 远程 | 线上 |
|---|---|---|---|
| 前端静态站 | `D:\this_code\test\我的笔记\linx-zhang.github.io` | `linx-zhang/linx-zhang.github.io` | `https://linx-zhang.github.io`（Pages Source = GitHub Actions） |
| 后端 Worker | `D:\this_code\cloudflare-workers\api-worker` | `linx-zhang/cf-api-worker`（public） | `https://api-worker.linx-zhang.workers.dev` |
| Pages 代理 | — | — | `https://linx-api-78i.pages.dev`（前端 `API_BASE`） |

后端：D1 `api-worker-db`（id `dbea30d3-6a51-4c5c-a389-4f454f81ce9f`），入口 `src/entry.py`，两个 cron（UTC）：`15 18 * * *` 日更清理（= 北京时间 02:15）、`0 * * * *` 每小时折分析账本。

## 1. 上线前会跑什么（前端，CI 自动）

push 到 `main` 触发 `.github/workflows/build.yml`，job `build` 依次执行，任何一步红就不发布：

| # | 步骤 | 命令 |
|---|---|---|
| 1 | 装依赖 | `npm ci`（node 22 + npm 缓存） |
| 2 | 静态检查 | `npm run lint` → **oxlint** |
| 3 | 分层依赖 | `npm run check:layers` → **scripts/check-layers.mjs** |
| 4 | 单元测试 | `npm test` → **vitest run**（当前 206 例） |
| 5 | 契约漂移 | `git clone --depth 1 .../cf-api-worker.git /tmp/cf-api-worker` 后 `node scripts/check-contract.mjs --api /tmp/cf-api-worker` |
| 6 | 构建 | `npm run build` = **`tsc -b`** + `node scripts/build-docs.mjs` |
| 7 | 产物完整 | `docs/index.html`、`docs/404.html`、`docs/wiki/index.json`、`docs/assets/` 存在 |
| 8 | 上传 | `actions/upload-pages-artifact@v3`（path `docs`） |

job `deploy` 只在 `refs/heads/main` 跑（PR 只验不发布），`concurrency: pages / cancel-in-progress: false`，不会把线上停在半截版本。
`docs/` 不入库——发布物就是 CI 刚构建出来的那份，所以本地不需要、也不应该再提交构建产物。

**顺序陷阱**：第 5 步 clone 的是后端 **main**。常量两边一起改时，**后端先 push**，否则前端 CI 必红。

## 2. 上线前会跑什么（后端，CI 验、手工部署）

push 到 `main`、PR、手动触发都会跑后端 `.github/workflows/ci.yml`：`uv sync --frozen`、`pytest`、`ruff check src tests scripts`、`scripts/check-layers.py`、`scripts/check-api-doc.py`。`tests/test_migrations.py` 还会查迁移文件名、编号连续性和空文件。**CI 不部署、不碰线上 D1**，`pywrangler deploy` 仍要手工执行。

Windows 本地，`Bash` 工具不可用，一律 PowerShell。**部署必须带完整 PATH**（缺 `System32` 会在 Pyodide 启动器里报 `findstr` 找不到；缺 nodejs 报 `No node executable`）：

```powershell
$env:Path = "C:\Users\LinxZhang\.local\bin;C:\Program Files\nodejs;C:\Windows\System32;C:\Windows;" + $env:Path
$env:UV_PYTHON = "3.14"
Set-Location -LiteralPath "D:\this_code\cloudflare-workers\api-worker"

uv run --frozen pytest -q          # 当前 168 passed（含 tests/test_routes.py 的路由层用例）
uv run --frozen ruff check src tests scripts   # 当前 All checks passed
uv run --frozen python scripts/check-layers.py  # 应输出 Layer check OK
uv run --frozen python scripts/check-api-doc.py  # routes: 55 doc rows: 55

# 只在改了 migrations/*.sql 时（不要加 --yes，会吐 help 并崩溃）
"y" | .\node_modules\.bin\wrangler.cmd d1 migrations apply api-worker-db --remote

# 只在改了依赖时；--upgrade 才会让 pydantic-core 挑到有 wheel 的版本
& ".venv\Scripts\pywrangler.exe" sync --upgrade

& ".venv\Scripts\pywrangler.exe" deploy     # 输出 Current Version ID，记下来
```

冒烟（部署完必做）：

```powershell
Invoke-WebRequest "https://api-worker.linx-zhang.workers.dev/"                        # {"code":"ok",...}
Invoke-WebRequest "https://api-worker.linx-zhang.workers.dev/api/posts?limit=3&offset=0"  # 200
```

### 后端命令的四个坑

1. **`--yes` 不能用**：`wrangler d1 migrations apply` 带 `--yes` 会打印 help 后进程崩溃（`UV_HANDLE_CLOSING`）。用 `"y" | ...` 走非交互确认。
2. **解释器版本**：`compatibility_date` 已越过 Pyodide 3.14 分界日，`pywrangler` 按 **3.14** 编依赖，`pylock.toml` 的 `requires-python >=3.14.2` 会和 3.12 本地解释器冲突，报 "The requested interpreter resolved to Python 3.12.16..."。故 `UV_PYTHON=3.14`，`.python-version` 也是 `3.14`。
3. **`pylock.toml` 是 gitignore 的生成物**：删掉不会丢东西，`pywrangler sync` 会重建；真正入库的是 `uv.lock`（`uv run --frozen` 依赖它）。
4. **`uv run` 包 `pywrangler` 可以，但 PATH 必须已补全**，否则报错发生在启动器里、不在 Python 侧。

### D1 查询的坑

- SQL **必须单行**，多行报 `incomplete input`。
- `PRAGMA auto_vacuum/page_count/freelist_count` 被拒（`ITE_AUTH` / 7500），`page_size` 可读。
- 读线上：`& ".\node_modules\.bin\wrangler.cmd" d1 execute api-worker-db --remote --json --command "<单行 SQL>"`。

## 3. 契约常量（13 项，CI 挡漂移）

真源在**后端**，前端 `src/constants.ts` 是手抄副本，`scripts/check-contract.mjs` 的 `CHECKS` 表逐项比对：

`PAGE_SIZE=20`（`deps.py:DEFAULT_PAGE_LIMIT`）、`MEMO_BODY_MAX=2000`、`POST_TITLE_MAX=200`、`COMMENT_BODY_MAX=5000`、`CLIP_TITLE_MAX=80`、`CLIP_BODY_MAX=20_000`、`ACTIVITY_MAX_BATCH=50`、`ACTIVITY_MAX_VISITOR_BATCH=20`、`BATCH_DELETE_MAX=50`、`ACTIVITY_VISITOR_WINDOW_MS=30_000`（单位差 ×1000）、`RESUME_TITLE_MAX=100`、`RESUME_NOTE_MAX=200`、`RESUME_HTML_MAX=50_000`。

改任何一边的数值都要同时改另一边，否则 CI 红。新增常量记得加进 `CHECKS` 表并本地跑一次：

```powershell
node scripts/check-contract.mjs --api "D:\this_code\cloudflare-workers\api-worker"
```

脚本退出码约定：`0` 一致、`1` 漂移、`2` 找不到后端仓库（CI 里算失败，不会静默通过）。

## 4. 线上接口口径（别踩）

- 业务接口统一挂在 **`/api`** 下：`GET /api/posts`、`/api/memos`…（后端 `src/api/app.py` 的 `API_PREFIX`）。
  根路径只留给平台：`/` 是健康检查，`/docs`、`/openapi.json` 是 FastAPI 自带。前端拼地址一律用
  `src/api/client.ts` 的 **`API_ROOT`**，不要用 `API_BASE` 直接拼业务路径。
- 分页参数是 **`limit` / `offset`**（`page`/`limit` 组合 → 422）。
- 软删语义：读用 `deleted_at IS NULL` 过滤，写用 `UPDATE ... SET deleted_at = datetime('now')`；全站时间统一 UTC datetime 字符串 `YYYY-MM-DD HH:MM:SS`，没有 date 型字段。

## 5. 索引与清理任务现状

- 存活行 partial index 已在线上：`idx_posts_live_created_id`、`idx_memos_live_user_created`、`idx_memos_live_user_done`、`idx_comments_live_post_created_id`（0015），以及消耗品的 `idx_consumable_items_live_user_created`、`idx_consumable_cycles_live_item_started`、`idx_consumable_cycles_live_item_ended`（0016）。旧的全量索引保留（带 author/q/done 过滤的查询还要用）。
- `posts` 列表计划仍是 `SCAN ... USING INDEX idx_posts_live_created_id`——表只有几十行，规划器认为全扫更便宜，但扫的是只含存活行的索引，属预期。
- 消耗品还有一条**唯一** partial index：`idx_consumable_cycles_open_item`（`item_id WHERE ended_on IS NULL AND deleted_at IS NULL`），保证一个物品同时只有一轮进行中；接口 409 只是友好提示，真正的兜底在这条索引。
- 简历有两条索引（0017）：`idx_resumes_live_created_id` 服务后台列表，`idx_resumes_single_default` 是 `is_default = 1 AND deleted_at IS NULL` 的唯一索引，保证全站同时只有一份默认简历；切换默认必须在同一事务里先清旧、再设新。
- 日更 cron 五步：activity 保留 30 天 → cache 清理 → memos 墓碑 180 天硬删 → 消耗品 items/cycles 墓碑 90 天硬删 → 失效简历分享短链立即删；日更**不再**折分析账本，`0 * * * *` 的小时触发器只折分析账本。memos / consumable_items 都是 AUTOINCREMENT，硬删后 id 依然永不复用。
  - **永不清理**：`users`、`resumes`、`posts`、`comments`、`invite_codes`——账号、简历、博客与邀请历史都是有价值数据；`resumes` 即使软删也保留，只删它失效的 `resume_shares`。
  - 消耗品删除顺序固定：先 `consumable_cycles` 再 `consumable_items`（外键 `item_id → consumable_items.id`），父行只有在没有子周期时才会被删。

## 6. 已知缺口（别误以为有闸门）

- **后端 CI 只验、不部署**：pytest / ruff / 迁移文件顺序会拦，但 `pywrangler deploy` 和线上冒烟仍靠人敲。
- **迁移无 dry-run**：`tests/test_migrations.py` 只查文件名、编号连续和文件非空；没有"部署前确认迁移已应用"的检查，先 deploy 后迁移不会报错，只会行为不对。
- **契约检查只覆盖前端一侧**：后端单独改 `models.py` 时，后端 CI 不跑 `check-contract.mjs`，要等下次前端 push 才暴露。
- **部署后冒烟是手敲的**，没脚本化。
- **Pages 的 `index.html` 有缓存**：`public/404.html` 回根路径必须带 `?v=Date.now()`；改回 `location.replace('/')` 会让手机深链刷新继续加载旧资源，表现为“发布没生效”。

## 7. 已验证的边界（别重复踩）

- 已否决：pickle→JSON（用户原话"随意 py 对象都可以保存"）、CSS hex 变量化、目录命名改造、原生 `input[type=date]`。CSS **按组件归属拆文件**已采纳（`pages/Space/` 下 `Space.css` 外壳 + `SpaceMemos.css` / `SpaceConsumables.css` / `SpaceCalendar.css`，各自就近 `import`），只是不引入颜色变量。
- 站内时间统一 UTC datetime；博客编辑必须支持全屏。

