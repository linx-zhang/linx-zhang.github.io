import { Fragment, useEffect, useRef, useState } from 'react'
import { ApiError } from '@/api/auth'
import { adminApi } from '@/api/admin'
import type { AdminUser, UserRole } from '@/api/admin'
import { useAuth } from '@/auth/AuthProvider'
import { usePermission } from '@/auth/usePermission'
import { useConfirm } from '@/components/ConfirmDialog/useConfirm'
import Select from '@/components/Select'

const PAGE_SIZE = 20

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'user', label: '普通用户（user）' },
  { value: 'internal', label: '内部用户（internal）' },
  { value: 'admin', label: '管理员（admin）' },
]

const FILTER_OPTIONS = [{ value: '', label: '全部角色' }, ...ROLE_OPTIONS]

function roleLabel(role: string): string {
  return ROLE_OPTIONS.find((item) => item.value === role)?.label ?? role
}

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

function emailErrorText(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'email_exists') return '该邮箱已被使用'
    if (err.code === 'invalid_email') return '邮箱格式不正确，请检查后重试'
    return errorText(err)
  }
  return '网络请求失败，请检查连接后重试。'
}

export default function UsersTab() {
  const { user: currentUser } = useAuth()
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

  const [editingEmailId, setEditingEmailId] = useState<number | null>(null)
  const [emailDraft, setEmailDraft] = useState('')
  const [emailSaving, setEmailSaving] = useState(false)
  const [emailError, setEmailError] = useState('')

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
        setActionError('')
        setUpdatingId(target.id)
        try {
          const updated = await adminApi.updateUser(target.id, { role: next })
          setItems((prev) =>
            prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)),
          )
        } catch (err) {
          setActionError(errorText(err))
        } finally {
          setUpdatingId(null)
        }
      },
    })
  }

  const startEditEmail = (target: AdminUser) => {
    setEditingEmailId(target.id)
    setEmailDraft(target.email)
    setEmailError('')
    setActionError('')
  }

  const saveEmail = async () => {
    if (editingEmailId === null) return
    const next = emailDraft.trim()
    if (next.length === 0) {
      setEmailError('邮箱不能为空')
      return
    }
    setEmailSaving(true)
    setEmailError('')
    try {
      const updated = await adminApi.updateUser(editingEmailId, { email: next })
      setItems((prev) =>
        prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)),
      )
      setEditingEmailId(null)
    } catch (err) {
      setEmailError(emailErrorText(err))
    } finally {
      setEmailSaving(false)
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
            <span>邮箱</span>
            <span>角色</span>
            <span>注册时间</span>
            <span>最后活跃</span>
            <span>操作</span>
          </div>
          {items.map((item) => {
            const isSelf = currentUser !== null && item.id === currentUser.id
            const knownRole = ROLE_OPTIONS.some((option) => option.value === item.role)
            return (
              <Fragment key={item.id}>
                <div className="user-item">
                  <div className="user-cell user-email" data-label="邮箱">
                    {item.email}
                    {isSelf && <span className="user-self-tag">你</span>}
                  </div>
                  <div className="user-cell" data-label="角色">
                    {canUpdate && knownRole ? (
                      <Select
                        value={item.role}
                        onChange={(next) => requestRoleChange(item, next as UserRole)}
                        options={ROLE_OPTIONS}
                        disabled={isSelf || updatingId === item.id}
                        ariaLabel={`修改 ${item.email} 的角色`}
                      />
                    ) : (
                      <span
                        className={`invite-badge${item.role === 'admin' ? ' invite-badge-admin' : ''}`}
                      >
                        {roleLabel(item.role)}
                      </span>
                    )}
                    {isSelf && <span className="user-self-hint">不能修改自己的角色</span>}
                  </div>
                  <div className="user-cell user-created" data-label="注册时间">
                    {formatTimestamp(item.created_at)}
                  </div>
                  <div className="user-cell user-created" data-label="最后活跃">
                    {relativeTime(item.last_active_at)}
                  </div>
                  <div className="user-cell user-actions" data-label="操作">
                    {canUpdate && (
                      <button
                        type="button"
                        className="user-action"
                        onClick={() => startEditEmail(item)}
                      >
                        改邮箱
                      </button>
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
                </div>
                {editingEmailId === item.id && (
                  <div className="user-email-editor">
                    <label className="user-email-field">
                      <span>新邮箱</span>
                      <input
                        type="email"
                        value={emailDraft}
                        disabled={emailSaving}
                        onChange={(event) => {
                          setEmailDraft(event.target.value)
                          setEmailError('')
                        }}
                      />
                    </label>
                    {emailError && <p className="user-email-error">{emailError}</p>}
                    <div className="user-email-actions">
                      <button
                        type="button"
                        className="blog-button"
                        disabled={emailSaving}
                        onClick={() => setEditingEmailId(null)}
                      >
                        取消
                      </button>
                      <button
                        type="button"
                        className="blog-button comment-submit"
                        disabled={emailSaving}
                        onClick={saveEmail}
                      >
                        {emailSaving ? '保存中…' : '保存'}
                      </button>
                    </div>
                  </div>
                )}
              </Fragment>
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

      {dialog}
    </section>
  )
}
