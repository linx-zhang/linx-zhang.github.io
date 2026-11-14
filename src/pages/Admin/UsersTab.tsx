import { useEffect, useRef, useState } from 'react'
import { errorMessage } from '@/api/errors'
import { adminApi } from '@/api/admin'
import type { AdminUser, UserRole } from '@/api/admin'
import { useAuth } from '@/auth/AuthProvider'
import { usePermission } from '@/auth/usePermission'
import Avatar from '@/components/Avatar'
import { displayName } from '@/components/Avatar/avatarText'
import { useConfirm } from '@/components/ConfirmDialog/useConfirm'
import Select from '@/components/Select'
import ListState from '@/components/ListState'
import { usePagedList } from '@/hooks/usePagedList'
import Pager from './Pager'
import InvitesTab from './InvitesTab'
import { PAGE_SIZE } from '@/constants'
import ResetPasswordDialog from './ResetPasswordDialog'
import UserEditDialog from './UserEditDialog'
import { FILTER_OPTIONS, ROLE_OPTIONS, roleLabel } from './userRoles'
import { formatDate, formatTimestamp, parseServerTimestamp } from '@/utils/format'

function relativeTime(value: string | null): string {
  if (!value) return '—'
  const date = parseServerTimestamp(value)
  if (!date) return value
  const diff = Date.now() - date.getTime()
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`
  if (diff < 30 * 86_400_000) return `${Math.floor(diff / 86_400_000)} 天前`
  return formatDate(value)
}

export default function UsersTab() {
  const { user: currentUser, updateUser } = useAuth()
  const { has } = usePermission()
  const { confirm, dialog } = useConfirm()
  const canUpdate = has('user:update:any')
  const canDelete = has('user:delete:any')
  const canResetPassword = has('user:reset_password:any')
  const canInvite = has('invite_code:read:any')
  const showActions = canUpdate || canDelete || canResetPassword

  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<'' | UserRole>('')

  const list = usePagedList<AdminUser>(
    (limit, offset) =>
      adminApi.listUsers({
        q: debouncedQuery || undefined,
        role: roleFilter || undefined,
        limit,
        offset,
      }),
    { deps: [debouncedQuery, roleFilter] },
  )

  const [updatingId, setUpdatingId] = useState<number | null>(null)
  const [actionError, setActionError] = useState('')

  const [editingUser, setEditingUser] = useState<AdminUser | null>(null)
  const [resettingUser, setResettingUser] = useState<AdminUser | null>(null)

  const appliedQuery = useRef('')

  // 搜索防抖：只在真正变了词时才重置到第 1 页
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = query.trim()
      if (next === appliedQuery.current) return
      appliedQuery.current = next
      setDebouncedQuery(next)
      list.reset()
    }, 300)
    return () => window.clearTimeout(timer)
  }, [query])

  const { items, total, hasNext, pageIndex, status, error } = list
  const totalPages = Math.max(1, Math.ceil((total ?? 0) / PAGE_SIZE))

  const requestRoleChange = (target: AdminUser, next: UserRole) => {
    if (target.role === next || updatingId === target.id) return
    const previousRole = target.role
    setActionError('')
    setUpdatingId(target.id)
    // 先就地更新，失败再回滚到原角色
    list.setItems((prev) =>
      prev.map((item) => (item.id === target.id ? { ...item, role: next } : item)),
    )
    adminApi
      .updateUser(target.id, { role: next })
      .then((updated) => {
        list.setItems((prev) =>
          prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)),
        )
      })
      .catch((err) => {
        list.setItems((prev) =>
          prev.map((item) => (item.id === target.id ? { ...item, role: previousRole } : item)),
        )
        setActionError(errorMessage(err))
      })
      .finally(() => setUpdatingId(null))
  }

  const handleSaved = (updated: AdminUser) => {
    list.setItems((prev) =>
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
          setEditingUser(null)
          // 删掉的是本页最后一条且不在第 1 页：回退一页，否则停在空页上
          if (items.length <= 1 && pageIndex > 0) list.goToPage(pageIndex - 1)
          // 其余情况以服务端为准重取：总数、页码、空态都不用手算
          else list.reload()
        } catch (err) {
          setActionError(errorMessage(err))
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
              list.reset()
            }}
            options={FILTER_OPTIONS}
            ariaLabel="按角色筛选"
          />
        </div>
      </div>

      <div className="invite-list-head">
        <h2 className="admin-section-title">用户</h2>
        <span className="invite-total">共 {total ?? 0} 人</span>
      </div>

      <ListState
        status={status}
        error={error}
        onRetry={list.retry}
        count={items.length}
        emptyText="没有匹配的用户。"
      />

      {status === 'ready' && items.length > 0 && (
        <div className="user-list">
          <div className={`user-list-head${showActions ? ' has-actions' : ''}`} aria-hidden="true">
            <span>用户</span>
            <span>角色</span>
            <span>注册时间</span>
            <span>最后活跃</span>
            {showActions && <span>操作</span>}
          </div>
          {items.map((item) => {
            const isSelf = currentUser !== null && item.id === currentUser.id
            const name = displayName(item)
            return (
              <div key={item.id} className={`user-item${showActions ? ' has-actions' : ''}`}>
                <div className="user-cell user-email" data-label="用户">
                  <Avatar user={item} size="sm" />
                  <div className="user-identity">
                    <span className="user-name">{name || item.email}</span>
                    {name && name !== item.email && (
                      <span className="user-email-sub">{item.email}</span>
                    )}
                  </div>
                  {isSelf && <span className="user-self-tag">你</span>}
                </div>
                <div className="user-cell user-role-cell" data-label="角色">
                  <div className="user-role-row">
                    {canUpdate ? (
                      <div
                        className="user-role-select"
                        title={isSelf ? '不能修改自己的角色' : undefined}
                      >
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
                  </div>
                </div>
                <div className="user-cell user-created" data-label="注册时间">
                  {formatTimestamp(item.created_at)}
                </div>
                <div className="user-cell user-created" data-label="最后活跃">
                  {relativeTime(item.last_active_at)}
                </div>
                {showActions && (
                  <div className="user-cell user-actions" data-label="操作">
                    {canUpdate && (
                      <button
                        type="button"
                        className="user-action user-action-edit"
                        onClick={() => setEditingUser(item)}
                      >
                        编辑
                      </button>
                    )}
                    {canResetPassword && (
                      <button
                        type="button"
                        className="user-action user-action-reset"
                        disabled={updatingId === item.id}
                        onClick={() => setResettingUser(item)}
                      >
                        重置密码
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
                )}
              </div>
            )
          })}
        </div>
      )}

      {actionError && <p className="comment-error">{actionError}</p>}

      {totalPages > 1 && (
        <Pager
          pageIndex={pageIndex}
          hasNext={hasNext}
          onPage={list.goToPage}
          totalPages={totalPages}
          disabled={status === 'loading'}
        />
      )}

      {/* 邀请码 = 怎么造出用户，和用户列表同一屏；没有权限的人整块不渲染 */}
      {canInvite && (
        <div className="admin-invite-block">
          <InvitesTab />
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

      {resettingUser && (
        <ResetPasswordDialog
          key={resettingUser.id}
          user={resettingUser}
          isSelf={currentUser !== null && resettingUser.id === currentUser.id}
          onClose={() => setResettingUser(null)}
        />
      )}

      {dialog}
    </section>
  )
}
