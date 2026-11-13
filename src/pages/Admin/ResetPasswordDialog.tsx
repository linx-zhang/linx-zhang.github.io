import { useEffect, useRef, useState } from 'react'
import { ApiError } from '@/api/client'
import { adminApi } from '@/api/admin'
import type { AdminUser, ResetPasswordResult } from '@/api/admin'
import Modal from '@/components/Modal'
import { copyText } from '@/utils/clipboard'

export interface ResetPasswordDialogProps {
  user: AdminUser
  /** 重置自己时当前会话也会失效，弹窗里要额外提醒 */
  isSelf: boolean
  onClose: () => void
}

function resetErrorText(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'invalid_password') return '密码长度需为 8–128 个字符。'
    if (err.code === 'not_found') return '该用户不存在或已被删除。'
    if (err.status >= 500) return '服务暂时不可用，请稍后重试。'
    if (err.code === 'forbidden') return err.detail || '没有权限执行该操作。'
    return err.detail
  }
  return '网络请求失败，请检查连接后重试。'
}

/** 管理员重置密码：可手动指定新密码，留空则由后端生成一次性临时密码 */
export default function ResetPasswordDialog({
  user,
  isSelf,
  onClose,
}: ResetPasswordDialogProps) {
  const [password, setPassword] = useState('')
  const [result, setResult] = useState<ResetPasswordResult | null>(null)
  const [pending, setPending] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const passwordRef = useRef<HTMLInputElement>(null)

  // 密码出现后直接选中，按 Ctrl+C 也能复制
  useEffect(() => {
    if (result) passwordRef.current?.select()
  }, [result])

  const submit = async () => {
    if (pending) return
    if (password && (password.length < 8 || password.length > 128)) {
      setError('密码长度需为 8–128 个字符')
      return
    }
    setPending(true)
    setError('')
    try {
      setResult(await adminApi.resetUserPassword(user.id, password || undefined))
    } catch (err) {
      setError(resetErrorText(err))
    } finally {
      setPending(false)
    }
  }

  const copy = async () => {
    if (!result) return
    const field = passwordRef.current
    const ok = await copyText(result.password)
    if (ok) {
      setCopied(true)
      setError('')
    } else {
      field?.focus()
      field?.select()
      setError('自动复制失败，已选中密码，请手动复制。')
    }
  }

  const hintText = result
    ? result.generated
      ? `只显示这一次，关闭弹窗后无法再次查看。请通过可信渠道把临时密码发给 ${result.email}，并要求对方登录后立即修改。该账号原有登录会话已失效。`
      : `已按你指定的密码重置，请把新密码交给 ${result.email}。该账号原有登录会话已失效。`
    : ''

  return (
    <Modal
      title={result ? (result.generated ? '临时密码已生成' : '密码已重置') : '重置密码'}
      busy={pending}
      width={460}
      onClose={onClose}
      footer={
        <div className="modal-footer-end">
          {result ? (
            <button type="button" className="blog-button comment-submit" onClick={onClose}>
              完成
            </button>
          ) : (
            <>
              <button type="button" className="blog-button" disabled={pending} onClick={onClose}>
                取消
              </button>
              <button
                type="button"
                className="blog-button comment-submit"
                disabled={pending}
                onClick={submit}
              >
                {pending ? '重置中…' : '确认重置'}
              </button>
            </>
          )}
        </div>
      }
    >
      {result ? (
        <div className="reset-password-result">
          <p className="modal-section-title">{result.generated ? '临时密码' : '新密码'}</p>
          <div className="reset-password-row">
            <input
              ref={passwordRef}
              className="reset-password-value"
              type="text"
              readOnly
              value={result.password}
              aria-label={result.generated ? '临时密码' : '新密码'}
              onFocus={(event) => event.currentTarget.select()}
            />
            <button
              type="button"
              className="reset-password-copy"
              onClick={copy}
            >
              {copied ? '已复制' : '复制'}
            </button>
          </div>
          <p className="reset-password-hint">{hintText}</p>
          {error && <p className="modal-error">{error}</p>}
        </div>
      ) : (
        <div className="reset-password-confirm">
          <p className="modal-section-title">
            {`将重置 ${user.email} 的密码`}
          </p>
          <label className="modal-field">
            <span>新密码（可选）</span>
            <input
              type="password"
              value={password}
              disabled={pending}
              autoComplete="new-password"
              placeholder="8–128 个字符"
              onChange={(event) => {
                setPassword(event.target.value)
                setError('')
              }}
            />
            <span className="modal-field-note">留空则由系统生成 16 位临时密码</span>
          </label>
          <ul className="reset-password-hint-list">
            <li>
              {password
                ? '将使用你手动指定的新密码。'
                : '留空时由系统生成 16 位一次性临时密码。'}
            </li>
            <li>原密码立即失效，该账号已登录的会话也会失效，需要重新登录。</li>
            {isSelf && (
              <li className="reset-password-self">
                你正在重置自己的密码，提交后当前登录会退出，请先确认能保存新密码。
              </li>
            )}
          </ul>
          {error && <p className="modal-error">{error}</p>}
        </div>
      )}
    </Modal>
  )
}
