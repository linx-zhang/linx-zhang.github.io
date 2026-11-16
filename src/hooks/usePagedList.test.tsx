import { describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { usePagedList } from '@/hooks/usePagedList'
import { ApiError } from '@/api/client'
import { PAGE_SIZE } from '@/constants'
import type { Page } from '@/types'

/** 造一批可识别的条目，用于断言「替换」而不是「追加」 */
function pageOf(prefix: string, count: number): Page<{ id: string }> {
  return {
    items: Array.from({ length: count }, (_, i) => ({ id: `${prefix}-${i}` })),
    has_next: false,
  }
}

describe('usePagedList', () => {
  it('首屏取第一页并进入 ready', async () => {
    const fetcher = vi.fn(async () => pageOf('p1', 2))
    const { result } = renderHook(() => usePagedList(fetcher))

    expect(result.current.status).toBe('loading')
    await waitFor(() => expect(result.current.status).toBe('ready'))

    expect(fetcher).toHaveBeenCalledWith(PAGE_SIZE, 0)
    expect(result.current.items.map((it) => it.id)).toEqual(['p1-0', 'p1-1'])
    expect(result.current.pageIndex).toBe(0)
  })

  it('换页按 PAGE_SIZE 换算 offset', async () => {
    const fetcher = vi.fn(async (_limit: number, offset: number) =>
      pageOf(offset === 0 ? 'p1' : 'p2', 2),
    )
    const { result } = renderHook(() => usePagedList(fetcher))
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => result.current.goToPage(1))
    await waitFor(() => expect(result.current.pageIndex).toBe(1))
    await waitFor(() => expect(result.current.status).toBe('ready'))

    expect(fetcher).toHaveBeenLastCalledWith(PAGE_SIZE, PAGE_SIZE)
    // 关键：整页替换，不是把第 1 页追加到第 0 页后面
    expect(result.current.items.map((it) => it.id)).toEqual(['p2-0', 'p2-1'])
  })

  it('同页 reload 会真的重新取（靠 reloadKey 而不是页码）', async () => {
    let round = 0
    const fetcher = vi.fn(async () => {
      round += 1
      return pageOf(`round${round}`, 1)
    })
    const { result } = renderHook(() => usePagedList(fetcher))
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => result.current.reload())
    await waitFor(() => expect(result.current.items[0]?.id).toBe('round2-0'))
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('reset 清空数据并回到第 0 页', async () => {
    const fetcher = vi.fn(async (_limit: number, offset: number) =>
      pageOf(offset === 0 ? 'p1' : 'p2', 1),
    )
    const { result } = renderHook(() => usePagedList(fetcher))
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => result.current.goToPage(1))
    await waitFor(() => expect(result.current.pageIndex).toBe(1))

    act(() => result.current.reset())
    expect(result.current.items).toEqual([])
    await waitFor(() => expect(result.current.pageIndex).toBe(0))
    await waitFor(() => expect(result.current.items.map((it) => it.id)).toEqual(['p1-0']))
  })

  it('受控页码：goToPage 只通知调用方，自己不动页码', async () => {
    const fetcher = vi.fn(async () => pageOf('p1', 1))
    const onPageChange = vi.fn()
    const { result } = renderHook(() =>
      usePagedList(fetcher, { page: 0, onPageChange }),
    )
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => result.current.goToPage(2))
    expect(onPageChange).toHaveBeenCalledWith(2)
    expect(result.current.pageIndex).toBe(0)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('treat404AsMissing：404 记为 missing 而不是 error', async () => {
    const fetcher = vi.fn(async () => {
      throw new ApiError(404, 'not_found', '不存在')
    })
    const { result } = renderHook(() => usePagedList(fetcher, { treat404AsMissing: true }))

    await waitFor(() => expect(result.current.status).toBe('missing'))
    expect(result.current.error).toBe('')
  })

  it('普通失败进 error，并带上可展示文案', async () => {
    const fetcher = vi.fn(async () => {
      throw new ApiError(500, 'internal_error', '炸了')
    })
    const { result } = renderHook(() => usePagedList(fetcher))

    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.error).toBe('服务暂时不可用，请稍后重试。')
  })

  it('deps 变化触发重取', async () => {
    const fetcher = vi.fn(async () => pageOf('p1', 1))
    const { rerender } = renderHook(
      ({ q }: { q: string }) => usePagedList(fetcher, { deps: [q] }),
      { initialProps: { q: 'a' } },
    )
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1))

    rerender({ q: 'b' })
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2))
  })
})
