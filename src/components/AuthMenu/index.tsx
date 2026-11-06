import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/auth/AuthProvider'
import './AuthMenu.css'

export default function AuthMenu() {
  const { user, ready, openLogin, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  if (!ready) {
    return <span className="auth-loading" aria-hidden="true" />
  }

  return (
    <div className="auth-menu" ref={menuRef}>
      {user ? (
        <>
          <button
            type="button"
            className="auth-avatar"
            aria-label="账号菜单"
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            {user.email.charAt(0).toUpperCase()}
          </button>
          {open && (
            <div className="auth-dropdown" role="menu">
              <p className="auth-row auth-email" title={user.email}>
                {user.email}
              </p>
              <button
                type="button"
                className="auth-row auth-menu-button"
                role="menuitem"
                onClick={() => {
                  setOpen(false)
                  logout()
                }}
              >
                退出登录
              </button>
            </div>
          )}
        </>
      ) : (
        <button type="button" className="auth-login" onClick={openLogin}>
          登录
        </button>
      )}
    </div>
  )
}
