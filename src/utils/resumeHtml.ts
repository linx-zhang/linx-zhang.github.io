/**
 * 简历正文是管理员手写的 HTML：库里保留原文，渲染前必须过一遍白名单。
 *
 * 目标不是「防自己」，而是分享链接会把这段 HTML 带到任意浏览器：只留排版需要的
 * 标签与类名，脚本、表单、外链 iframe 一律不进来；属性只留 class 与 a 的 href。
 */

const ALLOWED_TAGS = new Set([
  'div',
  'section',
  'header',
  'h1',
  'h2',
  'h3',
  'p',
  'ul',
  'li',
  'span',
  'strong',
  'em',
  'br',
  'hr',
  'a',
])

/** 与 Profile.css / resume.css 里的排版类名一一对应；新加样式先在这里登记 */
const ALLOWED_CLASSES = new Set([
  'profile-header-bar',
  'profile-subtitle',
  'contact-line',
  'dot',
  'print-only',
  'resume-section',
  'tag-group',
  'tag',
  'exp-item',
  'exp-head',
  'exp-date',
  'proj-item',
])

/** 这些标签连同内容一起丢掉；其余未知标签只脱壳、保留文字 */
const DROP_TAGS = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'form',
  'input',
  'button',
  'textarea',
  'select',
  'option',
  'link',
  'meta',
  'base',
  'svg',
  'math',
  'img',
  'video',
  'audio',
  'source',
  'track',
  'canvas',
  'template',
])

function safeHref(raw: string): string | null {
  const value = raw.trim()
  if (!value) return null
  const lower = value.toLowerCase()
  if (lower.startsWith('http://') || lower.startsWith('https://') || lower.startsWith('mailto:')) {
    return value
  }
  if (value.startsWith('/') || value.startsWith('#')) return value
  return null
}

function cleanClass(raw: string): string {
  return raw
    .split(/\s+/)
    .filter((token) => ALLOWED_CLASSES.has(token))
    .join(' ')
}

/** 清洗一段简历 HTML，返回可直接 dangerouslySetInnerHTML 的字符串 */
export function sanitizeResumeHtml(html: string): string {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')
  const body = doc.body

  for (const node of Array.from(body.querySelectorAll('*'))) {
    if (!node.isConnected) continue
    const tag = node.tagName.toLowerCase()

    if (DROP_TAGS.has(tag)) {
      node.remove()
      continue
    }

    if (!ALLOWED_TAGS.has(tag)) {
      node.replaceWith(...Array.from(node.childNodes))
      continue
    }

    const href = tag === 'a' ? node.getAttribute('href') : null
    const className = node.getAttribute('class')
    // 先清空全部属性，再去回填白名单里的两项：on* / style / id / data-* 都留不下来
    for (const attr of Array.from(node.attributes)) node.removeAttribute(attr.name)
    if (tag === 'a' && href) {
      const safe = safeHref(href)
      if (safe) {
        node.setAttribute('href', safe)
        node.setAttribute('rel', 'noopener noreferrer')
      }
    }
    if (className) {
      const cleaned = cleanClass(className)
      if (cleaned) node.setAttribute('class', cleaned)
    }
  }

  return body.innerHTML.trim()
}
