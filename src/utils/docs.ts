// 文档清单不再 import.meta.glob 全量内联进 bundle，改为读取构建期生成的 /wiki/index.json。
// md 的 href 指向 /wiki/<slug>.md（运行时 fetch 后渲染），html 的 href 指向 /wiki/<slug>.html（iframe 直连）。

export interface DocItem {
  slug: string
  title: string
  type: 'md' | 'html'
  category: string
  /** 仓库内的源文件路径，用于"源文件"链接 */
  filePath: string
  /** 独立静态页地址 */
  href: string
  /** 完整页面（自带样式/脚本，站内按固定高度内嵌），否则按内容高度自适应 */
  standalone: boolean
}

const INDEX_URL = '/wiki/index.json'

let cachedDocs: DocItem[] | null = null
let inflight: Promise<DocItem[]> | null = null

/** 加载文档清单；并发调用共用同一个请求，成功后走内存缓存 */
export function loadDocList(): Promise<DocItem[]> {
  if (cachedDocs) return Promise.resolve(cachedDocs)
  inflight ??= fetch(INDEX_URL)
    .then((res) => {
      if (!res.ok) throw new Error(`文档索引加载失败（HTTP ${res.status}）`)
      return res.json() as Promise<DocItem[]>
    })
    .then((list) => {
      cachedDocs = list
      return list
    })
    .finally(() => {
      inflight = null
    })
  return inflight
}

/** 已加载的清单（未加载时为 null），供渲染期同步取值 */
export function peekDocList(): DocItem[] | null {
  return cachedDocs
}
