import { request } from '@/api/client'
import { parseServerTimestamp } from '@/utils/format'
import type { Page } from '@/types'

/** 后端 InviteCodeCreateIn.role 仅接受 internal / admin（不是 user） */
export type InviteRole = 'internal' | 'admin'
export type InviteStatus = 'unused' | 'used' | 'expired'

export interface InviteCode {
  code: string
  role: string
  expires_at: string | null
  created_at: string
  used_at: string | null
  /** 生成时填的备注：这个码发给谁 */
  note?: string | null
  /** 使用该码注册的用户邮箱；未使用时为 null */
  used_by_email?: string | null
}

/** 邀请码列表：分页形状 + total */
export type InviteCodePage = Page<InviteCode> & { total: number }

/** 邀请码状态由数据推导：已用 → 已过期 → 未使用。放这里，避免各页面各写一份时间解析 */
export function inviteStatus(invite: InviteCode): InviteStatus {
  if (invite.used_at) return 'used'
  if (!invite.expires_at) return 'unused'
  const expires = parseServerTimestamp(invite.expires_at)
  if (!expires) return 'unused'
  return expires.getTime() <= Date.now() ? 'expired' : 'unused'
}

export interface CreateInvitePayload {
  role: InviteRole
  count: number
  expires_in_days: number
  /** 备注，可选，最多 64 字 */
  note?: string
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
  last_active_at: string | null
  nickname?: string | null
  first_name?: string | null
  last_name?: string | null
  avatar_url?: string | null
}

/** 用户列表：分页形状 + total */
export type AdminUserPage = Page<AdminUser> & { total: number }

export interface UserListParams {
  q?: string
  role?: UserRole
  limit?: number
  offset?: number
}

export interface UpdateUserPayload {
  email?: string
  role?: UserRole
  nickname?: string | null
  first_name?: string | null
  last_name?: string | null
  avatar_url?: string | null
}

/** POST /admin/users/{id}/reset-password：新密码只在此响应出现一次 */
export interface ResetPasswordResult {
  id: number
  email: string
  /** 实际生效的密码：管理员指定值，或后端生成的临时密码 */
  password: string
  /** true 表示 password 由后端生成 */
  generated: boolean
  password_reset_at: string
}

export type ActivityType = 'page_view' | 'heartbeat' | 'page_leave'

export interface ActivityItem {
  id: number
  /** null = 匿名访客（无账号），此时只有 ip 能标识来源 */
  user_id: number | null
  user_email: string | null
  type: string
  path: string
  ts: number
  duration_ms: number | null
  ip: string | null
  country: string | null
  created_at: string
}

export interface AnalyticsToday {
  new_users: number
  active_users: number
  anonymous_visitors: number
  page_views: number
}

export interface AnalyticsDay {
  /** 按 +8 小时分桶后的日期（YYYY-MM-DD） */
  date: string
  page_views: number
  actors: number
}

export interface AnalyticsPath {
  path: string
  views: number
  dwell_ms: number
}

/** 一个身份：已登录用户（u:<id>）或匿名访客（ip:<addr>） */
export interface AnalyticsActor {
  key: string
  user_id: number | null
  user_email: string | null
  ip: string | null
  country: string | null
  region: string | null
  city: string | null
  page_views: number
  /** page_leave 的 duration_ms 之和：观测到的停留，不是挂机时长 */
  dwell_ms: number
  last_seen: string
  first_seen: string
  paths: AnalyticsPath[]
}

export interface AnalyticsSummary {
  days: number
  timezone_offset_hours: number
  today: AnalyticsToday
  series: AnalyticsDay[]
  actors: AnalyticsActor[]
  /** 窗口内身份数超过单页上限 */
  has_next: boolean
}

/** 活跃日志：后端不返回 total（activity_events 是唯一无界表，每次翻页再 COUNT 不值），用 limit+1 探测 */
export type ActivityPage = Page<ActivityItem>

export interface ActivityListParams {
  /** 后端只支持按用户 ID 过滤，邮箱需先解析为 ID */
  user_id?: number
  type?: ActivityType
  /** epoch 毫秒或 ISO 8601 字符串 */
  from?: string
  to?: string
  limit?: number
  offset?: number
}

/** 需要登录的管理端点：统一 withAuth=true */
function adminRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  return request<T>(path, init, true)
}

/** 把可选参数拼成查询串：undefined 不出现，空串会被调用方提前过滤 */
function toSearch(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value))
  }
  const query = search.toString()
  return query ? `?${query}` : ''
}

export const adminApi = {
  listInviteCodes(params: InviteListParams = {}): Promise<InviteCodePage> {
    // 分页默认值只在后端定义（limit 默认 20、上限 100）；这里不传就不发，避免两份默认值漂移
    return adminRequest<InviteCodePage>(
      `/admin/invite-codes${toSearch({
        status: params.status,
        role: params.role,
        limit: params.limit,
        offset: params.offset,
      })}`,
    )
  },
  createInviteCodes(payload: CreateInvitePayload): Promise<InviteCode[]> {
    return adminRequest<InviteCode[]>('/admin/invite-codes', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
  deleteInviteCode(code: string): Promise<{ code: string }> {
    return adminRequest<{ code: string }>(`/admin/invite-codes/${encodeURIComponent(code)}`, {
      method: 'DELETE',
    })
  },
  listUsers(params: UserListParams = {}): Promise<AdminUserPage> {
    return adminRequest<AdminUserPage>(
      `/admin/users${toSearch({
        q: params.q,
        role: params.role,
        limit: params.limit,
        offset: params.offset,
      })}`,
    )
  },
  updateUser(id: number, payload: UpdateUserPayload): Promise<AdminUser> {
    return adminRequest<AdminUser>(`/admin/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  },
  deleteUser(id: number): Promise<unknown> {
    return adminRequest<unknown>(`/admin/users/${id}`, { method: 'DELETE' })
  },
  /** 重置密码：可指定新密码，留空则由后端生成；同时使该用户已登录的会话失效 */
  resetUserPassword(id: number, password?: string): Promise<ResetPasswordResult> {
    return adminRequest<ResetPasswordResult>(`/admin/users/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify(password ? { password } : {}),
    })
  },
  listActivity(params: ActivityListParams = {}): Promise<ActivityPage> {
    return adminRequest<ActivityPage>(
      `/admin/activity${toSearch({
        user_id: params.user_id,
        type: params.type,
        from: params.from,
        to: params.to,
        limit: params.limit,
        offset: params.offset,
      })}`,
    )
  },
  /** 活动分析汇总：今日数字 + 每日趋势 + 每个身份的停留明细（服务端缓存 60 秒） */
  getAnalyticsSummary(days: number): Promise<AnalyticsSummary> {
    return adminRequest<AnalyticsSummary>(`/admin/analytics/summary?days=${days}`)
  },
}
