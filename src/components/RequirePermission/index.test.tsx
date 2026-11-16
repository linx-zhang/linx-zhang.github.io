import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

/**
 * 守的是「整个后台按任一管理权限进入」这条判据：
 * 绑在单个分区码上时，只有别的分区权限的账号会连入口都看不到。
 */
const authState = { user: { email: 'a@b.c' } as { email: string } | null, ready: true }
let permissions: string[] = []

vi.mock('@/auth/AuthProvider', () => ({
  useAuth: () => ({
    user: authState.user,
    ready: authState.ready,
    openLogin: vi.fn(),
  }),
}))

vi.mock('@/auth/usePermission', () => ({
  usePermission: () => ({
    permissions,
    has: (code: string) => permissions.includes(code),
    hasAny: (...codes: string[]) => codes.some((code) => permissions.includes(code)),
  }),
}))

import RequirePermission from '@/components/RequirePermission'
import { ADMIN_AREA_PERMISSIONS } from '@/auth/adminAccess'

beforeEach(() => {
  authState.user = { email: 'a@b.c' }
  authState.ready = true
  permissions = []
})

describe('RequirePermission', () => {
  it('anyOf：拥有其中任意一个就放行', () => {
    permissions = ['user:read:any']
    render(
      <RequirePermission anyOf={ADMIN_AREA_PERMISSIONS}>
        <div>后台内容</div>
      </RequirePermission>,
    )
    expect(screen.getByText('后台内容')).toBeTruthy()
  })

  it('anyOf：一个都没有时给出无权限页', () => {
    permissions = ['comment:create:any']
    render(
      <RequirePermission anyOf={ADMIN_AREA_PERMISSIONS}>
        <div>后台内容</div>
      </RequirePermission>,
    )
    expect(screen.queryByText('后台内容')).toBeNull()
    expect(screen.getByText('需要管理员权限')).toBeTruthy()
  })

  it('permission 单码仍然按单码判断', () => {
    permissions = ['user:read:any']
    render(
      <RequirePermission permission="invite_code:read:any">
        <div>邀请码</div>
      </RequirePermission>,
    )
    expect(screen.queryByText('邀请码')).toBeNull()
  })

  it('未登录时提示登录，不显示无权限文案', () => {
    authState.user = null
    permissions = ['user:read:any']
    render(
      <RequirePermission anyOf={ADMIN_AREA_PERMISSIONS}>
        <div>后台内容</div>
      </RequirePermission>,
    )
    expect(screen.getByText('需要登录')).toBeTruthy()
  })

  it('登录态未就绪时显示加载中', () => {
    authState.ready = false
    render(
      <RequirePermission anyOf={ADMIN_AREA_PERMISSIONS}>
        <div>后台内容</div>
      </RequirePermission>,
    )
    expect(screen.getByText('加载中…')).toBeTruthy()
  })
})
