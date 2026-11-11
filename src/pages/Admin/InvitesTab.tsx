import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { errorMessage } from '@/api/client'
import { adminApi } from '@/api/admin'
import type { InviteCode, InviteRole } from '@/api/admin'
import { useConfirm } from '@/components/ConfirmDialog/useConfirm'
import Select from '@/components/Select'

const PAGE_SIZE = 20
const ROLE_LABEL: Record<string, string> = {
  internal: '普通用户',
  admin: '管理员',
  user: '普通用户',
}

function formatTimestamp(value: string): string {
  return value.replace('T', ' ').slice(0, 16)
}

function statusOf(invite: InviteCode): 'unused' | 'used' | 'expired' {
  if (invite.used_at) return 'used'
  if (!invite.expires_at) return 'unused'
  const raw = invite.expires_at.includes('T')
    ? invite.expires_at
    : invite.expires_at.replace(' ', 'T')
  const withZone = /Z|[+-]\d{2}:\d{2}$/.test(raw) ? raw : `${raw}Z`
  return Date.parse(withZone) <= Date.now() ? 'expired' : 'unused'
}

function statusLabel(invite: InviteCode): string {
  const status = statusOf(invite)
  if (status === 'used') return '已使用'
  if (status === 'expired') return '已过期'
  return '未使用'
}

export default function InvitesTab() {
  const [pageIndex, setPageIndex] = useState(0)
  const [items, setItems] = useState<InviteCode[]>([])
  const [total, setTotal] = useState(0)
  const [listStatus, setListStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [listError, setListError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  const [role, setRole] = useState<InviteRole>('internal')
  const [count, setCount] = useState('1')
  const [days, setDays] = useState('7')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [notice, setNotice] = useState('')
  const [highlight, setHighlight] = useState<string[]>([])
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [copyError, setCopyError] = useState('')

  const [deletingCode, setDeletingCode] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState('')
  const { confirm, dialog } = useConfirm()

  useEffect(() => {
    let cancelled = false
    adminApi
      .listInviteCodes({limit: PAGE_SIZE, offset: pageIndex * PAGE_SIZE})
      .then((page) => {
        if (cancelled) return
        setItems(page.items)
        setTotal(page.total)
        setListStatus('ready')
      })
      .catch((err) => {
        if (cancelled) return
        setListError(errorMessage(err))
        setListStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [pageIndex, reloadKey])

  const submitCreate = async (countValue: number, daysValue: number) => {
    setCreating(true)
    try {
      const created = await adminApi.createInviteCodes({
        role,
        count: countValue,
        expires_in_days: daysValue,
      })
      setHighlight(created.map((item) => item.code))
      setNotice(`已创建 ${created.length} 个邀请码，已高亮显示，可直接复制。`)
      setListStatus('loading')
      setListError('')
      setPageIndex(0)
      setReloadKey((key) => key + 1)
    } catch (err) {
      setCreateError(errorMessage(err))
    } finally {
      setCreating(false)
    }
  }

  const handleCreate = (event: FormEvent) => {
    event.preventDefault()
    setCreateError('')
    setNotice('')

    const countValue = Number(count)
    if (!Number.isInteger(countValue) || countValue < 1 || countValue > 50) {
      setCreateError('数量需为 1–50 的整数')
      return
    }
    const daysValue = Number(days)
    if (!Number.isInteger(daysValue) || daysValue < 1 || daysValue > 365) {
      setCreateError('有效天数需为 1–365 的整数')
      return
    }

    if (role === 'admin') {
      confirm({
        title: '生成管理员邀请码',
        description: '该邀请码可创建管理员，确认生成？',
        confirmText: '生成',
        pendingText: '生成中…',
        tone: 'danger',
        onConfirm: () => submitCreate(countValue, daysValue),
      })
      return
    }

    void submitCreate(countValue, daysValue)
  }

  const handleCopy = async (code: string) => {
    setCopyError('')
    try {
      await navigator.clipboard.writeText(code)
      setCopiedCode(code)
    } catch {
      setCopyError('复制失败，请手动选择邀请码复制。')
    }
  }

  const handleDelete = (code: string) => {
    confirm({
      title: '撤销邀请码',
      description: `确认撤销邀请码 ${code}？撤销后不可恢复。`,
      confirmText: '撤销',
      pendingText: '撤销中…',
      tone: 'danger',
      onConfirm: async () => {
        setDeleteError('')
        setDeletingCode(code)
        try {
          await adminApi.deleteInviteCode(code)
          setNotice('邀请码已撤销。')
        } catch (err) {
          setDeleteError(errorMessage(err))
        } finally {
          setDeletingCode(null)
          setListStatus('loading')
          setListError('')
          setReloadKey((key) => key + 1)
        }
      },
    })
  }

  const changePage = (next: number) => {
    setListStatus('loading')
    setListError('')
    setPageIndex(next)
  }

  return (
    <section className="invite-section">
      <div className="admin-card">
        <h2 className="admin-section-title">生成邀请码</h2>
        <form className="invite-form" onSubmit={handleCreate} noValidate>
          <div className="admin-field invite-field">
            <span>角色</span>
            <Select
              value={role}
              onChange={(next) => setRole(next as InviteRole)}
              ariaLabel="邀请码角色"
              options={[
                { value: 'internal', label: '普通用户（internal）' },
                { value: 'admin', label: '管理员（admin）' },
              ]}
            />
          </div>
          <label className="admin-field invite-field">
            <span>数量（1–50）</span>
            <input
              type="number"
              min={1}
              max={50}
              value={count}
              onChange={(event) => setCount(event.target.value)}
            />
          </label>
          <label className="admin-field invite-field">
            <span>有效天数（1–365）</span>
            <input
              type="number"
              min={1}
              max={365}
              value={days}
              onChange={(event) => setDays(event.target.value)}
            />
          </label>
          <button type="submit" className="blog-button admin-submit invite-submit" disabled={creating}>
            {creating ? '生成中…' : '生成'}
          </button>
        </form>
        {createError && <p className="admin-error">{createError}</p>}
        {notice && <p className="admin-notice">{notice}</p>}
      </div>

      <div className="invite-list-head">
        <h2 className="admin-section-title">邀请码列表</h2>
        {listStatus === 'ready' && <span className="invite-total">共 {total} 个</span>}
      </div>

      {listStatus === 'loading' && <div className="admin-card invite-empty">加载中…</div>}

      {listStatus === 'error' && (
        <div className="admin-card invite-empty">
          <p>{listError}</p>
          <button
            type="button"
            className="blog-button"
            onClick={() => {
              setListStatus('loading')
              setListError('')
              setReloadKey((key) => key + 1)
            }}
          >
            重试
          </button>
        </div>
      )}

      {listStatus === 'ready' && items.length === 0 && (
        <div className="admin-card invite-empty">还没有邀请码，使用上方表单生成。</div>
      )}

      {listStatus === 'ready' && items.length > 0 && (
        <ul className="invite-list">
          {items.map((invite) => {
            const status = statusOf(invite)
            const isNew = highlight.includes(invite.code)
            return (
              <li
                key={invite.code}
                className={isNew ? 'invite-item invite-item-new' : 'invite-item'}
              >
                <div className="invite-item-main">
                  <code className="invite-code">{invite.code}</code>
                  <button
                    type="button"
                    className="invite-copy"
                    onClick={() => handleCopy(invite.code)}
                  >
                    {copiedCode === invite.code ? '已复制' : '复制'}
                  </button>
                  <span
                    className={
                      invite.role === 'admin'
                        ? 'invite-badge invite-badge-admin'
                        : 'invite-badge'
                    }
                  >
                    {ROLE_LABEL[invite.role] ?? invite.role}
                  </span>
                  <span className={`invite-status invite-status-${status}`}>
                    {statusLabel(invite)}
                  </span>
                  {status === 'unused' && (
                    <button
                      type="button"
                      className="invite-delete"
                      disabled={deletingCode === invite.code}
                      onClick={() => handleDelete(invite.code)}
                    >
                      {deletingCode === invite.code ? '撤销中…' : '撤销'}
                    </button>
                  )}
                </div>
                <div className="invite-item-meta">
                  <span>
                    有效期：
                    {invite.expires_at ? formatTimestamp(invite.expires_at) : '未设置'}
                  </span>
                  {invite.used_at && <span>使用时间：{formatTimestamp(invite.used_at)}</span>}
                  <span>创建时间：{formatTimestamp(invite.created_at)}</span>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {deleteError && <p className="admin-error">{deleteError}</p>}
      {copyError && <p className="admin-error">{copyError}</p>}

      {listStatus === 'ready' && (
        <div className="invite-pager">
          <button
            type="button"
            className="blog-button"
            disabled={pageIndex === 0}
            onClick={() => changePage(pageIndex - 1)}
          >
            上一页
          </button>
          <span>第 {pageIndex + 1} 页</span>
          <button
            type="button"
            className="blog-button"
            disabled={(pageIndex + 1) * PAGE_SIZE >= total}
            onClick={() => changePage(pageIndex + 1)}
          >
            下一页
          </button>
        </div>
      )}
      {dialog}
    </section>
  )
}
