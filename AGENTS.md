# 个人站 · 上线与运维速查

给 AI 助手和未来的自己看的操作手册。**先读这一页，不要凭记忆猜命令。**
（本文件只记"怎么跑、怎么验证、哪里会炸"，不讲业务设计；业务说明见 `README.md`。）

## 0. 两个仓库、两个线上

| 角色 | 本地路径 | 远程 | 线上 |
|---|---|---|---|
| 前端静态站 | `D:\this_code\test\我的笔记\linx-zhang.github.io` | `linx-zhang/linx-zhang.github.io` | `https://linx-zhang.github.io`（Pages Source = GitHub Actions） |
| 后端 Worker | `D:\this_code\cloudflare-workers\api-worker` | `linx-zhang/cf-api-worker`（public） | `https://api-worker.linx-zhang.workers.dev` |
| Pages 代理 | — | — | `https://linx-api-78i.pages.dev`（前端 `API_BASE`） |

后端：D1 `api-worker-db`（id `dbea30d3-6a51-4c5c-a389-4f454f81ce9f`），入口 `src/entry.py`，cron `15 18 * * *`（UTC，= 北京时间 02:15）。

## 1. 上线前会跑什么（前端，CI 自动）

push 到 `main` 触发 `.github/workflows/build.yml`，job `build` 依次执行，任何一步红就不发布：

| # | 步骤 | 命令 |
|---|---|---|
| 1 | 装依赖 | `npm ci`（node 22 + npm 缓存） |
| 2 | 静态检查 | `npm run lint` → **oxlint** |
| 3 | 单元测试 | `npm test` → **vitest run**（当前 52 例） |
| 4 | 契约漂移 | `git clone --depth 1 .../cf-api-worker.git /tmp/cf-api-worker` 后 `node scripts/check-contract.mjs --api /tmp/cf-api-worker` |
| 5 | 构建 | `npm run build` = **`tsc -b`** + `node scripts/build-docs.mjs` |
| 6 | 产物完整 | `docs/index.html`、`docs/404.html`、`docs/wiki/index.json`、`docs/assets/` 存在 |
| 7 | 上传 | `actions/upload-pages-artifact@v3`（path `docs`） |

job `deploy` 只在 `refs/heads/main` 跑（PR 只验不发布），`concurrency: pages / cancel-in-progress: false`，不会把线上停在半截版本。
`docs/` 不入库——发布物就是 CI 刚构建出来的那份，所以本地不需要、也不应该再提交构建产物。

**顺序陷阱**：第 4 步 clone 的是后端 **main**。常量两边一起改时，**后端先 push**，否则前端 CI 必红。

## 2. 上线前会跑什么（后端，全手工，无 CI）

Windows 本地，`Bash` 工具不可用，一律 PowerShell。**部署必须带完整 PATH**（缺 `System32` 会在 Pyodide 启动器里报 `findstr` 找不到；缺 nodejs 报 `No node executable`）：

```powershell
$env:Path = "C:\Users\LinxZhang\.local\bin;C:\Program Files\nodejs;C:\Windows\System32;C:\Windows;" + $env:Path
$env:UV_PYTHON = "3.14"
Set-Location -LiteralPath "D:\this_code\cloudflare-workers\api-worker"

uv run --frozen pytest -q          # 当前 45 passed
uv run --frozen ruff check src tests   # 当前 All checks passed

# 只在改了 migrations/*.sql 时（不要加 --yes，会吐 help 并崩溃）
"y" | .\node_modules\.bin\wrangler.cmd d1 migrations apply api-worker-db --remote

# 只在改了依赖时；--upgrade 才会让 pydantic-core 挑到有 wheel 的版本
& ".venv\Scripts\pywrangler.exe" sync --upgrade

& ".venv\Scripts\pywrangler.exe" deploy     # 输出 Current Version ID，记下来
```

冒烟（部署完必做）：

```powershell
Invoke-WebRequest "https://api-worker.linx-zhang.workers.dev/"            # {"code":"ok",...}
Invoke-WebRequest "https://api-worker.linx-zhang.workers.dev/posts?limit=3&offset=0"  # 200
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

## 3. 契约常量（10 项，CI 挡漂移）

真源在**后端**，前端 `src/constants.ts` 是手抄副本，`scripts/check-contract.mjs` 的 `CHECKS` 表逐项比对：

`PAGE_SIZE=20`（`deps.py:DEFAULT_PAGE_LIMIT`）、`MEMO_BODY_MAX=2000`、`POST_TITLE_MAX=200`、`COMMENT_BODY_MAX=5000`、`CLIP_TITLE_MAX=80`、`CLIP_BODY_MAX=20_000`、`ACTIVITY_MAX_BATCH=50`、`ACTIVITY_MAX_VISITOR_BATCH=20`、`ACTIVITY_HEARTBEAT_MS=60_000`、`ACTIVITY_VISITOR_WINDOW_MS=30_000`（单位差 ×1000）。

改任何一边的数值都要同时改另一边，否则 CI 红。新增常量记得加进 `CHECKS` 表并本地跑一次：

```powershell
node scripts/check-contract.mjs --api "D:\this_code\cloudflare-workers\api-worker"
```

脚本退出码约定：`0` 一致、`1` 漂移、`2` 找不到后端仓库（CI 里算失败，不会静默通过）。

## 4. 线上接口口径（别踩）

- 路由**没有** `/api` 前缀：`GET /posts`、`GET /memos`…（`/api/posts` → 404）。
- 分页参数是 **`limit` / `offset`**（`page`/`limit` 组合 → 422）。
- 软删语义：读用 `deleted_at IS NULL` 过滤，写用 `UPDATE ... SET deleted_at = datetime('now')`；全站时间统一 UTC datetime 字符串 `YYYY-MM-DD HH:MM:SS`，没有 date 型字段。

## 5. 索引与清理任务现状

- 存活行 partial index 已在线上（`0015_live_partial_indexes.sql`）：`idx_posts_live_created_id`、`idx_memos_live_user_created`、`idx_memos_live_user_done`、`idx_comments_live_post_created_id`。旧的全量索引保留（带 author/q/done 过滤的查询还要用）。
- `posts` 列表计划仍是 `SCAN ... USING INDEX idx_posts_live_created_id`——表只有几十行，规划器认为全扫更便宜，但扫的是只含存活行的索引，属预期。
- cron 三段：activity 保留 30 天 → cache 清理 → memos 墓碑 90 天硬删（`src/tasks/memo_tombstone.py`）。memos 表是 AUTOINCREMENT，硬删后 id 依然永不复用。

## 6. 已知缺口（别误以为有闸门）

- **后端零 CI**：pytest / ruff / 迁移顺序全靠人记。
- **迁移无前置校验**：没有 dry-run，也没有"部署前确认迁移已应用"的检查；先 deploy 后迁移不会报错，只会行为不对。
- **契约只挡前端一侧**：后端单独改 `models.py` 时，后端仓库没有任何东西会红，要等下次前端 push 才暴露。
- **部署后冒烟是手敲的**，没脚本化。

## 7. 已验证的边界（别重复踩）

- 已否决：pickle→JSON（用户原话"随意 py 对象都可以保存"）、CSS 拆分与 hex 变量化、目录命名改造、原生 `input[type=date]`。
- 站内时间统一 UTC datetime；博客编辑必须支持全屏。
