// 前端分层依赖检查：只允许「页面往下拿能力」，不允许底层反向依赖页面。
//
// 分层不是目录好看，而是出问题时能一眼判断该改谁：
//   utils      纯函数，谁都能用，自己不能依赖任何上层
//   api        HTTP/类型，只能依赖 utils
//   hooks      通用状态机，可依赖 api/utils，不依赖具体组件/页面
//   components 通用 UI，可依赖 api/auth/utils，不依赖 pages
//   pages      页面与业务编排，可依赖所有层
//
// auth 与 activity 是横切关注点：允许被 components/pages 使用，也允许它们
// 使用通用组件与 api；这里只挡住「横切层反向依赖页面」这种最难拆的依赖。
//
// 用法：npm run check:layers；CI 在 lint 之后、测试之前跑。

import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SRC = path.resolve(HERE, '..', 'src')

const LAYERS = new Set([
  'utils',
  'api',
  'hooks',
  'components',
  'auth',
  'activity',
  'pages',
])

// 每个层禁止依赖的上层。未列出的层（pages）不限制。
const FORBIDDEN = {
  utils: ['api', 'auth', 'components', 'hooks', 'activity', 'pages'],
  api: ['auth', 'components', 'hooks', 'activity', 'pages'],
  hooks: ['components', 'pages'],
  components: ['pages'],
  auth: ['activity', 'pages'],
  activity: ['pages'],
}

const EXTS = new Set(['.ts', '.tsx'])

async function sourceFiles(dir) {
  const out = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...await sourceFiles(full))
    } else if (EXTS.has(path.extname(entry.name))) {
      out.push(full)
    }
  }
  return out
}

function layerOf(relPath) {
  const parts = relPath.split('/')
  return LAYERS.has(parts[0]) ? parts[0] : null
}

function resolveTarget(file, specifier) {
  let target
  if (specifier.startsWith('@/')) {
    target = path.resolve(SRC, specifier.slice(2))
  } else if (specifier.startsWith('./') || specifier.startsWith('../')) {
    target = path.resolve(path.dirname(file), specifier)
  } else {
    return null
  }
  const rel = path.relative(SRC, target).split(path.sep).join('/')
  if (rel.startsWith('..')) return null
  return rel.replace(/\.(ts|tsx)$/, '')
}

function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
}

// 只匹配 `from '...'` 与 `import '...'`；先去掉注释，避免把文档示例当依赖。
const IMPORT_RE = /(?:from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"])/g

function importsOf(text) {
  const found = []
  for (const match of stripComments(text).matchAll(IMPORT_RE)) {
    found.push(match[1] ?? match[2])
  }
  return found
}

let checked = 0
const violations = []

for (const file of await sourceFiles(SRC)) {
  const rel = path.relative(SRC, file).split(path.sep).join('/')
  const layer = layerOf(rel)
  if (!layer) continue
  checked += 1
  const text = await readFile(file, 'utf8')
  const forbidden = FORBIDDEN[layer] ?? []
  for (const specifier of importsOf(text)) {
    const target = resolveTarget(file, specifier)
    if (!target) continue
    const targetLayer = layerOf(target)
    if (targetLayer && forbidden.includes(targetLayer)) {
      violations.push(`${rel} -> ${targetLayer} (${specifier})`)
    }
  }
}

if (violations.length) {
  console.error('Layer check failed:')
  for (const item of violations) console.error(`  ${item}`)
  console.error('\nAllowed: pages -> everything; components/hooks/api/utils -> lower layers only.')
  process.exit(1)
}

console.log(`Layer check OK (${checked} source files).`)
