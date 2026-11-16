import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ApiError,
  API_BASE,
  API_ROOT,
  getStoredToken,
  request,
  storeToken,
} from '@/api/client'

/**
 * 这一组用例守的是「登出只发生在 401」这条线：
 * 403 是业务结果（这个账号没这个权限），清登录态会把用户莫名其妙踢下线。
 */

function jsonResponse(status: number, body: unknown): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    text: async () => JSON.stringify(body),
  } as unknown as Response
}

function rawResponse(status: number, raw: string): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    text: async () => raw,
  } as unknown as Response
}

function envelope(data: unknown, code = 'ok', detail = ''): unknown {
  return { code, detail, data }
}

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('request', () => {
  it('业务路径统一走 /api 前缀', () => {
    // 前端只在 client.ts 里拼一次前缀；后端 app.py 的 API_PREFIX 是另一半。
    expect(API_ROOT).toBe(`${API_BASE}/api`)
  })

  it('拆掉信封，返回 data', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, envelope({ id: 7, title: 't' })))
    await expect(request('/posts/7')).resolves.toEqual({ id: 7, title: 't' })
  })

  it('有 body 时补 Content-Type，withAuth 时带 Bearer', async () => {
    storeToken('tk-123')
    fetchMock.mockResolvedValue(jsonResponse(201, envelope({ id: 1 })))

    await request('/posts', { method: 'POST', body: '{"title":"x"}' }, true)

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(`${API_ROOT}/posts`)
    const headers = init.headers as Headers
    expect(headers.get('Content-Type')).toBe('application/json')
    expect(headers.get('Authorization')).toBe('Bearer tk-123')
  })

  it('无 token 时不带 Authorization', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, envelope([])))
    await request('/posts')

    const headers = (fetchMock.mock.calls[0] as [string, RequestInit])[1].headers as Headers
    expect(headers.get('Authorization')).toBeNull()
  })

  it('204 返回 undefined，不解析 body', async () => {
    fetchMock.mockResolvedValue(rawResponse(204, ''))
    await expect(request('/auth/logout', { method: 'POST' }, true)).resolves.toBeUndefined()
  })

  it('401 清掉本地 token 并广播 auth:unauthorized', async () => {
    storeToken('stale')
    const onUnauthorized = vi.fn()
    window.addEventListener('auth:unauthorized', onUnauthorized)
    fetchMock.mockResolvedValue(
      jsonResponse(401, { code: 'unauthorized', detail: '登录状态已失效' }),
    )

    await expect(request('/memos', {}, true)).rejects.toMatchObject({
      status: 401,
      code: 'unauthorized',
    })

    expect(getStoredToken()).toBeNull()
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
    window.removeEventListener('auth:unauthorized', onUnauthorized)
  })

  it('skipAuthReset 下 401 不清 token（登录失败不是登录态失效）', async () => {
    storeToken('keep-me')
    const onUnauthorized = vi.fn()
    window.addEventListener('auth:unauthorized', onUnauthorized)
    fetchMock.mockResolvedValue(
      jsonResponse(401, { code: 'invalid_credentials', detail: '邮箱或密码错误' }),
    )

    await expect(
      request('/auth/login', { method: 'POST', body: '{}' }, false, { skipAuthReset: true }),
    ).rejects.toBeInstanceOf(ApiError)

    expect(getStoredToken()).toBe('keep-me')
    expect(onUnauthorized).not.toHaveBeenCalled()
    window.removeEventListener('auth:unauthorized', onUnauthorized)
  })

  it('403 不清 token（没权限不等于掉登录）', async () => {
    storeToken('still-valid')
    const onUnauthorized = vi.fn()
    window.addEventListener('auth:unauthorized', onUnauthorized)
    fetchMock.mockResolvedValue(
      jsonResponse(403, { code: 'forbidden', detail: '没有权限执行该操作' }),
    )

    await expect(request('/admin/users', {}, true)).rejects.toMatchObject({
      status: 403,
      code: 'forbidden',
      detail: '没有权限执行该操作',
    })

    expect(getStoredToken()).toBe('still-valid')
    expect(onUnauthorized).not.toHaveBeenCalled()
    window.removeEventListener('auth:unauthorized', onUnauthorized)
  })

  it('2xx 但响应不是 JSON：报 invalid_response', async () => {
    fetchMock.mockResolvedValue(rawResponse(200, '<html>not json</html>'))
    await expect(request('/posts')).rejects.toMatchObject({ code: 'invalid_response' })
  })

  it('非 2xx 且响应不是 JSON：退回 http_error', async () => {
    fetchMock.mockResolvedValue(rawResponse(502, 'Bad Gateway'))
    await expect(request('/posts')).rejects.toMatchObject({
      status: 502,
      code: 'http_error',
    })
  })

  it('信封缺 data 字段：报 invalid_response', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { code: 'ok', detail: '' }))
    await expect(request('/posts')).rejects.toMatchObject({ code: 'invalid_response' })
  })
})
