// 构建期把 raw-docs 里的每篇文档产成一个可独立寻址的静态页：
//   md/markdown -> public/wiki/<slug>.html（github-markdown-css + prism 主题内联）
//   html        -> public/wiki/<slug>.html（原样保真；缺 <html> 的片段补壳；外链脚本改本地 vendor）
// 同时产出 public/wiki/index.json 供站内列表运行时读取。
//
// 约定（见 docs/wiki-convention.md）：HTML 文档禁止外链 CDN，所有资源必须相对路径或内联。

import fs from 'node:fs/promises'
import path from 'node:path'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypeRaw from 'rehype-raw'
import rehypePrismPlus from 'rehype-prism-plus'
import rehypeStringify from 'rehype-stringify'

const ROOT = path.resolve(import.meta.dirname, '..')
const SRC_DIR = path.join(ROOT, 'raw-docs')
const OUT_DIR = path.join(ROOT, 'public', 'wiki')
const VENDOR_CACHE = path.join(ROOT, '.cache', 'wiki-vendor')
const EXTS = ['.md', '.markdown', '.html']

const FONT_STACK =
  'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif'

const PAGE_CSS = `
html { background: #fff; }
body {
  margin: 0;
  padding: 16px 0 48px;
  background: #fff;
  color: #1f2937;
  font-family: ${FONT_STACK};
  -webkit-font-smoothing: antialiased;
}
.markdown-body {
  box-sizing: border-box;
  max-width: 800px;
  margin: 0 auto;
  padding: 0 8px;
  font-size: 15px;
  line-height: 1.65;
  background: transparent;
}
@media (max-width: 840px) {
  .markdown-body { padding: 0 16px; }
}
@media print {
  body { padding: 0; }
  .markdown-body { max-width: none; padding: 0; }
}
`

// 页面把自己的高度和 slug 报给父窗口，站内 iframe 才能自适应（不再写死 75vh）
const heightScript = (slug) => `
<script>
(function () {
  var slug = ${JSON.stringify(slug)};
  var last = 0;
  function send() {
    var h = Math.max(
      document.body ? document.body.scrollHeight : 0,
      document.documentElement ? document.documentElement.scrollHeight : 0
    );
    if (h && Math.abs(h - last) > 2) {
      last = h;
      parent.postMessage({ type: 'linx-wiki-height', slug: slug, height: h }, '*');
    }
  }
  window.addEventListener('load', send);
  window.addEventListener('resize', send);
  if (window.ResizeObserver) new ResizeObserver(send).observe(document.body);
})();
</script>
`

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)
  .use(rehypePrismPlus, { ignoreMissing: true })
  .use(rehypeStringify, { allowDangerousHtml: true })

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) files.push(...(await walk(full)))
    else if (EXTS.includes(path.extname(entry.name).toLowerCase())) files.push(full)
  }
  return files
}

function relative(from, to) {
  return path.relative(from, to).split(path.sep).join('/')
}

function slugOf(file) {
  return relative(SRC_DIR, file).replace(/\.(md|markdown|html)$/i, '')
}

function stripFrontmatter(text) {
  if (!text.startsWith('---')) return text
  const match = text.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n/)
  return match ? text.slice(match[0].length) : text
}

function titleOfMarkdown(md) {
  const firstHeading = md.trim().split('\n').find((line) => /^#\s+/.test(line))
  return firstHeading ? cleanTitle(firstHeading.replace(/^#\s+/, '').trim()) : ''
}

/** 标题里可能带 Markdown 链接/强调/行内代码，统一洗成纯文本（会进 index.json 和 <title>） */
function cleanTitle(text) {
  return text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, '$1')
    .trim()
}

/** 取正文第一段纯文本当 description/摘要，避免分享卡片是空的 */
function summaryOf(markdown) {
  const plain = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^---[\s\S]*?---/, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^#+\s*/gm, '')
    .replace(/[`*_>|-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return plain.slice(0, 140)
}

function pageShell({ title, description, body, script = '' }) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)} · Wiki</title>
<meta name="description" content="${escapeHtml(description)}">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:type" content="article">
<style>
${PAGE_CSS}
</style>
</head>
<body>
${body}
${script}
</body>
</html>
`
}

let cssPromise = null
function baseCss() {
  cssPromise ??= Promise.all([
    fs.readFile(path.join(ROOT, 'node_modules', 'github-markdown-css', 'github-markdown.css'), 'utf8'),
    fs.readFile(path.join(ROOT, 'node_modules', 'prism-themes', 'themes', 'prism-one-light.css'), 'utf8'),
  ]).then(([github, prism]) => `${github}\n${prism}`)
  return cssPromise
}

const vendorCache = new Map()

/** 外链脚本改成本地 vendor：先落本地缓存（跨构建复用），再拷进产物目录 */
async function vendorize(raw, warnings) {
  const matches = [...raw.matchAll(/<script[^>]+src=["'](https?:\/\/[^"']+)["'][^>]*>\s*<\/script>/gi)]
  for (const [tag, url] of matches) {
    const name = path.basename(new URL(url).pathname) || 'vendor.js'
    const cached = path.join(VENDOR_CACHE, name)
    if (!vendorCache.has(name)) {
      vendorCache.set(name, true)
      const present = await fs
        .access(cached)
        .then(() => true)
        .catch(() => false)
      if (!present) {
        try {
          const res = await fetch(url)
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          await fs.mkdir(VENDOR_CACHE, { recursive: true })
          await fs.writeFile(cached, Buffer.from(await res.arrayBuffer()))
          warnings.push(`下载外链脚本 ${name} 到本地缓存`)
        } catch (error) {
          warnings.push(`外链脚本无法本地化：${url}（${error.message}），该页面在断网时会缺功能`)
        }
      }
    }
    const usable = await fs
      .access(cached)
      .then(() => true)
      .catch(() => false)
    if (!usable) continue
    await fs.mkdir(path.join(OUT_DIR, 'vendor'), { recursive: true })
    await fs.copyFile(cached, path.join(OUT_DIR, 'vendor', name))
    raw = raw.replace(tag, `<script src="/wiki/vendor/${name}"></script>`)
  }
  return raw
}

async function buildMarkdown(file, slug) {
  const raw = await fs.readFile(file, 'utf8')
  const withoutFrontmatter = stripFrontmatter(raw)
  const title = titleOfMarkdown(withoutFrontmatter) || slug.split('/').pop()
  const description = summaryOf(withoutFrontmatter) || title
  const body = String(await processor.process(withoutFrontmatter))
  const css = await baseCss()
  const html = pageShell({
    title,
    description,
    body: `<main class="markdown-body">${body}</main>`,
    script: heightScript(slug),
  }).replace('</style>', `${css}\n</style>`)
  return { html, title, description }
}

async function buildHtmlDoc(file, slug, warnings) {
  let raw = await fs.readFile(file, 'utf8')
  const htmlTitle = (raw.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1]?.trim() || ''
  const title = cleanTitle(htmlTitle) || slug.split('/').pop()

  // 外链样式表一律摘掉（约定不允许外部资源），文档主体样式由站内 CSS 兜底
  raw = raw.replace(/<link[^>]+rel=["']stylesheet["'][^>]*>/gi, (tag) => {
    if (/href=["']https?:/i.test(tag)) {
      warnings.push(`摘除外链样式表：${(tag.match(/href=["']([^"']+)["']/) || [])[1]}`)
      return ''
    }
    return tag
  })
  raw = await vendorize(raw, warnings)

  const complete = /<html[\s>]/i.test(raw)
  if (complete) {
    // 完整页面：保真拷贝，脚本与样式都是页面自己的；站内按固定高度内嵌
    return { html: raw, title, standalone: true }
  }

  // 片段式文档：补一个完整外壳，并注入高度上报脚本
  const description = raw
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140)
  const css = await baseCss()
  const html = pageShell({
    title,
    description,
    body: `<main class="markdown-body">${raw}</main>`,
    script: heightScript(slug),
  }).replace('</style>', `${css}\n</style>`)
  return { html, title, standalone: false }
}

async function main() {
  const files = (await walk(SRC_DIR)).sort()
  const warnings = []
  const entries = []

  await fs.rm(OUT_DIR, { recursive: true, force: true })
  await fs.mkdir(OUT_DIR, { recursive: true })

  for (const file of files) {
    const slug = slugOf(file)
    const isHtml = path.extname(file).toLowerCase() === '.html'
    const built = isHtml
      ? await buildHtmlDoc(file, slug, warnings)
      : await buildMarkdown(file, slug)

    const outFile = path.join(OUT_DIR, `${slug}.html`)
    await fs.mkdir(path.dirname(outFile), { recursive: true })
    await fs.writeFile(outFile, built.html, 'utf8')

    entries.push({
      slug,
      title: built.title,
      type: isHtml ? 'html' : 'md',
      category: slug.includes('/') ? slug.split('/')[0] : '综合',
      filePath: `/${relative(ROOT, file)}`,
      href: `/wiki/${slug}.html`,
      standalone: Boolean(built.standalone),
    })
  }

  entries.sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'))
  await fs.writeFile(path.join(OUT_DIR, 'index.json'), `${JSON.stringify(entries, null, 2)}\n`, 'utf8')

  console.log(`wiki: ${entries.length} 篇 -> ${relative(ROOT, OUT_DIR)}`)
  for (const entry of entries) {
    console.log(`  ${entry.type.padEnd(4)} ${entry.slug}`)
  }
  for (const warning of warnings) console.log(`  ! ${warning}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
