import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import AuthModal from '@/components/AuthModal'
import { authApi } from '@/api/auth'
import { clearToken, getStoredToken, storeToken } from '@/api/client'
import type { AuthUser } from '@/api/auth'

interface AuthContextValue {
  user: AuthUser | null
  /** 当前账号的权限码；未登录或后端未下发时为空数组 */
  permissions: string[]
  ready: boolean
  /** 打开登录弹窗；传 afterSuccess 时登录成功后再执行该动作（例如自动展开写文章表单） */
  openLogin: (afterSuccess?: () => void) => void
  logout: () => void
  /** 资料保存后用返回值替换当前用户，顶栏立即刷新 */
  updateUser: (next: AuthUser) => void
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
  // 登录成功后要补做的动作，弹窗关闭时清空，避免下次登录时误触发
  const afterLoginRef = useRef<(() => void) | null>(null)

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
      afterLoginRef.current = null
    }
    window.addEventListener('auth:unauthorized', onUnauthorized)
    return () => window.removeEventListener('auth:unauthorized', onUnauthorized)
  }, [])

  const handleSuccess = (nextUser: AuthUser, token: string) => {
    storeToken(token)
    setUser(nextUser)
    setReady(true)
    setLoginOpen(false)
    const afterLogin = afterLoginRef.current
    afterLoginRef.current = null
    if (typeof afterLogin === 'function') afterLogin()
    // 登录/注册响应不含 permissions（资料字段已包含），补拉 /auth/me 以拿到权限码
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
        openLogin: (afterSuccess?: () => void) => {
          afterLoginRef.current = afterSuccess ?? null
          setLoginOpen(true)
        },
        logout: () => {
          // 先让服务端作废已签发的 token（失败也不影响本地退出），再清本地状态
          void authApi.logout().catch(() => {})
          clearToken()
          setUser(null)
        },
        updateUser: (next: AuthUser) => setUser(next),
      }}
    >
      {children}
      {loginOpen && (
        <AuthModal
          initialMode="login"
          onClose={() => {
            afterLoginRef.current = null
            setLoginOpen(false)
          }}
          onSuccess={handleSuccess}
        />
      )}
    </AuthContext.Provider>
  )
}
