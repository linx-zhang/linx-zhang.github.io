import { useEffect, useRef, useState } from 'react'
import { ApiError } from '@/api/auth'
import { adminApi } from '@/api/admin'
import type { AdminUser, UserRole } from '@/api/admin'
import { useAuth } from '@/auth/AuthProvider'
import { usePermission } from '@/auth/usePermission'
import Avatar from '@/components/Avatar'
import { displayName } from '@/components/Avatar/avatarText'
import { useConfirm } from '@/components/ConfirmDialog/useConfirm'
import Select from '@/components/Select'
import UserEditDialog from './UserEditDialog'
import { FILTER_OPTIONS, ROLE_OPTIONS, roleLabel } from './userRoles'

const PAGE_SIZE = 20

function formatTimestamp(value: string): string {
  return value.replace('T', ' ').slice(0, 16)
}

function parseTimestamp(value: string): number {
  const normalized = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`
  return Date.parse(normalized)
}

function relativeTime(value: string | null): string {
  if (!value) return '—'
  const ts = parseTimestamp(value)
  if (Number.isNaN(ts)) return value
  const diff = Date.now() - ts
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`
  if (diff < 30 * 86_400_000) return `${Math.floor(diff / 86_400_000)} 天前`
  return value.replace('T', ' ').slice(0, 10)
}

function errorText(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status >= 500) return '服务暂时不可用，请稍后重试。'
    if (err.code === 'forbidden') return err.detail || '没有权限执行该操作。'
    return err.detail
  }
  return '网络请求失败，请检查连接后重试。'
}

export default function UsersTab() {
  const { user: currentUser, updateUser } = useAuth()
  const { has } = usePermission()
  const { confirm, dialog } = useConfirm()
  const canUpdate = has('user:update:any')
  const canDelete = has('user:delete:any')

  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<'' | UserRole>('')
  const [pageIndex, setPageIndex] = useState(0)

  const [items, setItems] = useState<AdminUser[]>([])
  const [total, setTotal] = useState(0)
  const [listStatus, setListStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [listError, setListError] = useState('')

  const [updatingId, setUpdatingId] = useState<number | null>(null)
  const [actionError, setActionError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  const [editingUser, setEditingUser] = useState<AdminUser | null>(null)

  const appliedQuery = useRef('')

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = query.trim()
      if (next === appliedQuery.current) return
      appliedQuery.current = next
      setDebouncedQuery(next)
      setPageIndex(0)
      setListStatus('loading')
    }, 300)
    return () => window.clearTimeout(timer)
  }, [query])

  useEffect(() => {
    let cancelled = false
    adminApi
      .listUsers({
        q: debouncedQuery || undefined,
        role: roleFilter || undefined,
        limit: PAGE_SIZE,
        offset: pageIndex * PAGE_SIZE,
      })
      .then((page) => {
        if (cancelled) return
        setItems(page.items)
        setTotal(page.total)
        setListStatus('ready')
      })
      .catch((err) => {
        if (cancelled) return
        setListError(errorText(err))
        setListStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [debouncedQuery, roleFilter, pageIndex, reloadKey])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const requestRoleChange = (target: AdminUser, next: UserRole) => {
    if (target.role === next || updatingId === target.id) return
    const previousRole = target.role
    setActionError('')
    setUpdatingId(target.id)
    // 先就地更新，失败再回滚到原角色
    setItems((prev) =>
      prev.map((item) => (item.id === target.id ? { ...item, role: next } : item)),
    )
    adminApi
      .updateUser(target.id, { role: next })
      .then((updated) => {
        setItems((prev) =>
          prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)),
        )
      })
      .catch((err) => {
        setItems((prev) =>
          prev.map((item) => (item.id === target.id ? { ...item, role: previousRole } : item)),
        )
        setActionError(errorText(err))
      })
      .finally(() => setUpdatingId(null))
  }

  const handleSaved = (updated: AdminUser) => {
    setItems((prev) =>
      prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)),
    )
    if (currentUser && updated.id === currentUser.id) {
      updateUser({
        ...currentUser,
        nickname: updated.nickname ?? null,
        first_name: updated.first_name ?? null,
        last_name: updated.last_name ?? null,
        avatar_url: updated.avatar_url ?? null,
      })
    }
  }

  const requestDelete = (target: AdminUser) => {
    confirm({
      title: '删除用户',
      description: `确认删除用户 ${target.email}？删除后该用户无法登录，其文章保留并显示为已注销。`,
      confirmText: '删除',
      pendingText: '删除中…',
      tone: 'danger',
      onConfirm: async () => {
        setActionError('')
        setUpdatingId(target.id)
        try {
          await adminApi.deleteUser(target.id)
          setItems((prev) => {
            const next = prev.filter((item) => item.id !== target.id)
            if (next.length === 0 && pageIndex > 0) {
              setPageIndex((index) => Math.max(0, index - 1))
              setListStatus('loading')
            }
            return next
          })
          setTotal((value) => Math.max(0, value - 1))
          setEditingUser(null)
        } catch (err) {
          setActionError(errorText(err))
        } finally {
          setUpdatingId(null)
        }
      },
    })
  }

  return (
    <section className="user-section">
      <div className="user-toolbar">
        <label className="user-search">
          <span className="user-search-label">搜索</span>
          <input
            type="search"
            value={query}
            placeholder="按邮箱搜索"
            onChange={(event) => {
              setQuery(event.target.value)
              setActionError('')
            }}
          />
        </label>
        <div className="user-filter">
          <span className="user-search-label">角色</span>
          <Select
            value={roleFilter}
            onChange={(next) => {
              setRoleFilter(next as '' | UserRole)
              setPageIndex(0)
              setListStatus('loading')
            }}
            options={FILTER_OPTIONS}
            ariaLabel="按角色筛选"
          />
        </div>
      </div>

      <div className="invite-list-head">
        <h2 className="admin-section-title">用户</h2>
        <span className="invite-total">共 {total} 人</span>
      </div>

      {listStatus === 'loading' && <div className="user-empty">加载中…</div>}

      {listStatus === 'error' && (
        <div className="user-empty">
          <p>{listError}</p>
          <button
            type="button"
            className="blog-button"
            onClick={() => {
              setListStatus('loading')
              setReloadKey((key) => key + 1)
            }}
          >
            重试
          </button>
        </div>
      )}

      {listStatus === 'ready' && items.length === 0 && (
        <div className="user-empty">没有匹配的用户。</div>
      )}

      {listStatus === 'ready' && items.length > 0 && (
        <div className="user-list">
          <div className="user-list-head" aria-hidden="true">
            <span>用户</span>
            <span>角色</span>
            <span>注册时间</span>
            <span>最后活跃</span>
          </div>
          {items.map((item) => {
            const isSelf = currentUser !== null && item.id === currentUser.id
            const name = displayName(item)
            return (
              <div key={item.id} className="user-item">
                <div className="user-cell user-email" data-label="用户">
                  <Avatar user={item} size="sm" />
                  <div className="user-identity">
                    <span className="user-name">{name || item.email}</span>
                    {name && name !== item.email && (
                      <span className="user-email-sub">{item.email}</span>
                    )}
                  </div>
                  {isSelf && <span className="user-self-tag">你</span>}
                  {canUpdate && (
                    <button
                      type="button"
                      className="user-action user-edit"
                      onClick={() => setEditingUser(item)}
                    >
                      编辑
                    </button>
                  )}
                </div>
                <div className="user-cell user-role-cell" data-label="角色">
                  <div className="user-role-row">
                    {canUpdate ? (
                      <div className="user-role-select">
                        <Select
                          value={item.role}
                          onChange={(next) => requestRoleChange(item, next as UserRole)}
                          options={ROLE_OPTIONS}
                          disabled={isSelf || updatingId === item.id}
                          ariaLabel={`修改 ${item.email} 的角色`}
                        />
                      </div>
                    ) : (
                      <span
                        className={`invite-badge${item.role === 'admin' ? ' invite-badge-admin' : ''}`}
                      >
                        {roleLabel(item.role)}
                      </span>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        className="user-action user-action-danger"
                        disabled={updatingId === item.id}
                        onClick={() => requestDelete(item)}
                      >
                        删除
                      </button>
                    )}
                  </div>
                  {isSelf && <span className="user-self-hint">不能修改自己的角色</span>}
                </div>
                <div className="user-cell user-created" data-label="注册时间">
                  {formatTimestamp(item.created_at)}
                </div>
                <div className="user-cell user-created" data-label="最后活跃">
                  {relativeTime(item.last_active_at)}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {actionError && <p className="comment-error">{actionError}</p>}

      {totalPages > 1 && (
        <div className="admin-pager">
          <button
            type="button"
            className="blog-button"
            disabled={pageIndex === 0 || listStatus === 'loading'}
            onClick={() => {
              setPageIndex((index) => Math.max(0, index - 1))
              setListStatus('loading')
            }}
          >
            上一页
          </button>
          <span>
            第 {pageIndex + 1} / {totalPages} 页
          </span>
          <button
            type="button"
            className="blog-button"
            disabled={pageIndex + 1 >= totalPages || listStatus === 'loading'}
            onClick={() => {
              setPageIndex((index) => index + 1)
              setListStatus('loading')
            }}
          >
            下一页
          </button>
        </div>
      )}

      {editingUser && (
        <UserEditDialog
          key={editingUser.id}
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSaved={handleSaved}
        />
      )}

      {dialog}
    </section>
  )
}
