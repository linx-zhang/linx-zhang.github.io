// 后端 Worker 地址：切换环境只需改这一处
const AUTH_API_BASE = 'https://api-worker.linx-zhang.workers.dev'
const TOKEN_KEY = 'blog_access_token'

export interface AuthUser {
  id: number
  email: string
  role: string
  created_at: string
  /** 服务端下发的权限码列表；/auth/me 返回，登录/注册响应可能暂未带 */
  permissions?: string[]
}

export interface TokenPayload {
  access_token: string
  token_type: string
  expires_at: number
  user: AuthUser
}

/** 后端统一响应结构：{"code", "detail", "data"} */
interface ApiEnvelope<T> {
  code: string
  detail: string
  data: T
}

export interface RegisterPayload {
  email: string
  password: string
  invite_code?: string
}

export interface LoginPayload {
  email: string
  password: string
}

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

  const response = await fetch(`${AUTH_API_BASE}${path}`, { ...init, headers })

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

export const authApi = {
  register(payload: RegisterPayload): Promise<TokenPayload> {
    return request<TokenPayload>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
  login(payload: LoginPayload): Promise<TokenPayload> {
    return request<TokenPayload>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
  me(): Promise<AuthUser> {
    return request<AuthUser>('/auth/me', {}, true)
  },
}
