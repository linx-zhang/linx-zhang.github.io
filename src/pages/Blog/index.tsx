import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError } from '@/api/auth'
import { blogApi } from '@/api/blog'
import type { Post } from '@/api/blog'
import { useAuth } from '@/auth/AuthProvider'
import './Blog.css'

const PAGE_SIZE = 20

function formatDate(value: string): string {
  return value.replace('T', ' ').slice(0, 16)
}

function textSummary(markdown: string): string {
  const plain = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_~-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return plain.length > 140 ? `${plain.slice(0, 140)}…` : plain
}

function errorText(err: unknown): string {
  if (err instanceof ApiError) {
    return err.status >= 500 ? '服务暂时不可用，请稍后重试。' : err.detail
  }
  return '网络请求失败，请检查连接后重试。'
}

export default function Blog() {
  const { user, openLogin } = useAuth()
  const navigate = useNavigate()
  const [pageIndex, setPageIndex] = useState(0)
  const [items, setItems] = useState<Post[]>([])
  const [hasNext, setHasNext] = useState(false)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  const [composerOpen, setComposerOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [bodyMd, setBodyMd] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [composeError, setComposeError] = useState('')

  useEffect(() => {
    let cancelled = false
    blogApi
      .listPosts(PAGE_SIZE + 1, pageIndex * PAGE_SIZE)
      .then((posts) => {
        if (cancelled) return
        setItems(posts.slice(0, PAGE_SIZE))
        setHasNext(posts.length > PAGE_SIZE)
        setStatus('ready')
      })
      .catch((err) => {
        if (cancelled) return
        setError(errorText(err))
        setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [pageIndex, reloadKey])

  const goToPage = (next: number) => {
    setStatus('loading')
    setError('')
    setPageIndex(next)
  }

  const retry = () => {
    setStatus('loading')
    setError('')
    setReloadKey((key) => key + 1)
  }

  const toggleComposer = () => {
    setComposeError('')
    // 未登录时按钮照样可见，点击后弹登录；登录成功后自动展开写作面板
    if (!user) {
      openLogin(() => setComposerOpen(true))
      return
    }
    setComposerOpen((open) => !open)
  }

  const handlePublish = async (event: FormEvent) => {
    event.preventDefault()
    setComposeError('')
    const trimmedTitle = title.trim()
    if (trimmedTitle.length === 0) {
      setComposeError('标题不能为空')
      return
    }
    if (trimmedTitle.length > 200) {
      setComposeError('标题不能超过 200 个字符')
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
      setComposeError(errorText(err))
    } finally {
      setPublishing(false)
    }
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

      {user && composerOpen && (
        <form className="blog-composer" onSubmit={handlePublish} noValidate>
          <label className="blog-composer-field">
            <span>标题</span>
            <input
              type="text"
              value={title}
              maxLength={200}
              placeholder="文章标题"
              disabled={publishing}
              onChange={(event) => {
                setTitle(event.target.value)
                setComposeError('')
              }}
            />
          </label>
          <label className="blog-composer-field">
            <span>正文（Markdown）</span>
            <textarea
              value={bodyMd}
              rows={12}
              placeholder="支持 Markdown，发布后使用与知识库相同的渲染方式。"
              disabled={publishing}
              onChange={(event) => {
                setBodyMd(event.target.value)
                setComposeError('')
              }}
            />
          </label>
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
        <div className="blog-state">还没有文章。</div>
      )}

      {status === 'ready' && items.length > 0 && (
        <div className="blog-list">
          {items.map((post) => (
            <Link key={post.id} className="blog-card" to={`/blog/${post.id}`}>
              <h2>{post.title}</h2>
              <div className="blog-meta">
                {formatDate(post.created_at)}
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
          <span className="blog-page-index">第 {pageIndex + 1} 页</span>
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
