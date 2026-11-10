import type { ReactNode } from 'react'
import { useAuth } from '@/auth/AuthProvider'
import { usePermission } from '@/auth/usePermission'
import './RequirePermission.css'

interface RequirePermissionProps {
  /** 进入该区域所需的权限码 */
  permission: string
  children: ReactNode
}

/** 体验层路由守卫；服务端仍会对每个管理请求做权威校验。 */
export default function RequirePermission({ permission, children }: RequirePermissionProps) {
  const { user, ready, openLogin } = useAuth()
  const { has } = usePermission()

  if (!ready) {
    return (
      <div className="guard-page">
        <div className="guard-card">加载中…</div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="guard-page">
        <div className="guard-card guard-guide">
          <h1>需要登录</h1>
          <p>登录管理员账号后即可进入管理后台。</p>
          <button type="button" className="guard-button" onClick={openLogin}>
            登录
          </button>
        </div>
      </div>
    )
  }

  if (!has(permission)) {
    return (
      <div className="guard-page">
        <div className="guard-card guard-guide">
          <h1>需要管理员权限</h1>
          <p>当前账号（{user.email}）没有访问该页面的权限。</p>
        </div>
      </div>
    )
  }

  return children
}
