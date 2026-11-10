import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/auth/AuthProvider'
import Avatar from '@/components/Avatar'
import { displayName } from '@/components/Avatar/avatarText'
import ProfileDialog from '@/components/ProfileDialog'
import './AuthMenu.css'

export default function AuthMenu() {
  const { user, ready, openLogin, logout, updateUser } = useAuth()
  const [open, setOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
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
            <Avatar user={user} size="md" />
          </button>
          {open && (
            <div className="auth-dropdown" role="menu">
              <p className="auth-row auth-identity" title={user.email}>
                {displayName(user)}
              </p>
              <button
                type="button"
                className="auth-row auth-menu-button"
                role="menuitem"
                onClick={() => {
                  setOpen(false)
                  setProfileOpen(true)
                }}
              >
                个人资料
              </button>
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
          {profileOpen && (
            <ProfileDialog
              user={user}
              onClose={() => setProfileOpen(false)}
              onSaved={updateUser}
            />
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
