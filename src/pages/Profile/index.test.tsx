import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ getCurrent: vi.fn() }))

vi.mock('@/api/resumes', () => ({
  resumeApi: { getCurrent: mocks.getCurrent, getShared: vi.fn() },
}))
vi.mock('react-to-print', () => ({ useReactToPrint: () => vi.fn() }))

import Profile from './index'

function renderProfile() {
  return render(
    <MemoryRouter initialEntries={['/profile']}>
      <Routes>
        <Route path="/profile" element={<Profile />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('Profile', () => {
  it('操作栏挂在简历标题下方，而不是页面最顶端', async () => {
    mocks.getCurrent.mockResolvedValue({
      content_html:
        '<div class="profile-header-bar"><h1>Linx Zhang</h1><p>高级 Python 工程师</p></div>',
      updated_at: '2026-11-23 09:41:00',
    })

    const { container } = renderProfile()
    await screen.findByText('Linx Zhang')

    await waitFor(() => {
      expect(container.querySelector('.profile-header-bar .action-group')).toBeTruthy()
    })
    expect(container.querySelector('.profile-actions-host')).toBeTruthy()
  })
})
