const rawModules = import.meta.glob('/raw-docs/**/*.{md,markdown,html}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

export interface DocItem {
  slug: string
  filePath: string
  title: string
  rawContent: string
  type: 'md' | 'html'
}

function parseDocs(): DocItem[] {
  const list = Object.entries(rawModules).map(([filePath, rawContent]) => {
    const isHtml = filePath.endsWith('.html')

    const slug = filePath
      .replace(/^\/raw-docs\//, '')
      .replace(/\.(md|markdown|html)$/, '')

    // HTML 抓 <title>，Markdown 抓首个一级标题，都没有就退回 slug
    let title = slug
    if (isHtml) {
      const titleMatch = rawContent.match(/<title[^>]*>([^<]+)<\/title>/i)
      if (titleMatch) title = titleMatch[1].trim()
    } else {
      const firstLine = rawContent.trim().split('\n')[0] || ''
      const titleMatch = firstLine.match(/^#\s+(.+)$/)
      if (titleMatch) title = titleMatch[1].trim()
    }

    return {
      slug,
      filePath,
      title,
      rawContent,
      type: (isHtml ? 'html' : 'md') as 'md' | 'html',
    }
  })

  // 中文标题按 zh-CN 排序；只在这一个模块里排一次
  return list.sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'))
}

let cachedDocs: DocItem[] | null = null

/** 全量文档清单：解析与排序只在首次调用时执行，之后返回同一个数组 */
export function getDocList(): DocItem[] {
  cachedDocs ??= parseDocs()
  return cachedDocs
}

let cachedBySlug: Map<string, DocItem> | null = null

export function getDocBySlug(slug: string): DocItem | undefined {
  if (!cachedBySlug) {
    cachedBySlug = new Map(getDocList().map((doc) => [doc.slug, doc]))
  }
  return cachedBySlug.get(slug)
}
