import { describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useResource } from '@/hooks/useResource'
import { ApiError } from '@/api/client'

describe('useResource', () => {
  it('取到数据后进入 ready', async () => {
    const loader = vi.fn(async () => ({ title: 'hello' }))
    const { result } = renderHook(() => useResource(loader, []))

    expect(result.current.status).toBe('loading')
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.data).toEqual({ title: 'hello' })
    expect(result.current.error).toBe('')
  })

  it('404 视为 missing（详情页的「不存在」）', async () => {
    const loader = vi.fn(async () => {
      throw new ApiError(404, 'not_found', '不存在')
    })
    const { result } = renderHook(() => useResource(loader, [], { treat404AsMissing: true }))

    await waitFor(() => expect(result.current.status).toBe('missing'))
    expect(result.current.data).toBeNull()
    // missing 不是出错：错误文案保持为空，页面不该弹重试
    expect(result.current.error).toBe('')
  })

  it('silent：失败也不进 error（可选区块不打断页面）', async () => {
    const loader = vi.fn(async () => {
      throw new ApiError(403, 'forbidden', '没有权限')
    })
    const { result } = renderHook(() => useResource(loader, [], { silent: true }))

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.data).toBeNull()
    expect(result.current.error).toBe('')
  })

  it('失败进 error，5xx 用统一兜底文案', async () => {
    const loader = vi.fn(async () => {
      throw new ApiError(503, 'db_error', '数据库炸了')
    })
    const { result } = renderHook(() => useResource(loader, []))

    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.error).toBe('服务暂时不可用，请稍后重试。')
  })

  it('403 保留后端 detail，说明缺什么权限', async () => {
    const loader = vi.fn(async () => {
      throw new ApiError(403, 'forbidden', '需要 user:read:any')
    })
    const { result } = renderHook(() => useResource(loader, []))

    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.error).toBe('需要 user:read:any')
  })

  it('enabled=false 不发请求，状态停在 ready', async () => {
    const loader = vi.fn(async () => ({ ok: true }))
    const { result } = renderHook(() => useResource(loader, [], { enabled: false }))

    expect(loader).not.toHaveBeenCalled()
    expect(result.current.status).toBe('ready')
    expect(result.current.data).toBeNull()
  })

  it('deps 变化重新取', async () => {
    const loader = vi.fn(async () => ({ ok: true }))
    const { rerender } = renderHook(
      ({ id }: { id: number }) => useResource(loader, [id]),
      { initialProps: { id: 1 } },
    )
    await waitFor(() => expect(loader).toHaveBeenCalledTimes(1))

    rerender({ id: 2 })
    await waitFor(() => expect(loader).toHaveBeenCalledTimes(2))
  })

  it('reload 强制重取当前资源', async () => {
    let round = 0
    const loader = vi.fn(async () => {
      round += 1
      return { round }
    })
    const { result } = renderHook(() => useResource(loader, []))
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => result.current.reload())
    await waitFor(() => expect(result.current.data).toEqual({ round: 2 }))
  })

  it('setData 就地替换数据（保存后用服务端返回值对齐）', async () => {
    const loader = vi.fn(async () => ({ title: 'old' }))
    const { result } = renderHook(() => useResource(loader, []))
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => result.current.setData({ title: 'new' }))
    expect(result.current.data).toEqual({ title: 'new' })
  })
})
