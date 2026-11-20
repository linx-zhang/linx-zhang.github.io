// 文档清单不再 import.meta.glob 全量内联进 bundle，改为读取构建期生成的 /wiki/index.json。
// md 的 href 指向 /wiki/<slug>.md（运行时 fetch 后渲染），html 的 href 指向 /wiki-files/<slug>.html（iframe 直连）。
// html 必须放在 /wiki-files：Pages 会把 /wiki/<slug> 兜底解析到 /wiki/<slug>.html，产物留在 /wiki 下会绕过 SPA。

export interface DocItem {
  slug: string
  title: string
  type: 'md' | 'html'
  category: string
  /** 分类的展示名（目录名只做 slug 前缀），缺省时用 category */
  categoryLabel?: string
  /** 分类的展示位次（构建期按配置写死），侧栏与首页 chip 共用，缺省排最后 */
  categoryRank?: number
  /** 二级目录（如 notes/python、notes/cpp），分类下的主题，可能为空 */
  topic?: string
  /** 置顶权重：0 不置顶，正整数越小越靠前 */
  pin?: number
  /** 组内顺序：只在同一分类内生效（系列文章按此排列），0 表示不指定 */
  order?: number
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
  // 直接 fetch 而不走 api/client：这是构建期产出的静态文件（/wiki/index.json），
  // 不是后端接口——没有 envelope、不需要 Bearer、401 也不该触发登出。
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
