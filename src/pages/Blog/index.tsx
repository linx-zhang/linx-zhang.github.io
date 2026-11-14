import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { errorMessage } from '@/api/errors'
import { blogApi } from '@/api/blog'
import type { Post } from '@/api/blog'
import { useAuth } from '@/auth/AuthProvider'
import MarkdownEditor from '@/components/MarkdownEditor'
import { usePagedList } from '@/hooks/usePagedList'
import { POST_TITLE_MAX } from '@/constants'
import { formatTimestamp } from '@/utils/format'
import './Blog.css'

function textSummary(markdown: string): string {
  const plain = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_]+/g, ' ')
    .replace(/\s*[-]{2,}\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return plain.length > 140 ? `${plain.slice(0, 140)}…` : plain
}

export default function Blog() {
  const { user, openLogin } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()

  // 页码、筛选条件都放在 URL 里：刷新和「从详情返回」都能回到同一页
  const rawPage = Number.parseInt(searchParams.get('page') ?? '1', 10)
  const pageIndex = Number.isFinite(rawPage) && rawPage > 1 ? rawPage - 1 : 0
  const q = searchParams.get('q') ?? ''
  const author = searchParams.get('author') ?? ''
  // 详情页靠这个 state 知道「该回哪一页」——不进 URL，也就不会被分享出去
  const fromHere = location.pathname + location.search

  // 输入框只在用户键入时更新；URL 变化由下面的操作函数同步重置
  const [qInput, setQInput] = useState(q)
  const [authorInput, setAuthorInput] = useState(author)

  // 页码受控于 URL；筛选条件进 deps，变化即重取当前页
  const {
    items,
    hasNext,
    status,
    error,
    retry,
  } = usePagedList<Post>(
    (limit, offset) => blogApi.listPosts(limit, offset, { q, author }),
    { page: pageIndex, deps: [q, author] },
  )

  // 记住当前列表地址，详情页的「返回列表」用它，而不是硬回第一页
  useEffect(() => {
    const query = searchParams.toString()
    sessionStorage.setItem('blog_list_url', query ? `/blog?${query}` : '/blog')
  }, [searchParams])

  /** 换页只改 URL 里的 page，筛选参数原样保留 */
  const writePageToUrl = (nextIndex: number) => {
    const params = new URLSearchParams(searchParams)
    if (nextIndex > 0) params.set('page', String(nextIndex + 1))
    else params.delete('page')
    setSearchParams(params, { replace: true })
    window.scrollTo({ top: 0 })
  }

  // 受控模式：翻页就是改 URL，hook 跟着 page 重取，不需要再单独通知它
  const goToPage = (nextIndex: number) => {
    writePageToUrl(nextIndex)
  }

  const applyFilters = (event: FormEvent) => {
    event.preventDefault()
    const params = new URLSearchParams()
    const nextQ = qInput.trim()
    const nextAuthor = authorInput.trim()
    if (nextQ) params.set('q', nextQ)
    if (nextAuthor) params.set('author', nextAuthor)
    // 换筛选条件时回到第 1 页，避免停在已不存在的页码上
    setSearchParams(params, { replace: true })
  }

  const clearFilters = () => {
    setQInput('')
    setAuthorInput('')
    setSearchParams(new URLSearchParams(), { replace: true })
  }

  const filtering = q.trim().length > 0 || author.trim().length > 0

  const [composerOpen, setComposerOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [bodyMd, setBodyMd] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [composeError, setComposeError] = useState('')

  const toggleComposer = () => {
    setComposeError('')
    // 未登录时按钮照样可见，点击后弹登录；登录成功后自动展开写作面板
    if (!user) {
      openLogin(() => setComposerOpen(true))
      return
    }
    setComposerOpen((open) => !open)
  }

  /** 发布：表单提交与「Ctrl/⌘ + Enter」共用，校验逻辑只有这一处 */
  const publishPost = async () => {
    setComposeError('')
    const trimmedTitle = title.trim()
    if (trimmedTitle.length === 0) {
      setComposeError('标题不能为空')
      return
    }
    if (trimmedTitle.length > POST_TITLE_MAX) {
      setComposeError(`标题不能超过 ${POST_TITLE_MAX} 个字符`)
      return
    }
    if (bodyMd.trim().length === 0) {
      setComposeError('正文不能为空')
      return
    }
    setPublishing(true)
    try {
      const post = await blogApi.createPost({ title: trimmedTitle, body_md: bodyMd })
      navigate(`/blog/${post.id}`)
    } catch (err) {
      setComposeError(errorMessage(err))
    } finally {
      setPublishing(false)
    }
  }

  const handlePublish = (event: FormEvent) => {
    event.preventDefault()
    void publishPost()
  }

  return (
    <div className="blog-page">
      <header className="blog-header">
        <div className="blog-header-main">
          <h1>博客</h1>
          <p>记录技术实践与日常思考。</p>
        </div>
        <button
          type="button"
          className={composerOpen ? 'blog-write blog-write-active' : 'blog-write'}
          aria-expanded={user ? composerOpen : undefined}
          aria-haspopup={user ? undefined : 'dialog'}
          title={user ? undefined : '登录后可写文章'}
          onClick={toggleComposer}
        >
          {composerOpen ? '收起' : '写文章'}
        </button>
      </header>

      {/* 写作面板展开时收起筛选栏：两块表单挤在一起，输入焦点会打架 */}
      {!composerOpen && (
        <form className="blog-filters" onSubmit={applyFilters} role="search">
          <label className="blog-filter-field">
            <span>作者</span>
            <input
              type="text"
              value={authorInput}
              maxLength={64}
              placeholder="邮箱 / 昵称 / 姓名"
              onChange={(event) => setAuthorInput(event.target.value)}
            />
          </label>
          <label className="blog-filter-field">
            <span>标题</span>
            <input
              type="text"
              value={qInput}
              maxLength={64}
              placeholder="标题关键词，支持模糊搜索"
              onChange={(event) => setQInput(event.target.value)}
            />
          </label>
          <div className="blog-filter-actions">
            <button type="submit" className="blog-button">
              筛选
            </button>
            {(filtering || qInput.trim() || authorInput.trim()) && (
              <button type="button" className="blog-button" onClick={clearFilters}>
                清除
              </button>
            )}
          </div>
        </form>
      )}

      {user && composerOpen && (
        <form className="blog-composer" onSubmit={handlePublish} noValidate>
          <label className="blog-composer-field">
            <span>标题</span>
            <input
              type="text"
              value={title}
              maxLength={POST_TITLE_MAX}
              placeholder="文章标题"
              disabled={publishing}
              onChange={(event) => {
                setTitle(event.target.value)
                setComposeError('')
              }}
            />
          </label>
          <MarkdownEditor
            label="正文（Markdown）"
            value={bodyMd}
            placeholder="支持 Markdown，左侧边写边看右侧预览；工具栏可插入链接、列表等常用结构。"
            disabled={publishing}
            onSubmitShortcut={() => void publishPost()}
            onChange={(next) => {
              setBodyMd(next)
              setComposeError('')
            }}
          />
          {composeError && <p className="comment-error">{composeError}</p>}
          <div className="blog-composer-actions">
            <button
              type="button"
              className="blog-button"
              disabled={publishing}
              onClick={() => setComposerOpen(false)}
            >
              收起
            </button>
            <button
              type="submit"
              className="blog-button comment-submit"
              disabled={publishing || title.trim().length === 0 || bodyMd.trim().length === 0}
            >
              {publishing ? '发布中…' : '发布'}
            </button>
          </div>
        </form>
      )}

      {status === 'loading' && <div className="blog-state">加载中…</div>}

      {status === 'error' && (
        <div className="blog-state blog-state-error">
          <p>{error}</p>
          <button type="button" className="blog-button" onClick={retry}>
            重试
          </button>
        </div>
      )}

      {status === 'ready' && items.length === 0 && (
        <div className="blog-state">
          <p>{filtering ? '没有匹配的文章。' : pageIndex > 0 ? '这一页没有文章了。' : '还没有文章。'}</p>
          {pageIndex > 0 && (
            <button type="button" className="blog-button" onClick={() => goToPage(0)}>
              回到第 1 页
            </button>
          )}
        </div>
      )}

      {status === 'ready' && items.length > 0 && (
        <div className="blog-list">
          {items.map((post) => (
            <Link
              key={post.id}
              className="blog-card"
              to={`/blog/${post.id}`}
              state={{ from: fromHere }}
            >
              <h2>{post.title}</h2>
              <div className="blog-meta">
                {formatTimestamp(post.created_at)}
                {post.author_name ? ` · ${post.author_name}` : ''}
              </div>
              <p className="blog-summary">{textSummary(post.body_md)}</p>
            </Link>
          ))}
        </div>
      )}

      {status === 'ready' && (
        <nav className="blog-pager" aria-label="分页">
          <button
            type="button"
            className="blog-button"
            disabled={pageIndex === 0}
            onClick={() => goToPage(pageIndex - 1)}
          >
            上一页
          </button>
          <span className="blog-page-index">
            第 {pageIndex + 1} 页
            {filtering ? '（筛选中）' : ''}
          </span>
          <button
            type="button"
            className="blog-button"
            disabled={!hasNext}
            onClick={() => goToPage(pageIndex + 1)}
          >
            下一页
          </button>
        </nav>
      )}
    </div>
  )
}
