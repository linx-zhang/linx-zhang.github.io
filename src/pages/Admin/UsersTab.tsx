import { useEffect, useRef, useState } from 'react'
import { ApiError } from '@/api/auth'
import { adminApi } from '@/api/admin'
import type { AdminUser, UserRole } from '@/api/admin'
import { useAuth } from '@/auth/AuthProvider'
import { usePermission } from '@/auth/usePermission'
import { useConfirm } from '@/components/ConfirmDialog/useConfirm'

const PAGE_SIZE = 20

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'user', label: '普通用户（user）' },
  { value: 'internal', label: '内部用户（internal）' },
  { value: 'admin', label: '管理员（admin）' },
]

function roleLabel(role: string): string {
  return ROLE_OPTIONS.find((item) => item.value === role)?.label ?? role
}

function formatTimestamp(value: string): string {
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

export default function UsersTab() {
  const { user: currentUser } = useAuth()
  const { has } = usePermission()
  const { confirm, dialog } = useConfirm()
  const canUpdate = has('user:update:any')

  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<'' | UserRole>('')
  const [pageIndex, setPageIndex] = useState(0)

  const [items, setItems] = useState<AdminUser[]>([])
  const [total, setTotal] = useState(0)
  const [listStatus, setListStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [listError, setListError] = useState('')

  const [updatingId, setUpdatingId] = useState<number | null>(null)
  const [roleError, setRoleError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
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
    if (target.role === next) return
    confirm({
      title: '修改用户角色',
      description: `将 ${target.email} 的角色从「${roleLabel(target.role)}」改为「${roleLabel(next)}」？`,
      confirmText: '修改',
      pendingText: '修改中…',
      onConfirm: async () => {
        setRoleError('')
        setUpdatingId(target.id)
        try {
          const updated = await adminApi.updateUserRole(target.id, next)
          setItems((prev) =>
            prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)),
          )
        } catch (err) {
          setRoleError(errorText(err))
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
              setRoleError('')
            }}
          />
        </label>
        <label className="user-filter">
          <span className="user-search-label">角色</span>
          <select
            value={roleFilter}
            onChange={(event) => {
              setRoleFilter(event.target.value as '' | UserRole)
              setPageIndex(0)
              setListStatus('loading')
            }}
          >
            <option value="">全部角色</option>
            {ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
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
            <span>邮箱</span>
            <span>角色</span>
            <span>注册时间</span>
          </div>
          {items.map((item) => {
            const isSelf = currentUser !== null && item.id === currentUser.id
            const knownRole = ROLE_OPTIONS.some((option) => option.value === item.role)
            return (
              <div className="user-item" key={item.id}>
                <div className="user-cell user-email" data-label="邮箱">
                  {item.email}
                  {isSelf && <span className="user-self-tag">你</span>}
                </div>
                <div className="user-cell" data-label="角色">
                  {canUpdate && knownRole ? (
                    <select
                      className="user-role-select"
                      value={item.role}
                      disabled={isSelf || updatingId === item.id}
                      aria-label={`修改 ${item.email} 的角色`}
                      onChange={(event) => requestRoleChange(item, event.target.value as UserRole)}
                    >
                      {ROLE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className={`invite-badge${item.role === 'admin' ? ' invite-badge-admin' : ''}`}>
                      {roleLabel(item.role)}
                    </span>
                  )}
                  {isSelf && <span className="user-self-hint">不能修改自己的角色</span>}
                </div>
                <div className="user-cell user-created" data-label="注册时间">
                  {formatTimestamp(item.created_at)}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {roleError && <p className="comment-error">{roleError}</p>}

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

      {dialog}
    </section>
  )
}
