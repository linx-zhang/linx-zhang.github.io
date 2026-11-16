import type { ReactNode } from 'react'
import { useAuth } from '@/auth/AuthProvider'
import { usePermission } from '@/auth/usePermission'
import './RequirePermission.css'

/**
 * `permission` 与 `anyOf` 二选一：
 * - `permission`：单个权限码（某个具体分区）
 * - `anyOf`：拥有其中任意一个即可（容器型区域，例如整个管理后台）
 */
type RequirePermissionProps =
  | { permission: string; anyOf?: never; children: ReactNode }
  | { permission?: never; anyOf: readonly string[]; children: ReactNode }

/** 体验层路由守卫；服务端仍会对每个管理请求做权威校验。 */
export default function RequirePermission(props: RequirePermissionProps) {
  const { user, ready, openLogin } = useAuth()
  const { has, hasAny } = usePermission()

  const allowed = props.permission !== undefined
    ? has(props.permission)
    : hasAny(...props.anyOf)

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
          <button type="button" className="guard-button" onClick={() => openLogin()}>
            登录
          </button>
        </div>
      </div>
    )
  }

  if (!allowed) {
    return (
      <div className="guard-page">
        <div className="guard-card guard-guide">
          <h1>需要管理员权限</h1>
          <p>当前账号（{user.email}）没有访问该页面的权限。</p>
        </div>
      </div>
    )
  }

  return props.children
}
