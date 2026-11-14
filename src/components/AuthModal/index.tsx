import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { authErrorMessage } from '@/api/errors'
import { authApi } from '@/api/auth'
import type { AuthUser, LoginPayload } from '@/api/auth'
import DialogShell from '@/components/DialogShell'
import './AuthModal.css'

type Mode = 'login' | 'register'

interface AuthModalProps {
  initialMode: Mode
  onClose: () => void
  onSuccess: (user: AuthUser, token: string) => void
}

interface FieldErrors {
  email?: string
  password?: string
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function AuthModal({ initialMode, onClose, onSuccess }: AuthModalProps) {
  const [mode, setMode] = useState<Mode>(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)

  const switchMode = (next: Mode) => {
    setMode(next)
    setFieldErrors({})
    setError('')
  }

  /** 自己校验：不用 required / type=email 的原生气泡，错误文案和样式都归我们控制 */
  const validate = (): FieldErrors => {
    const errors: FieldErrors = {}
    const trimmedEmail = email.trim()

    if (!trimmedEmail) errors.email = '请输入邮箱'
    else if (!EMAIL_PATTERN.test(trimmedEmail)) errors.email = '邮箱格式不正确'

    if (!password) errors.password = '请输入密码'
    else if (mode === 'register' && (password.length < 8 || password.length > 128))
      errors.password = '密码长度需为 8–128 个字符'

    return errors
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')

    const errors = validate()
    setFieldErrors(errors)
    if (errors.email) {
      emailRef.current?.focus()
      return
    }
    if (errors.password) {
      passwordRef.current?.focus()
      return
    }

    setSubmitting(true)
    try {
      const payload: LoginPayload = { email: email.trim(), password }
      const result =
        mode === 'login'
          ? await authApi.login(payload)
          : await authApi.register({
              ...payload,
              ...(inviteCode.trim() ? { invite_code: inviteCode.trim() } : {}),
            })
      onSuccess(result.user, result.access_token)
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <DialogShell
      overlayClassName="auth-overlay"
      cardClassName="auth-modal"
      ariaLabel="登录或注册"
      onClose={onClose}
      blocking={submitting}
      initialFocusSelector=".auth-tab"
    >
      {() => (
        <>
          <button type="button" className="auth-close" onClick={onClose} aria-label="关闭">
            ×
          </button>

          <div className="auth-tabs">
            <button
              type="button"
              className={mode === 'login' ? 'auth-tab active' : 'auth-tab'}
              onClick={() => switchMode('login')}
            >
              登录
            </button>
            <button
              type="button"
              className={mode === 'register' ? 'auth-tab active' : 'auth-tab'}
              onClick={() => switchMode('register')}
            >
              注册
            </button>
          </div>

          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            <div className="auth-field">
              <label htmlFor="auth-email">邮箱</label>
              <input
                id="auth-email"
                ref={emailRef}
                type="email"
                inputMode="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value)
                  setFieldErrors((prev) => ({ ...prev, email: undefined }))
                  setError('')
                }}
                autoComplete="email"
                placeholder="you@example.com"
                aria-invalid={Boolean(fieldErrors.email)}
                aria-describedby={fieldErrors.email ? 'auth-email-error' : undefined}
                className={fieldErrors.email ? 'invalid' : undefined}
              />
              {fieldErrors.email && (
                <span className="auth-field-error" id="auth-email-error">
                  {fieldErrors.email}
                </span>
              )}
            </div>

            <div className="auth-field">
              <label htmlFor="auth-password">密码</label>
              <input
                id="auth-password"
                ref={passwordRef}
                type="password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value)
                  setFieldErrors((prev) => ({ ...prev, password: undefined }))
                  setError('')
                }}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                placeholder={mode === 'register' ? '8–128 个字符' : '输入密码'}
                aria-invalid={Boolean(fieldErrors.password)}
                aria-describedby={fieldErrors.password ? 'auth-password-error' : undefined}
                className={fieldErrors.password ? 'invalid' : undefined}
              />
              {fieldErrors.password && (
                <span className="auth-field-error" id="auth-password-error">
                  {fieldErrors.password}
                </span>
              )}
            </div>

            {mode === 'register' && (
              <div className="auth-field">
                <label htmlFor="auth-invite">邀请码（可选）</label>
                <input
                  id="auth-invite"
                  type="text"
                  value={inviteCode}
                  onChange={(event) => setInviteCode(event.target.value)}
                  placeholder="没有可留空"
                />
              </div>
            )}

            {error && (
              <p className="auth-error" role="alert">
                {error}
              </p>
            )}

            <button type="submit" className="auth-submit" disabled={submitting}>
              {submitting ? '提交中…' : mode === 'login' ? '登录' : '注册'}
            </button>
          </form>

          <p className="auth-switch">
            {mode === 'login' ? '还没有账号？' : '已有账号？'}
            <button type="button" onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}>
              {mode === 'login' ? '注册' : '去登录'}
            </button>
          </p>
        </>
      )}
    </DialogShell>
  )
}
