import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import AuthModal from '@/components/AuthModal'
import { authApi, clearToken, getStoredToken, storeToken } from '@/api/auth'
import type { AuthUser } from '@/api/auth'

interface AuthContextValue {
  user: AuthUser | null
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
  }

  return (
    <AuthContext.Provider
      value={{
        user,
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
