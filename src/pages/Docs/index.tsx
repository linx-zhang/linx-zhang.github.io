import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import MarkdownView from '@/components/MarkdownView'
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

/** 已渲染过的 md 文本按 slug 缓存，来回切换分类不用重复请求 */
const markdownCache = new Map<string, string>()

function useMarkdownSource(doc: { slug: string; href: string; type: 'md' | 'html' } | undefined) {
  const [text, setText] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!doc || doc.type !== 'md') {
      setText(null)
      setError(null)
      return
    }

    const cached = markdownCache.get(doc.slug)
    if (cached !== undefined) {
      setText(cached)
      setError(null)
      return
    }

    let cancelled = false
    setText(null)
    setError(null)

    fetch(doc.href)
      .then((res) => {
        if (!res.ok) throw new Error(`正文加载失败（HTTP ${res.status}）`)
        return res.text()
      })
      .then((content) => {
        if (cancelled) return
        markdownCache.set(doc.slug, content)
        setText(content)
      })
      .catch((cause: unknown) => {
        if (cancelled) return
        setError(cause instanceof Error ? cause.message : '正文加载失败')
      })

    return () => {
      cancelled = true
    }
  }, [doc])

  return { text, error }
}

export default function Docs() {
  const params = useParams()
  const slug = params['*']
  const { docs, error } = useDocList()
  const [searchParams, setSearchParams] = useSearchParams()
  const fullscreen = searchParams.get('full') === '1'

  // 高度跟着 slug 一起存：换文档时旧高度自然失效，不需要再在 effect 里清一次
  const [measured, setMeasured] = useState<{ slug: string; height: number } | null>(null)

  const doc = slug ? docs?.find((item) => item.slug === slug) : undefined
  const { text: markdown, error: markdownError } = useMarkdownSource(doc)

  const exitFullscreen = useCallback(() => {
    const next = new URLSearchParams(searchParams)
    next.delete('full')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

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

  // 全屏阅读时 Esc 退出，并锁住背景滚动
  useEffect(() => {
    if (!fullscreen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') exitFullscreen()
    }
    window.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [fullscreen, exitFullscreen])

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
  const wide = Boolean(doc.standalone) || fullscreen

  const body =
    doc.type === 'md' ? (
      markdownError ? (
        <p className="doc-body-error">{markdownError}</p>
      ) : markdown === null ? (
        <p className="doc-body-loading">正在加载正文…</p>
      ) : (
        <MarkdownView content={markdown} className="doc-markdown" />
      )
    ) : (
      <iframe
        key={doc.slug}
        className={`doc-iframe ${doc.standalone ? 'doc-iframe--app' : 'doc-iframe--auto'}`}
        src={doc.href}
        title={doc.title}
        // 全屏时按整屏高度由 CSS 决定，别让上报出来的内容高度把它顶长
        style={doc.standalone || fullscreen || height === null ? undefined : { height: `${height}px` }}
      />
    )

  const page = (
    <article
      className={`doc-page ${wide ? 'doc-page--wide' : ''} ${fullscreen ? 'doc-page--full' : ''} ${doc.type === 'html' ? 'doc-page--html' : 'doc-page--md'}`}
    >
      {/* 面包屑：给当前页一个上下文，也方便回到分类列表 */}
      <nav className="doc-breadcrumb no-print" aria-label="面包屑">
        <Link to="/wiki">知识库</Link>
        <span className="doc-crumb-sep">›</span>
        <span className="doc-crumb-cat">{doc.category}</span>
        <span className="doc-crumb-sep">›</span>
        <span className="doc-crumb-current">{doc.title}</span>
        {fullscreen ? (
          <button type="button" className="doc-fullscreen-exit" onClick={exitFullscreen}>
            <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
            退出全屏
          </button>
        ) : (
          <Link className="doc-fullscreen-enter" to={`/wiki/${doc.slug}?full=1`}>
            <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
              <path d="M6 2H2v4M10 2h4v4M10 14h4v-4M6 14H2v-4" />
            </svg>
            全屏阅读
          </Link>
        )}
      </nav>

      {/* 应用型页面没有 H1，才在父页补一个；md 自己的首行标题已经在正文里 */}
      {doc.standalone && !fullscreen && (
        <header className="doc-page-header no-print">
          <h1>{doc.title}</h1>
        </header>
      )}

      <div className="doc-page-body">{body}</div>
    </article>
  )

  return fullscreen ? <div className="doc-fullscreen-shell">{page}</div> : page
}
