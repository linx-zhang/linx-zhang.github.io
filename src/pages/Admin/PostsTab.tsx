import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '@/api/auth'
import { blogApi } from '@/api/blog'

function errorText(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status >= 500) return '服务暂时不可用，请稍后重试。'
    if (err.code === 'forbidden') return err.detail || '没有权限执行该操作。'
    return err.detail
  }
  return '网络请求失败，请检查连接后重试。'
}

export default function PostsTab() {
  const navigate = useNavigate()

  const [title, setTitle] = useState('')
  const [bodyMd, setBodyMd] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')

    const trimmedTitle = title.trim()
    if (trimmedTitle.length === 0) {
      setError('标题不能为空')
      return
    }
    if (trimmedTitle.length > 200) {
      setError('标题不能超过 200 个字符')
      return
    }
    const trimmedBody = bodyMd.trim()
    if (trimmedBody.length === 0) {
      setError('正文不能为空')
      return
    }

    setSubmitting(true)
    try {
      const post = await blogApi.createPost({ title: trimmedTitle, body_md: bodyMd })
      navigate(`/blog/${post.id}`)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="admin-post-section">
      <p className="admin-note">
        这里只负责新建文章；已发布文章可在文章详情页由作者本人或管理员编辑、删除。
      </p>
      <form className="admin-card admin-form" onSubmit={handleSubmit}>
        <label className="admin-field">
          <span>标题</span>
          <input
            type="text"
            value={title}
            onChange={(event) => {
              setTitle(event.target.value)
              setError('')
            }}
            maxLength={200}
            placeholder="文章标题"
          />
        </label>

        <label className="admin-field">
          <span>正文（Markdown）</span>
          <textarea
            value={bodyMd}
            onChange={(event) => {
              setBodyMd(event.target.value)
              setError('')
            }}
            rows={18}
            placeholder="支持 Markdown，发布后将使用与知识库相同的渲染方式。"
          />
        </label>

        {error && <p className="admin-error">{error}</p>}

        <div className="admin-actions">
          <button
            type="submit"
            className="blog-button admin-submit"
            disabled={submitting || title.trim().length === 0 || bodyMd.trim().length === 0}
          >
            {submitting ? '发布中…' : '发布'}
          </button>
        </div>
      </form>
    </section>
  )
}
