import { useState } from 'react'
import type { FormEvent } from 'react'
import { ApiError, authApi } from '@/api/auth'
import type { AuthUser } from '@/api/auth'
import Modal from '@/components/Modal'

export interface ProfileDialogProps {
  user: AuthUser
  onClose: () => void
  onSaved: (user: AuthUser) => void
}

function profileErrorText(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status >= 500) return '服务暂时不可用，请稍后重试。'
    if (err.status === 422) return err.detail || '提交的内容不符合要求，请检查后重试。'
    return err.detail
  }
  return '网络请求失败，请检查连接后重试。'
}

export default function ProfileDialog({ user, onClose, onSaved }: ProfileDialogProps) {
  const [nickname, setNickname] = useState(user.nickname ?? '')
  const [firstName, setFirstName] = useState(user.first_name ?? '')
  const [lastName, setLastName] = useState(user.last_name ?? '')
  const [avatarUrl, setAvatarUrl] = useState(user.avatar_url ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const initial = {
    nickname: (user.nickname ?? '').trim(),
    firstName: (user.first_name ?? '').trim(),
    lastName: (user.last_name ?? '').trim(),
    avatarUrl: (user.avatar_url ?? '').trim(),
  }
  const hasChanges =
    nickname.trim() !== initial.nickname ||
    firstName.trim() !== initial.firstName ||
    lastName.trim() !== initial.lastName ||
    avatarUrl.trim() !== initial.avatarUrl

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (saving || !hasChanges) return
    setSaving(true)
    setError('')
    try {
      // 空字符串是后端认可的清空操作；只提交四个资料字段，email/role 会被 extra="forbid" 拒绝
      const updated = await authApi.updateMyProfile({
        nickname: nickname.trim(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        avatar_url: avatarUrl.trim(),
      })
      onSaved(updated)
      onClose()
    } catch (err) {
      setError(profileErrorText(err))
      setSaving(false)
    }
  }

  return (
    <Modal
      title="个人资料"
      busy={saving}
      onClose={onClose}
      footer={
        <>
          <div className="modal-footer-end">
            <button type="button" className="blog-button" disabled={saving} onClick={onClose}>
              取消
            </button>
            <button
              type="submit"
              form="profile-form"
              className="blog-button comment-submit"
              disabled={saving || !hasChanges}
            >
              {saving ? '保存中…' : '保存'}
            </button>
          </div>
        </>
      }
    >
      <form id="profile-form" className="modal-form" onSubmit={submit}>
        <label className="modal-field">
          <span>邮箱</span>
          <input type="email" value={user.email} disabled readOnly />
          <span className="modal-field-note">账号标识，不可在此修改</span>
        </label>
        <label className="modal-field">
          <span>昵称</span>
          <input
            type="text"
            value={nickname}
            disabled={saving}
            placeholder="留空则使用姓名或邮箱"
            onChange={(event) => {
              setNickname(event.target.value)
              setError('')
            }}
          />
        </label>
        <label className="modal-field">
          <span>名</span>
          <input
            type="text"
            value={firstName}
            disabled={saving}
            onChange={(event) => {
              setFirstName(event.target.value)
              setError('')
            }}
          />
        </label>
        <label className="modal-field">
          <span>姓</span>
          <input
            type="text"
            value={lastName}
            disabled={saving}
            onChange={(event) => {
              setLastName(event.target.value)
              setError('')
            }}
          />
        </label>
        <label className="modal-field">
          <span>头像地址</span>
          <input
            type="url"
            value={avatarUrl}
            disabled={saving}
            placeholder="https://…"
            onChange={(event) => {
              setAvatarUrl(event.target.value)
              setError('')
            }}
          />
        </label>
        {error && <p className="modal-error">{error}</p>}
      </form>
    </Modal>
  )
}
