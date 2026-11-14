import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { errorMessage } from '@/api/errors'
import { blogApi } from '@/api/blog'
import type { Comment, Post, PostNeighbors } from '@/api/blog'
import { useAuth } from '@/auth/AuthProvider'
import { usePermission } from '@/auth/usePermission'
import { useResource } from '@/hooks/useResource'
import MarkdownView from '@/components/MarkdownView'
import Avatar from '@/components/Avatar'
import { useConfirm } from '@/components/ConfirmDialog/useConfirm'
import { COMMENT_BODY_MAX, POST_TITLE_MAX } from '@/constants'
import { formatTimestamp } from '@/utils/format'
import './Blog.css'

function commentOrder(a: Comment, b: Comment): number {
  if (a.created_at === b.created_at) return a.id - b.id
  return a.created_at < b.created_at ? -1 : 1
}

/** 兜底：列表页把当前地址（含页码与筛选）存进 sessionStorage，同一标签页内刷新也不丢 */
function storedListUrl(): string {
  try {
    return sessionStorage.getItem('blog_list_url') || '/blog'
  } catch {
    return '/blog'
  }
}

/**
 * 「返回列表」的目标地址。优先用列表跳转时带过来的 router state——
 * 它不落进 URL、不受分享污染，正好对应"应用内导航"这个唯一需要精确回位的场景；
 * 没有 state（新标签打开、外部链接进来）才退回本标签页上次停过的地址。
 */
function listUrl(from: unknown): string {
  return typeof from === 'string' && from.startsWith('/blog') ? from : storedListUrl()
}

/** 从列表地址里取筛选条件——详情页据此按同一份结果顺序翻上一篇/下一篇 */
function filtersOf(url: string): { q: string; author: string } {
  try {
    const params = new URLSearchParams(url.split('?')[1] ?? '')
    return { q: params.get('q') ?? '', author: params.get('author') ?? '' }
  } catch {
    return { q: '', author: '' }
  }
}

export default function PostDetail() {
  const { id } = useParams()
  const postId = Number(id)
  const validId = Number.isInteger(postId) && postId > 0
  const navigate = useNavigate()
  const location = useLocation()
  const fromState = (location.state as { from?: unknown } | null)?.from
  const backToList = listUrl(fromState)
  const listFilters = filtersOf(backToList)

  const { user, openLogin } = useAuth()
  const { has } = usePermission()
  const { confirm, dialog } = useConfirm()

  // 正文：404 视为「文章不存在」，其余错误给重试
  const postQuery = useResource<Post>(() => blogApi.getPost(postId), [postId], {
    enabled: validId,
    treat404AsMissing: true,
  })
  const post = postQuery.data
  const postStatus = validId ? postQuery.status : 'missing'

  // 上一篇 / 下一篇：拿不到就整块不展示（silent，不弹错误）
  const neighbors = useResource<PostNeighbors>(
    () => blogApi.getNeighbors(postId, listFilters),
    [postId, listFilters.q, listFilters.author],
    { enabled: validId, silent: true },
  ).data

  // 评论：列表本身就按创建顺序排好，避免每次渲染重排
  const commentsQuery = useResource<Comment[]>(
    () => blogApi.listComments(postId).then((list) => [...list].sort(commentOrder)),
    [postId],
    { enabled: validId },
  )
  const comments = commentsQuery.data ?? []
  const commentStatus = commentsQuery.status === 'missing' ? 'ready' : commentsQuery.status
  const refreshComments = commentsQuery.reload

  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editBody, setEditBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState('')
  const [deletingPost, setDeletingPost] = useState(false)
  const [postActionError, setPostActionError] = useState('')

  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [deleteError, setDeleteError] = useState('')

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitError('')
    const trimmed = body.trim()
    if (trimmed.length === 0) {
      setSubmitError('评论内容不能为空')
      return
    }
    if (trimmed.length > COMMENT_BODY_MAX) {
      setSubmitError(`评论内容不能超过 ${COMMENT_BODY_MAX} 个字符`)
      return
    }
    setSubmitting(true)
    try {
      await blogApi.createComment(postId, trimmed)
      setBody('')
      refreshComments()
    } catch (err) {
      setSubmitError(errorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteComment = (commentId: number) => {
    confirm({
      title: '删除评论',
      description: '确认删除这条评论？该评论下的回复也会一并删除，且不可恢复。',
      confirmText: '删除',
      pendingText: '删除中…',
      tone: 'danger',
      onConfirm: async () => {
        setDeleteError('')
        setDeletingId(commentId)
        try {
          await blogApi.deleteComment(commentId)
          refreshComments()
        } catch (err) {
          setDeleteError(errorMessage(err))
        } finally {
          setDeletingId(null)
        }
      },
    })
  }

  const startEdit = () => {
    if (!post) return
    setEditTitle(post.title)
    setEditBody(post.body_md)
    setEditError('')
    setPostActionError('')
    setEditing(true)
  }

  const cancelEdit = () => {
    setEditing(false)
    setEditError('')
  }

  const handleSave = async (event: FormEvent) => {
    event.preventDefault()
    setEditError('')
    const trimmedTitle = editTitle.trim()
    if (trimmedTitle.length === 0) {
      setEditError('标题不能为空')
      return
    }
    if (trimmedTitle.length > POST_TITLE_MAX) {
      setEditError(`标题不能超过 ${POST_TITLE_MAX} 个字符`)
      return
    }
    if (editBody.trim().length === 0) {
      setEditError('正文不能为空')
      return
    }

    setSaving(true)
    try {
      const updated = await blogApi.updatePost(postId, {
        title: trimmedTitle,
        body_md: editBody,
      })
      postQuery.setData(updated)
      setEditing(false)
    } catch (err) {
      setEditError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const handleDeletePost = () => {
    confirm({
      title: '删除文章',
      description: '确认删除这篇文章？文章下的评论也会一并删除，且不可恢复。',
      confirmText: '删除',
      pendingText: '删除中…',
      tone: 'danger',
      onConfirm: async () => {
        setPostActionError('')
        setDeletingPost(true)
        try {
          await blogApi.deletePost(postId)
          navigate(backToList)
        } catch (err) {
          setPostActionError(errorMessage(err))
        } finally {
          setDeletingPost(false)
        }
      },
    })
  }

  if (postStatus === 'missing') {
    return (
      <div className="blog-page">
        <div className="blog-state">
          <p>文章不存在或已被删除。</p>
          <Link className="blog-button" to={backToList}>
            返回博客列表
          </Link>
        </div>
      </div>
    )
  }

  if (postStatus === 'loading') {
    return (
      <div className="blog-page">
        <div className="blog-state">加载中…</div>
      </div>
    )
  }

  if (postStatus === 'error' || !post) {
    return (
      <div className="blog-page">
        <div className="blog-state blog-state-error">
          <p>{postQuery.error}</p>
          <div className="blog-state-actions">
            <button type="button" className="blog-button" onClick={postQuery.reload}>
              重试
            </button>
            <Link className="blog-button" to={backToList}>
              返回列表
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const isOwnPost = user !== null && post.author_id === user.id
  const canEditPost = has('post:update:any') || (isOwnPost && has('post:update:own'))
  const canDeletePost = has('post:delete:any') || (isOwnPost && has('post:delete:own'))
  const canDeleteComment = (comment: Comment) =>
    has('comment:delete:any') ||
    (has('comment:delete:own') && user !== null && comment.author_id === user.id)

  return (
    <div className="blog-page">
      <article className="post-detail">
        <Link className="post-back" to={backToList}>
          ← 返回博客列表
        </Link>

        {editing ? (
          <form className="post-edit" onSubmit={handleSave} noValidate>
            <label className="post-edit-field">
              <span>标题</span>
              <input
                type="text"
                value={editTitle}
                maxLength={POST_TITLE_MAX}
                disabled={saving}
                onChange={(event) => {
                  setEditTitle(event.target.value)
                  setEditError('')
                }}
              />
            </label>
            <label className="post-edit-field">
              <span>正文（Markdown）</span>
              <textarea
                value={editBody}
                rows={16}
                disabled={saving}
                onChange={(event) => {
                  setEditBody(event.target.value)
                  setEditError('')
                }}
              />
            </label>
            {editError && <p className="comment-error">{editError}</p>}
            <div className="post-actions">
              <button
                type="submit"
                className="blog-button comment-submit"
                disabled={saving}
              >
                {saving ? '保存中…' : '保存'}
              </button>
              <button
                type="button"
                className="blog-button"
                disabled={saving}
                onClick={cancelEdit}
              >
                取消
              </button>
            </div>
          </form>
        ) : (
          <>
            <h1 className="post-title">{post.title}</h1>
            <div className="blog-meta post-meta">
              {formatTimestamp(post.created_at)}
              {post.author_name ? ` · ${post.author_name}` : ''}
            </div>
            {(canEditPost || canDeletePost) && (
              <div className="post-actions">
                {canEditPost && (
                  <button type="button" className="blog-button" onClick={startEdit}>
                    编辑
                  </button>
                )}
                {canDeletePost && (
                  <button
                    type="button"
                    className="blog-button post-delete"
                    disabled={deletingPost}
                    onClick={handleDeletePost}
                  >
                    {deletingPost ? '删除中…' : '删除'}
                  </button>
                )}
              </div>
            )}
            {postActionError && <p className="comment-error">{postActionError}</p>}
            <MarkdownView className="post-body" content={post.body_md} />
          </>
        )}
      </article>

      {(neighbors?.prev || neighbors?.next) && (
        <nav className="post-neighbors" aria-label="相邻文章">
          {neighbors.prev ? (
            <Link className="post-neighbor" to={`/blog/${neighbors.prev.id}`} state={{ from: fromState }}>
              <span className="post-neighbor-label">← 上一篇（更新）</span>
              <span className="post-neighbor-title">{neighbors.prev.title}</span>
            </Link>
          ) : (
            <span className="post-neighbor post-neighbor-empty">已经是最新一篇</span>
          )}
          {neighbors.next ? (
            <Link className="post-neighbor post-neighbor-next" to={`/blog/${neighbors.next.id}`} state={{ from: fromState }}>
              <span className="post-neighbor-label">下一篇（更早）→</span>
              <span className="post-neighbor-title">{neighbors.next.title}</span>
            </Link>
          ) : (
            <span className="post-neighbor post-neighbor-empty">已经是最早一篇</span>
          )}
        </nav>
      )}

      <section className="comment-section">
        <h2 className="comment-heading">评论</h2>

        {commentStatus === 'loading' && <div className="blog-state">评论加载中…</div>}

        {commentStatus === 'error' && (
          <div className="blog-state blog-state-error">
            <p>{commentsQuery.error}</p>
            <button type="button" className="blog-button" onClick={refreshComments}>
              重试
            </button>
          </div>
        )}

        {commentStatus === 'ready' && comments.length === 0 && (
          <div className="blog-state">还没有评论，来说两句吧。</div>
        )}

        {commentStatus === 'ready' && comments.length > 0 && (
          <ul className="comment-list">
            {comments.map((comment) => (
              <li
                key={comment.id}
                className={
                  comment.parent_id === null ? 'comment-item' : 'comment-item comment-reply'
                }
              >
                <div className="comment-head">
                  <Avatar name={comment.author_name} size="sm" />
                  <span className="comment-author">{comment.author_name ?? '匿名'}</span>
                  <span className="comment-time">{formatTimestamp(comment.created_at)}</span>
                  {canDeleteComment(comment) && (
                    <button
                      type="button"
                      className="comment-delete"
                      disabled={deletingId === comment.id}
                      onClick={() => handleDeleteComment(comment.id)}
                    >
                      {deletingId === comment.id ? '删除中…' : '删除'}
                    </button>
                  )}
                </div>
                <p className="comment-body">{comment.body}</p>
              </li>
            ))}
          </ul>
        )}

        {deleteError && <p className="comment-error">{deleteError}</p>}

        <div className="comment-form">
          {user ? (
            <form onSubmit={handleSubmit}>
              <label className="comment-field">
                <span>发表评论</span>
                <textarea
                  value={body}
                  onChange={(event) => {
                    setBody(event.target.value)
                    setSubmitError('')
                  }}
                  rows={4}
                  maxLength={COMMENT_BODY_MAX}
                  placeholder="写下你的想法…"
                />
              </label>
              {submitError && <p className="comment-error">{submitError}</p>}
              <div className="comment-form-footer">
                <span className="comment-count">{body.length} / {COMMENT_BODY_MAX}</span>
                <button
                  type="submit"
                  className="blog-button comment-submit"
                  disabled={submitting || body.trim().length === 0}
                >
                  {submitting ? '提交中…' : '发表评论'}
                </button>
              </div>
            </form>
          ) : (
            <div className="comment-login">
              <p>登录后评论。</p>
              <button type="button" className="blog-button" onClick={() => openLogin()}>
                登录
              </button>
            </div>
          )}
        </div>
      </section>
      {dialog}
    </div>
  )
}
