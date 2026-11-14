import { useState } from 'react'
import type { FormEvent } from 'react'
import { errorMessage } from '@/api/errors'
import { adminApi } from '@/api/admin'
import type { AdminUser, UpdateUserPayload } from '@/api/admin'
import Modal from '@/components/Modal'

export interface UserEditDialogProps {
  user: AdminUser
  onClose: () => void
  onSaved: (user: AdminUser) => void
}

function trimValue(value: string): string {
  return value.trim()
}

/** 编辑用户资料与邮箱，保存时只提交改动过的字段；角色与删除在行内操作 */
export default function UserEditDialog({
  user,
  onClose,
  onSaved,
}: UserEditDialogProps) {
  const [nickname, setNickname] = useState(user.nickname ?? '')
  const [firstName, setFirstName] = useState(user.first_name ?? '')
  const [lastName, setLastName] = useState(user.last_name ?? '')
  const [avatarUrl, setAvatarUrl] = useState(user.avatar_url ?? '')
  const [email, setEmail] = useState(user.email)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const buildPatch = (): UpdateUserPayload => {
    const patch: UpdateUserPayload = {}

    const nextEmail = email.trim()
    if (nextEmail !== user.email) patch.email = nextEmail

    const nextProfile = {
      nickname: trimValue(nickname),
      first_name: trimValue(firstName),
      last_name: trimValue(lastName),
      avatar_url: trimValue(avatarUrl),
    }
    const initialProfile = {
      nickname: (user.nickname ?? '').trim(),
      first_name: (user.first_name ?? '').trim(),
      last_name: (user.last_name ?? '').trim(),
      avatar_url: (user.avatar_url ?? '').trim(),
    }
    for (const key of ['nickname', 'first_name', 'last_name', 'avatar_url'] as const) {
      if (nextProfile[key] !== initialProfile[key]) patch[key] = nextProfile[key]
    }

    return patch
  }

  const patch = buildPatch()
  const hasChanges = Object.keys(patch).length > 0

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (saving || !hasChanges) return
    if (patch.email !== undefined && patch.email.length === 0) {
      setError('邮箱不能为空')
      return
    }
    setSaving(true)
    setError('')
    try {
      const updated = await adminApi.updateUser(user.id, patch)
      onSaved(updated)
      onClose()
    } catch (err) {
      setError(errorMessage(err))
      setSaving(false)
    }
  }

  return (
    <Modal
      title="编辑用户"
      busy={saving}
      width={480}
      onClose={onClose}
      footer={
        <div className="modal-footer-end">
          <button type="button" className="blog-button" disabled={saving} onClick={onClose}>
            取消
          </button>
          <button
            type="submit"
            form="user-edit-form"
            className="blog-button comment-submit"
            disabled={saving || !hasChanges}
          >
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      }
    >
      <form id="user-edit-form" className="modal-form" onSubmit={submit}>
        <p className="modal-section-title">资料</p>
        <label className="modal-field">
          <span>昵称</span>
          <input
            type="text"
            value={nickname}
            disabled={saving}
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

        <p className="modal-section-title">账号</p>
        <label className="modal-field">
          <span>邮箱</span>
          <input
            type="email"
            value={email}
            disabled={saving}
            onChange={(event) => {
              setEmail(event.target.value)
              setError('')
            }}
          />
        </label>

        {error && <p className="modal-error">{error}</p>}
      </form>
    </Modal>
  )
}
