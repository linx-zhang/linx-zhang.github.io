import { describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useInfiniteList } from '@/hooks/useInfiniteList'
import { PAGE_SIZE } from '@/constants'
import type { Page } from '@/types'

/**
 * 这组用例守的是「追加」与「刷新」两条路不能串：
 * 混用会让同一页数据在列表里出现两遍（个人空间曾经就是这个现象）。
 */
function pageOf(prefix: string, count: number, hasNext = false): Page<{ id: string }> {
  return {
    items: Array.from({ length: count }, (_, i) => ({ id: `${prefix}-${i}` })),
    has_next: hasNext,
  }
}

describe('useInfiniteList', () => {
  it('首屏取第一页并进入 ready', async () => {
    const fetcher = vi.fn(async () => pageOf('p1', 2, true))
    const { result } = renderHook(() => useInfiniteList(fetcher))

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(fetcher).toHaveBeenCalledWith(PAGE_SIZE, 0)
    expect(result.current.items.map((it) => it.id)).toEqual(['p1-0', 'p1-1'])
    expect(result.current.hasNext).toBe(true)
  })

  it('loadMore 追加下一页，不重复首屏', async () => {
    const fetcher = vi.fn(async (_limit: number, offset: number) =>
      pageOf(offset === 0 ? 'p1' : 'p2', 2, offset === 0),
    )
    const { result } = renderHook(() => useInfiniteList(fetcher))
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => result.current.loadMore())
    await waitFor(() => expect(result.current.pageIndex).toBe(1))
    await waitFor(() => expect(result.current.items).toHaveLength(4))

    expect(fetcher).toHaveBeenLastCalledWith(PAGE_SIZE, PAGE_SIZE)
    expect(result.current.items.map((it) => it.id)).toEqual([
      'p1-0',
      'p1-1',
      'p2-0',
      'p2-1',
    ])
  })

  it('reload 清空并回到第 0 页，不会把同一页再追加一遍', async () => {
    const fetcher = vi.fn(async (_limit: number, offset: number) =>
      pageOf(offset === 0 ? 'p1' : 'p2', 2, offset === 0),
    )
    const { result } = renderHook(() => useInfiniteList(fetcher))
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => result.current.loadMore())
    await waitFor(() => expect(result.current.items).toHaveLength(4))

    act(() => result.current.reload())
    await waitFor(() => expect(result.current.pageIndex).toBe(0))
    await waitFor(() => expect(result.current.status).toBe('ready'))

    expect(result.current.items.map((it) => it.id)).toEqual(['p1-0', 'p1-1'])
  })

  it('reload 后再 loadMore 仍然是追加而不是覆盖', async () => {
    const fetcher = vi.fn(async (_limit: number, offset: number) =>
      pageOf(offset === 0 ? 'p1' : 'p2', 1, offset === 0),
    )
    const { result } = renderHook(() => useInfiniteList(fetcher))
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => result.current.reload())
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => result.current.loadMore())
    await waitFor(() => expect(result.current.items).toHaveLength(2))
    expect(result.current.items.map((it) => it.id)).toEqual(['p1-0', 'p2-0'])
  })

  it('enabled=false 不发请求，也不停在 loading', async () => {
    const fetcher = vi.fn(async () => pageOf('p1', 1))
    const { result } = renderHook(() => useInfiniteList(fetcher, { enabled: false }))

    expect(fetcher).not.toHaveBeenCalled()
    expect(result.current.status).toBe('loading')
  })

  it('失败进 error 且带文案', async () => {
    const fetcher = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    const { result } = renderHook(() => useInfiniteList(fetcher))

    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.error).toBe('网络请求失败，请检查连接后重试。')
  })
})
