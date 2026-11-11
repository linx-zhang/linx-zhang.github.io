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
  /** 管理接口的 403 应展示后端 detail，而不是直接清空登录态 */
  skipForbiddenLogout?: boolean
}

/**
 * 全站唯一的数据传输入口：拼 base、注入 Bearer、解析 envelope、统一抛 ApiError。
 * 各业务模块（auth / blog / admin）只提供类型化的接口函数。
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

  if (response.status === 401 || (response.status === 403 && !options.skipForbiddenLogout)) {
    clearToken()
    window.dispatchEvent(new Event('auth:unauthorized'))
  }

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
