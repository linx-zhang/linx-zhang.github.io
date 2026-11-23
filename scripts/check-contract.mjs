#!/usr/bin/env node
/**
 * 契约漂移检查：把前端 src/constants.ts 里的「和后端约定一致」的数字，
 * 逐个拿去跟后端仓库的真源（models.py / deps.py / activity.py）比。
 *
 * 手抄的常量不会因为「有人忘了同步」而报错，所以放在 CI 里当闸门：
 * `npm run check:contract -- --api <后端仓库路径>`，CI 会先 clone 后端仓库。
 *
 * 用法：
 *   node scripts/check-contract.mjs --api ../cf-api-worker
 *   API_REPO=/path/to/api-worker node scripts/check-contract.mjs
 * 找不到后端仓库时以退出码 2 结束（CI 里算失败，而不是静默通过）。
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--api' || arg === '-a') out.api = argv[i + 1]
    else if (arg.startsWith('--api=')) out.api = arg.slice('--api='.length)
  }
  return out
}

/** 常量字面量可能写成 20_000 或 5 * 60_000：只允许数字、下划线、乘号 */
function evalNumericLiteral(raw) {
  const clean = raw.replace(/_/g, '').replace(/ /g, '')
  if (!/^[\d*]+$/.test(clean)) return null
  return clean.split('*').reduce((acc, part) => acc * Number(part), 1)
}

/** 前端：export const NAME = <数字表达式> */
function readFrontendConstants() {
  const text = readFileSync(join(ROOT, 'src/constants.ts'), 'utf8')
  const values = new Map()
  const re = /export const ([A-Z0-9_]+)\s*=\s*([0-9][0-9_ *]*[0-9]|[0-9])/g
  for (const [, name, literal] of text.matchAll(re)) {
    const value = evalNumericLiteral(literal)
    if (value !== null) values.set(name, value)
  }
  return values
}

// 每一项：前端常量 → 后端真源（文件 + 定位用的正则，取第一个捕获组）
// scale：前端单位常常比后端细（毫秒 vs 秒），换算后再比
const CHECKS = [
  { name: 'PAGE_SIZE', file: 'src/api/deps.py', re: /DEFAULT_PAGE_LIMIT\s*=\s*(\d+)/ },
  { name: 'MEMO_BODY_MAX', file: 'src/api/models.py', re: /MEMO_BODY_MAX\s*=\s*(\d+)/ },
  { name: 'POST_TITLE_MAX', file: 'src/api/models.py', re: /title: str = Field\(min_length=1, max_length=(\d+)\)/ },
  {
    name: 'COMMENT_BODY_MAX',
    file: 'src/api/models.py',
    re: /class CommentIn[\s\S]{0,400}?body: str = Field\(min_length=1, max_length=(\d+)\)/,
  },
  { name: 'CLIP_TITLE_MAX', file: 'src/api/models.py', re: /CLIP_TITLE_MAX\s*=\s*(\d+)/ },
  { name: 'CLIP_BODY_MAX', file: 'src/api/models.py', re: /CLIP_BODY_MAX\s*=\s*(\d[\d_]*)/ },
  {
    name: 'ACTIVITY_MAX_BATCH',
    file: 'src/api/models.py',
    re: /events: list\[ActivityEventIn\][^\n]*max_length=(\d+)/,
  },
  {
    name: 'ACTIVITY_MAX_VISITOR_BATCH',
    file: 'src/api/models.py',
    re: /events: list\[AnonymousActivityEventIn\][^\n]*max_length=(\d+)/,
  },
  {
    name: 'BATCH_DELETE_MAX',
    file: 'src/api/models.py',
    re: /ids: list\[int\][^\n]*max_length=(\d+)/,
  },
  {
    name: 'ACTIVITY_VISITOR_WINDOW_MS',
    file: 'src/api/routers/activity.py',
    re: /VISITOR_RATE_LIMIT_SECONDS\s*=\s*(\d+)/,
    scale: 1000, // 前端毫秒，后端秒
  },
  { name: 'RESUME_TITLE_MAX', file: 'src/api/models.py', re: /RESUME_TITLE_MAX\s*=\s*(\d+)/ },
  { name: 'RESUME_NOTE_MAX', file: 'src/api/models.py', re: /RESUME_NOTE_MAX\s*=\s*(\d+)/ },
  { name: 'RESUME_HTML_MAX', file: 'src/api/models.py', re: /RESUME_HTML_MAX\s*=\s*(\d[\d_]*)/ },
]

const args = parseArgs(process.argv.slice(2))
const apiPath = args.api || process.env.API_REPO
if (!apiPath) {
  console.error('找不到后端仓库：用 --api <path> 或 API_REPO 环境变量指定')
  process.exit(2)
}
const apiRoot = isAbsolute(apiPath) ? apiPath : resolve(ROOT, apiPath)
if (!existsSync(join(apiRoot, 'src/api/models.py'))) {
  console.error(`后端仓库路径不像 api-worker：${apiRoot}`)
  process.exit(2)
}

const frontend = readFrontendConstants()
const failures = []
const rows = []

for (const check of CHECKS) {
  const expected = frontend.get(check.name)
  if (expected === undefined) {
    failures.push(`${check.name}: 前端 constants.ts 里找不到这个常量`)
    continue
  }
  const filePath = join(apiRoot, check.file)
  if (!existsSync(filePath)) {
    failures.push(`${check.name}: 后端缺文件 ${check.file}`)
    continue
  }
  const body = readFileSync(filePath, 'utf8')
  const match = body.match(check.re)
  if (!match) {
    failures.push(`${check.name}: ${check.file} 里没匹配到规则（可能被重命名/改写法）`)
    continue
  }
  const backendRaw = evalNumericLiteral(match[1])
  if (backendRaw === null) {
    failures.push(`${check.name}: 后端值 ${match[1]} 不是数字字面量`)
    continue
  }
  const backend = check.scale ? backendRaw * check.scale : backendRaw
  const ok = backend === expected
  rows.push({ name: check.name, frontend: expected, backend, ok })
  if (!ok) failures.push(`${check.name}: 前端 ${expected} ≠ 后端 ${backend}`)
}

const width = Math.max(...rows.map((row) => row.name.length), 10)
for (const row of rows) {
  console.log(
    `${row.ok ? 'OK  ' : 'FAIL'} ${row.name.padEnd(width)} 前端 ${String(row.frontend).padStart(6)}  后端 ${String(row.backend).padStart(6)}`,
  )
}
console.log(`\n${rows.filter((row) => row.ok).length}/${CHECKS.length} 项一致`)

if (failures.length > 0) {
  console.error('\n契约漂移：')
  for (const failure of failures) console.error(` - ${failure}`)
  process.exit(1)
}
