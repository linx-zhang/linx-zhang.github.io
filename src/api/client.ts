// 后端 Worker 地址：切换环境只需改这一处
export const API_BASE = 'https://linx-api-78i.pages.dev'

const TOKEN_KEY = 'blog_access_token'

/** 后端统一响应结构：{"code", "detail", "data"} */
interface ApiEnvelope<T> {
  code: string
  detail: string
  data: T
}

/** 请求失败时抛出的错误：带 HTTP 状态、后端错误码与可展示的 detail */
export class ApiError extends Error {
  status: number
  code: string
  detail: string

  constructor(status: number, code: string, detail: string) {
    super(detail)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.detail = detail
  }
}

export function getStoredToken(): string | null {
  return window.localStorage.getItem(TOKEN_KEY)
}

export function storeToken(token: string): void {
  window.localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  window.localStorage.removeItem(TOKEN_KEY)
}

/** 把后端错误体转成 ApiError：读取 envelope 的 code 与 detail */
function errorFrom(status: number, body: unknown): ApiError {
  if (typeof body === 'object' && body !== null) {
    const { code, detail } = body as { code?: unknown; detail?: unknown }
    if (typeof code === 'string' && typeof detail === 'string') {
      return new ApiError(status, code, detail)
    }
  }
  return new ApiError(status, 'http_error', `请求失败（HTTP ${status}）`)
}

export interface RequestOptions {
  /**
   * 登录/注册这类端点：401 是「这次提交的凭据不对」这一业务结果，不是 token 失效。
   * 不跳过就会清掉本地 token 并广播 auth:unauthorized，登录框被自己的事件关掉，
   * 用户看到的现象是「点登录 → 窗口消失 → 没有任何提示」。
   */
  skipAuthReset?: boolean
}

/** 未登录 / token 失效的唯一出口：清本地 token 并通知 AuthProvider */
function resetAuth(): void {
  clearToken()
  window.dispatchEvent(new Event('auth:unauthorized'))
}

/**
 * 全站唯一的数据传输入口：拼 base、注入 Bearer、解析 envelope、统一抛 ApiError。
 * 各业务模块（auth / blog / admin / memo / clip）只提供类型化的接口函数。
 *
 * 登出只在 401 时发生。403 是「这个账号没有这个权限」，属于业务结果，清掉登录态会让
 * 用户莫名其妙被踢下线（例如在已删除的文章下发评论）。要展示文案就交给 errorMessage。
 */
export async function request<T>(
  path: string,
  init: RequestInit = {},
  withAuth = false,
  options: RequestOptions = {},
): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body) headers.set('Content-Type', 'application/json')
  if (withAuth) {
    const token = getStoredToken()
    if (token) headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(`${API_BASE}${path}`, { ...init, headers })

  if (response.status === 401 && !options.skipAuthReset) resetAuth()

  if (response.status === 204) return undefined as T

  const text = await response.text()
  let body: unknown = null
  if (text) {
    try {
      body = JSON.parse(text)
    } catch {
      throw response.ok
        ? new ApiError(
            response.status,
            'invalid_response',
            '响应不是 JSON，接口地址可能指向了错误的服务',
          )
        : errorFrom(response.status, null)
    }
  }

  if (!response.ok) {
    throw errorFrom(response.status, body)
  }

  const envelope = body as ApiEnvelope<T> | null
  if (!envelope || typeof envelope !== 'object' || !('data' in envelope)) {
    throw new ApiError(response.status, 'invalid_response', '响应缺少 data 字段')
  }
  return envelope.data
}
