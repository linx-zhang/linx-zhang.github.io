import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { ApiError, authApi } from '@/api/auth'
import type { AuthUser, LoginPayload } from '@/api/auth'
import './AuthModal.css'

type Mode = 'login' | 'register'

interface AuthModalProps {
  initialMode: Mode
  onClose: () => void
  onSuccess: (user: AuthUser, token: string) => void
}

function describeError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return '邮箱或密码错误'
    if (err.code === 'email_exists') return '该邮箱已注册'
    if (err.code === 'invalid_invite_code') return '邀请码无效、已过期或已被使用'
    if (err.status === 422) return `参数校验失败：${err.message}`
    return err.message
  }
  if (err instanceof TypeError) return '无法连接后端（可能被 CORS 或网络拦截）'
  return err instanceof Error ? err.message : '请求失败'
}

export default function AuthModal({ initialMode, onClose, onSuccess }: AuthModalProps) {
  const [mode, setMode] = useState<Mode>(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')

    const trimmedEmail = email.trim()
    if (!trimmedEmail) {
      setError('请输入邮箱')
      return
    }
    if (mode === 'register' && (password.length < 8 || password.length > 128)) {
      setError('密码长度需为 8–128 个字符')
      return
    }
    if (mode === 'login' && !password) {
      setError('请输入密码')
      return
    }

    setSubmitting(true)
    try {
      const payload: LoginPayload = { email: trimmedEmail, password }
      const result =
        mode === 'login'
          ? await authApi.login(payload)
          : await authApi.register({
              ...payload,
              ...(inviteCode.trim() ? { invite_code: inviteCode.trim() } : {}),
            })
      onSuccess(result.user, result.access_token)
    } catch (err) {
      setError(describeError(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="auth-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="auth-modal" role="dialog" aria-modal="true" aria-label="登录或注册">
        <button type="button" className="auth-close" onClick={onClose} aria-label="关闭">
          ×
        </button>

        <div className="auth-tabs">
          <button
            type="button"
            className={mode === 'login' ? 'auth-tab active' : 'auth-tab'}
            onClick={() => {
              setMode('login')
              setError('')
            }}
          >
            登录
          </button>
          <button
            type="button"
            className={mode === 'register' ? 'auth-tab active' : 'auth-tab'}
            onClick={() => {
              setMode('register')
              setError('')
            }}
          >
            注册
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="auth-field">
            <span>邮箱</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              placeholder="you@example.com"
              required
            />
          </label>

          <label className="auth-field">
            <span>密码</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              placeholder={mode === 'register' ? '8–128 个字符' : '输入密码'}
              required
            />
          </label>

          {mode === 'register' && (
            <label className="auth-field">
              <span>邀请码（可选）</span>
              <input
                type="text"
                value={inviteCode}
                onChange={(event) => setInviteCode(event.target.value)}
                placeholder="没有可留空"
              />
            </label>
          )}

          {error && <p className="auth-error">{error}</p>}

          <button type="submit" className="auth-submit" disabled={submitting}>
            {submitting ? '提交中…' : mode === 'login' ? '登录' : '注册'}
          </button>
        </form>

        <p className="auth-switch">
          {mode === 'login' ? '还没有账号？' : '已有账号？'}
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login')
              setError('')
            }}
          >
            {mode === 'login' ? '注册' : '去登录'}
          </button>
        </p>
      </div>
    </div>
  )
}
