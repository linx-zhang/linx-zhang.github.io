import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'

vi.mock('@/auth/usePermission', () => ({ usePermission: () => ({ has: () => true }) }))
vi.mock('@/components/RequirePermission', () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}))
vi.mock('./UsersTab', () => ({ default: () => <div>用户内容</div> }))
vi.mock('./PostsTab', () => ({ default: () => <div>文章内容</div> }))
vi.mock('./ActivityTab', () => ({ default: () => <div>日志内容</div> }))
vi.mock('./AnalyticsTab', () => ({ default: () => <div>分析内容</div> }))
vi.mock('./InvitesTab', () => ({ default: () => <div>邀请码内容</div> }))

import Admin from './index'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('Admin', () => {
  it('从用户页进入邀请码后渲染邀请码分区，且不把它塞进 tab 条', () => {
    renderAt('/admin?tab=invites')

    expect(screen.getByText('邀请码内容')).toBeTruthy()
    expect(screen.queryByRole('tab', { name: '邀请码' })).toBeNull()
    expect(screen.getByRole('button', { name: /返回用户管理/ })).toBeTruthy()
  })

  it('未知分区回落到第一个可访问分区', () => {
    renderAt('/admin?tab=nope')

    expect(screen.getByText('用户内容')).toBeTruthy()
    expect(screen.getByRole('tab', { name: '用户' }).getAttribute('aria-selected')).toBe('true')
  })
})
