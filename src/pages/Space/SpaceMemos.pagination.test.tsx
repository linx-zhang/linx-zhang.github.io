import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Memo } from '@/api/memos'

const api = vi.hoisted(() => ({
  list: vi.fn(),
  summary: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}))
const confirmState = vi.hoisted(() => ({
  config: null as null | { onConfirm: () => Promise<void> },
}))

vi.mock('@/api/memos', () => ({ memoApi: api }))
vi.mock('@/components/ConfirmDialog/useConfirm', () => ({
  useConfirm: () => ({
    confirm: (config: { onConfirm: () => Promise<void> }) => {
      confirmState.config = config
    },
    dialog: null,
  }),
}))

import SpaceMemos from './SpaceMemos'

function memo(id: number): Memo {
  return {
    id,
    body: `第 ${id} 条`,
    done: false,
    done_at: null,
    due_at: null,
    created_at: '2026-11-24 00:00:00',
    updated_at: '2026-11-24 00:00:00',
  }
}

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset())
  confirmState.config = null
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockReturnValue({ matches: true }),
  })
  api.summary.mockResolvedValue({ pending: 25, done: 0, due: 0, undated: 25 })
})

describe('SpaceMemos pagination', () => {
  it('25 条时首屏 20 条，加载更多后补到 25 条且不重复', async () => {
    const rows = Array.from({ length: 25 }, (_, index) => memo(index + 1))
    api.list.mockImplementation(async (_query, limit: number, offset: number) => ({
      items: rows.slice(offset, offset + limit),
      has_next: offset + limit < rows.length,
    }))

    const { container } = render(<SpaceMemos userId={1} view="list" />)

    await waitFor(() => expect(container.querySelectorAll('.space-memo')).toHaveLength(20))
    expect(api.list).toHaveBeenCalledWith({}, 20, 0)
    expect(screen.getByRole('button', { name: '加载更多' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '加载更多' }))

    await waitFor(() => expect(container.querySelectorAll('.space-memo')).toHaveLength(25))
    expect(api.list).toHaveBeenLastCalledWith({}, 20, 20)
    expect(screen.queryByRole('button', { name: '加载更多' })).toBeNull()

    const bodies = Array.from(container.querySelectorAll('.space-memo-text')).map(
      (node) => node.textContent,
    )
    expect(new Set(bodies).size).toBe(25)
  })

  it('加载第一页后删掉一条，再加载下一页不应漏条目', async () => {
    let rows = Array.from({ length: 25 }, (_, index) => memo(index + 1))
    api.list.mockImplementation(async (_query, limit: number, offset: number) => ({
      items: rows.slice(offset, offset + limit),
      has_next: offset + limit < rows.length,
    }))
    api.remove.mockImplementation(async (id: number) => {
      rows = rows.filter((row) => row.id !== id)
      return { id }
    })

    const { container } = render(<SpaceMemos userId={1} view="list" />)

    await waitFor(() => expect(container.querySelectorAll('.space-memo')).toHaveLength(20))

    fireEvent.click(screen.getAllByLabelText('删除')[0])
    expect(confirmState.config).not.toBeNull()
    await act(async () => {
      await confirmState.config?.onConfirm()
    })
    await waitFor(() => expect(container.querySelectorAll('.space-memo')).toHaveLength(19))

    fireEvent.click(screen.getByRole('button', { name: '加载更多' }))
    await waitFor(() => expect(container.querySelectorAll('.space-memo')).toHaveLength(24))

    const bodies = Array.from(container.querySelectorAll('.space-memo-text')).map(
      (node) => node.textContent,
    )
    expect(new Set(bodies).size).toBe(24)
  })
})
