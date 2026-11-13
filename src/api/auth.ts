import { request } from '@/api/client'

export interface AuthUser {
  id: number
  email: string
  role: string
  created_at: string
  /** 昵称；未设置为 null */
  nickname?: string | null
  /** 名 */
  first_name?: string | null
  /** 姓 */
  last_name?: string | null
  /** 头像图片地址 */
  avatar_url?: string | null
  /** 服务端下发的权限码列表；/auth/me 返回，登录/注册响应可能暂未带 */
  permissions?: string[]
}

/** PATCH /auth/me 可提交的字段（邮箱、角色不可在此修改） */
export interface UpdateProfilePayload {
  nickname?: string | null
  first_name?: string | null
  last_name?: string | null
  avatar_url?: string | null
}

export interface TokenPayload {
  access_token: string
  token_type: string
  expires_at: number
  user: AuthUser
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

export const authApi = {
  register(payload: RegisterPayload): Promise<TokenPayload> {
    return request<TokenPayload>(
      '/auth/register',
      { method: 'POST', body: JSON.stringify(payload) },
      false,
      { skipAuthReset: true },
    )
  },
  login(payload: LoginPayload): Promise<TokenPayload> {
    return request<TokenPayload>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify(payload) },
      false,
      { skipAuthReset: true },
    )
  },
  me(): Promise<AuthUser> {
    return request<AuthUser>('/auth/me', {}, true)
  },
  /** 退出登录：让服务端立刻作废这个账号已签发的 token */
  logout(): Promise<{ id: number }> {
    return request<{ id: number }>('/auth/logout', { method: 'POST' }, true, {
      skipForbiddenLogout: true,
    })
  },
  /** 更新自己的资料：返回完整用户对象（含 permissions） */
  updateMyProfile(payload: UpdateProfilePayload): Promise<AuthUser> {
    return request<AuthUser>(
      '/auth/me',
      { method: 'PATCH', body: JSON.stringify(payload) },
      true,
      { skipForbiddenLogout: true },
    )
  },
}
