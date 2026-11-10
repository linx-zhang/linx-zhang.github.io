import { request } from '@/api/auth'

/** 后端 InviteCodeCreateIn.role 仅接受 internal / admin（不是 user） */
export type InviteRole = 'internal' | 'admin'
export type InviteStatus = 'unused' | 'used' | 'expired'

export interface InviteCode {
  code: string
  role: string
  expires_at: string | null
  created_at: string
  used_at: string | null
}

export interface InviteCodePage {
  items: InviteCode[]
  total: number
}

export interface CreateInvitePayload {
  role: InviteRole
  count: number
  expires_in_days: number
}

export interface InviteListParams {
  status?: InviteStatus
  role?: InviteRole
  limit?: number
  offset?: number
}

/** 用户管理：角色取值范围 user / internal / admin */
export type UserRole = 'user' | 'internal' | 'admin'

export interface AdminUser {
  id: number
  email: string
  role: string
  created_at: string
}

export interface AdminUserPage {
  items: AdminUser[]
  total: number
}

export interface UserListParams {
  q?: string
  role?: UserRole
  limit?: number
  offset?: number
}

export const adminApi = {
  listInviteCodes(params: InviteListParams = {}): Promise<InviteCodePage> {
    const search = new URLSearchParams()
    if (params.status) search.set('status', params.status)
    if (params.role) search.set('role', params.role)
    search.set('limit', String(params.limit ?? 20))
    search.set('offset', String(params.offset ?? 0))
    return request<InviteCodePage>(`/admin/invite-codes?${search.toString()}`, {}, true, {
      skipForbiddenLogout: true,
    })
  },
  createInviteCodes(payload: CreateInvitePayload): Promise<InviteCode[]> {
    return request<InviteCode[]>('/admin/invite-codes', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, true, { skipForbiddenLogout: true })
  },
  deleteInviteCode(code: string): Promise<{ code: string }> {
    return request<{ code: string }>(
      `/admin/invite-codes/${encodeURIComponent(code)}`,
      { method: 'DELETE' },
      true,
      { skipForbiddenLogout: true },
    )
  },
  listUsers(params: UserListParams = {}): Promise<AdminUserPage> {
    const search = new URLSearchParams()
    if (params.q) search.set('q', params.q)
    if (params.role) search.set('role', params.role)
    search.set('limit', String(params.limit ?? 20))
    search.set('offset', String(params.offset ?? 0))
    return request<AdminUserPage>(`/admin/users?${search.toString()}`, {}, true, {
      skipForbiddenLogout: true,
    })
  },
  updateUserRole(id: number, role: UserRole): Promise<AdminUser> {
    return request<AdminUser>(
      `/admin/users/${id}/role`,
      { method: 'PATCH', body: JSON.stringify({ role }) },
      true,
      { skipForbiddenLogout: true },
    )
  },
}
