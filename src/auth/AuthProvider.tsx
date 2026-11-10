import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import AuthModal from '@/components/AuthModal'
import { authApi, clearToken, getStoredToken, storeToken } from '@/api/auth'
import type { AuthUser } from '@/api/auth'

interface AuthContextValue {
  user: AuthUser | null
  /** 当前账号的权限码；未登录或后端未下发时为空数组 */
  permissions: string[]
  ready: boolean
  openLogin: () => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used within AuthProvider')
  return value
}

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [ready, setReady] = useState(() => !getStoredToken())
  const [loginOpen, setLoginOpen] = useState(false)

  useEffect(() => {
    if (!getStoredToken()) return
    let cancelled = false
    authApi
      .me()
      .then((current) => {
        if (!cancelled) setUser(current)
      })
      .catch(() => {
        // token 无效时 request 层已清除 token 并广播 auth:unauthorized
      })
      .finally(() => {
        if (!cancelled) setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const onUnauthorized = () => {
      setUser(null)
      setLoginOpen(false)
    }
    window.addEventListener('auth:unauthorized', onUnauthorized)
    return () => window.removeEventListener('auth:unauthorized', onUnauthorized)
  }, [])

  const handleSuccess = (nextUser: AuthUser, token: string) => {
    storeToken(token)
    setUser(nextUser)
    setReady(true)
    setLoginOpen(false)
    // 登录/注册响应里的 user 不含 permissions，补拉 /auth/me 以拿到权限码
    authApi
      .me()
      .then((current) => setUser(current))
      .catch(() => {
        // 权限拉取失败不影响已登录状态，页面按无权限处理
      })
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        permissions: user?.permissions ?? [],
        ready,
        openLogin: () => setLoginOpen(true),
        logout: () => {
          clearToken()
          setUser(null)
        },
      }}
    >
      {children}
      {loginOpen && (
        <AuthModal
          initialMode="login"
          onClose={() => setLoginOpen(false)}
          onSuccess={handleSuccess}
        />
      )}
    </AuthContext.Provider>
  )
}
