import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '@/api/auth'
import { blogApi } from '@/api/blog'
import type { Comment, Post } from '@/api/blog'
import { useAuth } from '@/auth/AuthProvider'
import { usePermission } from '@/auth/usePermission'
import MarkdownView from '@/components/MarkdownView'
import { useConfirm } from '@/components/ConfirmDialog/useConfirm'
import './Blog.css'

function formatDate(value: string): string {
  return value.replace('T', ' ').slice(0, 16)
}

function errorText(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status >= 500) return '服务暂时不可用，请稍后重试。'
    if (err.code === 'forbidden') return err.detail || '没有权限执行该操作。'
    return err.detail
  }
  return '网络请求失败，请检查连接后重试。'
}

function commentOrder(a: Comment, b: Comment): number {
  if (a.created_at === b.created_at) return a.id - b.id
  return a.created_at < b.created_at ? -1 : 1
}

export default function PostDetail() {
  const { id } = useParams()
  const postId = Number(id)
  const validId = Number.isInteger(postId) && postId > 0
  const navigate = useNavigate()

  const { user, openLogin } = useAuth()
  const { has } = usePermission()
  const { confirm, dialog } = useConfirm()

  const [post, setPost] = useState<Post | null>(null)
  const [postStatus, setPostStatus] = useState<'loading' | 'ready' | 'missing' | 'error'>(
    validId ? 'loading' : 'missing',
  )
  const [postError, setPostError] = useState('')
  const [postReloadKey, setPostReloadKey] = useState(0)

  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editBody, setEditBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState('')
  const [deletingPost, setDeletingPost] = useState(false)
  const [postActionError, setPostActionError] = useState('')

  const [comments, setComments] = useState<Comment[]>([])
  const [commentStatus, setCommentStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [commentError, setCommentError] = useState('')

  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [deleteError, setDeleteError] = useState('')

  useEffect(() => {
    if (!validId) return
    let cancelled = false
    setPostStatus('loading')
    setPostError('')
    blogApi
      .getPost(postId)
      .then((value) => {
        if (cancelled) return
        setPost(value)
        setPostStatus('ready')
      })
      .catch((err) => {
        if (cancelled) return
        if (err instanceof ApiError && err.status === 404) {
          setPostStatus('missing')
          return
        }
        setPostError(errorText(err))
        setPostStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [postId, validId, postReloadKey])

  useEffect(() => {
    if (!validId) return
    let cancelled = false
    setCommentStatus('loading')
    setCommentError('')
    blogApi
      .listComments(postId)
      .then((list) => {
        if (cancelled) return
        setComments([...list].sort(commentOrder))
        setCommentStatus('ready')
      })
      .catch((err) => {
        if (cancelled) return
        setCommentError(errorText(err))
        setCommentStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [postId, validId])

  const refreshComments = () => {
    setCommentStatus('loading')
    setCommentError('')
    blogApi
      .listComments(postId)
      .then((list) => {
        setComments([...list].sort(commentOrder))
        setCommentStatus('ready')
      })
      .catch((err) => {
        setCommentError(errorText(err))
        setCommentStatus('error')
      })
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitError('')
    const trimmed = body.trim()
    if (trimmed.length === 0) {
      setSubmitError('评论内容不能为空')
      return
    }
    if (trimmed.length > 5000) {
      setSubmitError('评论内容不能超过 5000 个字符')
      return
    }
    setSubmitting(true)
    try {
      await blogApi.createComment(postId, trimmed)
      setBody('')
      refreshComments()
    } catch (err) {
      setSubmitError(errorText(err))
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
          setDeleteError(errorText(err))
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
    if (trimmedTitle.length > 200) {
      setEditError('标题不能超过 200 个字符')
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
      setPost(updated)
      setEditing(false)
    } catch (err) {
      setEditError(errorText(err))
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
          navigate('/blog')
        } catch (err) {
          setPostActionError(errorText(err))
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
          <Link className="blog-button" to="/blog">
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
          <p>{postError}</p>
          <div className="blog-state-actions">
            <button
              type="button"
              className="blog-button"
              onClick={() => setPostReloadKey((key) => key + 1)}
            >
              重试
            </button>
            <Link className="blog-button" to="/blog">
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
        <Link className="post-back" to="/blog">
          ← 返回博客列表
        </Link>

        {editing ? (
          <form className="post-edit" onSubmit={handleSave} noValidate>
            <label className="post-edit-field">
              <span>标题</span>
              <input
                type="text"
                value={editTitle}
                maxLength={200}
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
              {formatDate(post.created_at)}
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

      <section className="comment-section">
        <h2 className="comment-heading">评论</h2>

        {commentStatus === 'loading' && <div className="blog-state">评论加载中…</div>}

        {commentStatus === 'error' && (
          <div className="blog-state blog-state-error">
            <p>{commentError}</p>
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
                  <span className="comment-avatar" aria-hidden="true">
                    {(comment.author_name ?? '?').charAt(0).toUpperCase()}
                  </span>
                  <span className="comment-author">{comment.author_name ?? '匿名'}</span>
                  <span className="comment-time">{formatDate(comment.created_at)}</span>
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
                  maxLength={5000}
                  placeholder="写下你的想法…"
                />
              </label>
              {submitError && <p className="comment-error">{submitError}</p>}
              <div className="comment-form-footer">
                <span className="comment-count">{body.length} / 5000</span>
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
              <button type="button" className="blog-button" onClick={openLogin}>
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
