import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useParams } from 'react-router-dom'
import { useReactToPrint } from 'react-to-print'
import { errorMessage, isNotFound } from '@/api/errors'
import { resumeApi } from '@/api/resumes'
import { sanitizeResumeHtml } from '@/utils/resumeHtml'
import { formatTimestamp } from '@/utils/format'
import { RESUME_TEMPLATE_HTML } from '@/utils/resumeTemplate'
import '@/styles/resume.css'
import './Profile.css'

/** ready = 已拿到正文；missing 只用于分享链接（过期/撤销/简历已删） */
type ViewState =
  | { status: 'loading' }
  | { status: 'ready'; html: string; updatedAt: string | null }
  | { status: 'missing' }
  | { status: 'error'; message: string }

/**
 * 简历页有两种入口：
 * - `/profile`：取管理员设为默认的简历，没有就回退到内置模板；
 * - `/r/<code>`：带期限的分享链接，只认同一个有效 code，失效不回落模板。
 */
export default function Profile() {
  const { code } = useParams<{ code?: string }>()
  const printContentRef = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<ViewState>({ status: 'loading' })
  const [actionsHost, setActionsHost] = useState<HTMLElement | null>(null)

  const load = useCallback(async () => {
    setState({ status: 'loading' })
    if (code) {
      try {
        const shared = await resumeApi.getShared(code)
        setState({
          status: 'ready',
          html: sanitizeResumeHtml(shared.content_html),
          updatedAt: shared.updated_at,
        })
      } catch (err) {
        if (isNotFound(err)) setState({ status: 'missing' })
        else setState({ status: 'error', message: errorMessage(err) })
      }
      return
    }

    try {
      const current = await resumeApi.getCurrent()
      setState({
        status: 'ready',
        html: sanitizeResumeHtml(current.content_html),
        updatedAt: current.updated_at,
      })
    } catch {
      // 没有默认简历（首次部署）或接口暂时不可用时，保留原来的 mock，页面不至于白屏
      setState({
        status: 'ready',
        html: sanitizeResumeHtml(RESUME_TEMPLATE_HTML),
        updatedAt: null,
      })
    }
  }, [code])

  useEffect(() => {
    void load()
  }, [load])

  // 操作栏放在简历标题下方，而不是页面最顶端：正文 HTML 是数据，
  // 这里在渲染后的 `.profile-header-bar` 里挂一个宿主节点，React 用 portal 填进去。
  const readyHtml = state.status === 'ready' ? state.html : null
  useEffect(() => {
    const root = printContentRef.current
    if (!readyHtml || !root) {
      setActionsHost(null)
      return
    }
    const header = root.querySelector<HTMLElement>('.profile-header-bar')
    if (!header) {
      setActionsHost(null)
      return
    }
    const host = document.createElement('div')
    host.className = 'profile-actions-host'
    header.appendChild(host)
    setActionsHost(host)
    return () => {
      host.remove()
      setActionsHost(null)
    }
  }, [readyHtml])

  const handlePrint = useReactToPrint({
    contentRef: printContentRef,
    documentTitle: 'Linx_Zhang_Resume',
    pageStyle: '',
  })

  if (state.status === 'loading') {
    return (
      <div className="profile-status" role="status">
        <p>简历加载中…</p>
      </div>
    )
  }

  if (state.status === 'missing') {
    return (
      <div className="profile-status">
        <h1>这个链接已失效</h1>
        <p>简历分享链接可能已过期、被撤销，或对应简历已被删除。</p>
        <p>
          <a href="/">返回首页</a>
        </p>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="profile-status">
        <h1>简历暂时打不开</h1>
        <p>{state.message}</p>
        <p>
          <button type="button" className="print-btn" onClick={() => void load()}>
            重试
          </button>
        </p>
      </div>
    )
  }

  const pageMeta = (
    <div className="profile-page-meta no-print">
      <a className="profile-back" href="/">
        <span aria-hidden="true">←</span> 返回首页
      </a>
      {state.updatedAt && (
        <span className="profile-updated">更新于 {formatTimestamp(state.updatedAt)}</span>
      )}
    </div>
  )

  const actions = (
    <div className="action-group no-print">
      <div className="action-links">
        <a href="mailto:xxx@qq.com">邮箱</a>
        <a href="https://github.com/linx-zhang">GitHub</a>
        <a href="https://www.zhihu.com/people/linx.z/answers">知乎</a>
      </div>
      <button onClick={handlePrint} className="print-btn" type="button">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M12 3v11m0 0 4-4m-4 4-4-4M5 17v3h14v-3" />
        </svg>
        导出 PDF
      </button>
    </div>
  )

  return (
    <div className="profile-preview-wrap">
      {pageMeta}

      {!actionsHost && !(readyHtml && readyHtml.includes('profile-header-bar')) && (
        <div className="profile-actions-fallback">{actions}</div>
      )}

      <div ref={printContentRef} className="profile-print-root">
        <div dangerouslySetInnerHTML={{ __html: state.html }} />
      </div>

      {actionsHost && createPortal(actions, actionsHost)}
    </div>
  )
}
