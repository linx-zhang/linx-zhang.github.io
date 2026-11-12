import { useState } from 'react'
import { Link } from 'react-router-dom'
import { errorMessage } from '@/api/client'
import { blogApi } from '@/api/blog'
import type { Post } from '@/api/blog'
import { usePermission } from '@/auth/usePermission'
import { useConfirm } from '@/components/ConfirmDialog/useConfirm'
import { usePagedFetch } from '@/hooks/usePagedFetch'
import { formatTimestamp } from '@/utils/format'

interface DeleteFailure {
  id: number
  detail: string
}

export default function PostsTab() {
  const { has } = usePermission()
  const { confirm, dialog } = useConfirm()
  const canDelete = has('post:delete:any')

  const { items, setItems, pageIndex, hasNext, status, error, goToPage, retry } =
    usePagedFetch<Post>((limit, offset) => blogApi.listPosts(limit, offset))

  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [deleting, setDeleting] = useState(false)
  const [failures, setFailures] = useState<DeleteFailure[]>([])
  const [batchError, setBatchError] = useState('')

  const selectedPosts = items.filter((post) => selected.has(post.id))
  const allSelected = items.length > 0 && items.every((post) => selected.has(post.id))

  const toggleOne = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allSelected) {
        items.forEach((post) => next.delete(post.id))
      } else {
        items.forEach((post) => next.add(post.id))
      }
      return next
    })
  }

  const refresh = () => {
    setSelected(new Set())
    setBatchError('')
    retry()
  }

  const requestBatchDelete = () => {
    if (!canDelete || selectedPosts.length === 0) return
    const targets = selectedPosts
    confirm({
      title: '批量删除文章',
      description: `将删除 ${targets.length} 篇文章，删除后不可恢复。`,
      confirmText: '删除',
      pendingText: '删除中…',
      tone: 'danger',
      onConfirm: async () => {
        setDeleting(true)
        setFailures([])
        setBatchError('')
        try {
          // 单次请求：后端逐条返回 deleted / failed，前端不做整体回滚
          const result = await blogApi.deletePostsBatch(
            targets.map((post) => post.id).slice(0, 50),
          )
          const deleted = new Set(result.deleted)
          setFailures(result.failed.map((item) => ({ id: item.id, detail: item.detail })))
          setSelected(new Set())
          const remaining = items.filter((post) => !deleted.has(post.id))
          setItems(remaining)
          if (remaining.length === 0 && pageIndex > 0) {
            goToPage(pageIndex - 1)
          }
        } catch (err) {
          setBatchError(errorMessage(err))
        } finally {
          setDeleting(false)
        }
      },
    })
  }

  return (
    <section className="admin-post-section">
      <div className="invite-list-head">
        <h2 className="admin-section-title">全部文章</h2>
        <span className="invite-total">
          {canDelete ? `已选 ${selectedPosts.length} 篇` : `本页 ${items.length} 篇`}
        </span>
      </div>

      <p className="admin-note">
        写作请前往博客页；编辑文章请在详情页进行。
      </p>

      {batchError && <p className="comment-error">{batchError}</p>}

      {canDelete && (
        <div className="post-batch-bar">
          <button
            type="button"
            className="blog-button post-batch-delete"
            disabled={selectedPosts.length === 0 || deleting}
            onClick={requestBatchDelete}
          >
            {deleting ? '删除中…' : '批量删除'}
          </button>
          {selectedPosts.length > 0 && (
            <button
              type="button"
              className="blog-button"
              disabled={deleting}
              onClick={() => setSelected(new Set())}
            >
              清除选择
            </button>
          )}
        </div>
      )}

      {status === 'loading' && <div className="user-empty">加载中…</div>}

      {status === 'error' && (
        <div className="user-empty">
          <p>{error}</p>
          <button type="button" className="blog-button" onClick={refresh}>
            重试
          </button>
        </div>
      )}

      {status === 'ready' && items.length === 0 && (
        <div className="user-empty">还没有文章，去博客页写一篇吧。</div>
      )}

      {status === 'ready' && items.length > 0 && (
        <div className="post-list">
          <div className="post-list-head">
            {canDelete ? (
              <input
                type="checkbox"
                className="post-check"
                checked={allSelected}
                aria-label="全选当前页"
                onChange={toggleAll}
              />
            ) : (
              <span />
            )}
            <span>标题</span>
            <span>作者</span>
            <span>创建时间</span>
            <span>状态</span>
          </div>
          {items.map((post) => (
            <div className="post-row" key={post.id}>
              {canDelete ? (
                <input
                  type="checkbox"
                  className="post-check"
                  checked={selected.has(post.id)}
                  aria-label={`选择文章 ${post.title}`}
                  onChange={() => toggleOne(post.id)}
                />
              ) : (
                <span />
              )}
              <div className="post-row-title" data-label="标题">
                <Link to={`/blog/${post.id}`}>{post.title}</Link>
              </div>
              <div className="post-row-cell" data-label="作者">
                {post.author_name ?? '—'}
              </div>
              <div className="post-row-cell" data-label="创建时间">
                {formatTimestamp(post.created_at)}
              </div>
              <div className="post-row-cell" data-label="状态">
                <span className="invite-status invite-status-unused">已发布</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {failures.length > 0 && (
        <div className="post-failures">
          <p className="post-failures-title">{failures.length} 篇删除失败：</p>
          <ul>
            {failures.map((item) => (
              <li key={item.id}>
                文章 {item.id}：{item.detail}
              </li>
            ))}
          </ul>
        </div>
      )}

      {status === 'ready' && (
        <div className="admin-pager">
          <button
            type="button"
            className="blog-button"
            disabled={pageIndex === 0 || deleting}
            onClick={() => goToPage(pageIndex - 1)}
          >
            上一页
          </button>
          <span>第 {pageIndex + 1} 页</span>
          <button
            type="button"
            className="blog-button"
            disabled={!hasNext || deleting}
            onClick={() => goToPage(pageIndex + 1)}
          >
            下一页
          </button>
        </div>
      )}

      {dialog}
    </section>
  )
}
