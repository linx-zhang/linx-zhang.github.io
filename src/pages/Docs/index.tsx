import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useDocList } from '@/utils/useDocs'
import './Docs.css'

/** 静态页渲染完成后 postMessage 报高度，这里接收后撑满 iframe，避免页内出现第二条滚动条 */
interface WikiHeightMessage {
  type: 'linx-wiki-height'
  slug: string
  height: number
}

function isHeightMessage(data: unknown): data is WikiHeightMessage {
  if (typeof data !== 'object' || data === null) return false
  const candidate = data as Partial<WikiHeightMessage>
  return (
    candidate.type === 'linx-wiki-height' &&
    typeof candidate.slug === 'string' &&
    typeof candidate.height === 'number'
  )
}

export default function Docs() {
  const params = useParams()
  const slug = params['*']
  const { docs, error } = useDocList()

  // 高度跟着 slug 一起存：换文档时旧高度自然失效，不需要再在 effect 里清一次
  const [measured, setMeasured] = useState<{ slug: string; height: number } | null>(null)

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!isHeightMessage(event.data)) return
      const height = Math.max(320, Math.ceil(event.data.height))
      const from = event.data.slug
      setMeasured((current) =>
        current && current.slug === from && current.height === height ? current : { slug: from, height },
      )
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  if (error) {
    return (
      <div className="doc-missing">
        <h1>知识库索引打不开</h1>
        <p>{error}</p>
        <Link to="/wiki">返回知识库目录</Link>
      </div>
    )
  }

  if (!docs) {
    return (
      <div className="doc-missing">
        <p>正在加载文档索引…</p>
      </div>
    )
  }

  const doc = slug ? docs.find((item) => item.slug === slug) : undefined

  if (!doc) {
    return (
      <div className="doc-missing">
        <h1>没有找到这篇文档</h1>
        <p>链接可能已失效，或者这篇笔记还在整理中。</p>
        <Link to="/wiki">返回知识库目录</Link>
      </div>
    )
  }

  const height = measured && measured.slug === doc.slug ? measured.height : null

  return (
    <article className={`doc-page ${doc.standalone ? 'doc-page--wide' : ''}`}>
      {/* 面包屑：给当前页一个上下文，也方便回到分类列表 */}
      <nav className="doc-breadcrumb no-print" aria-label="面包屑">
        <Link to="/wiki">知识库</Link>
        <span className="doc-crumb-sep">›</span>
        <span className="doc-crumb-cat">{doc.category}</span>
        <span className="doc-crumb-sep">›</span>
        <span className="doc-crumb-current">{doc.title}</span>
      </nav>

      {/* 普通文档的标题由静态页自己的 H1 负责；应用型页面没有 H1，才在父页补一个 */}
      {doc.standalone && (
        <header className="doc-page-header no-print">
          <h1>{doc.title}</h1>
        </header>
      )}

      <div className="doc-page-body">
        <iframe
          key={doc.slug}
          className={`doc-iframe ${doc.standalone ? 'doc-iframe--app' : 'doc-iframe--auto'}`}
          src={doc.href}
          title={doc.title}
          style={doc.standalone || height === null ? undefined : { height: `${height}px` }}
        />
      </div>
    </article>
  )
}
