import { request } from '@/api/client'
import type { Page } from '@/types'

/** 管理员列表行：不含正文，正文只在详情里取 */
export interface ResumeRow {
  id: number
  title: string
  note: string
  is_default: boolean
  created_at: string
  updated_at: string
}

/** 管理端详情：多出 content_html */
export interface ResumeDetail extends ResumeRow {
  content_html: string
}

/** 公开读（默认简历 / 分享链接）只给渲染最小形状 */
export interface ResumePublic {
  title: string
  content_html: string
  updated_at: string
}

export interface ResumeShare {
  code: string
  expires_at: string
  created_at: string
}

export interface ResumePayload {
  title: string
  note: string
  content_html: string
}

/** 分享链接落在前端短链路由，真正数据仍走 API */
export function resumeShareUrl(code: string): string {
  return `${window.location.origin}/r/${code}`
}

function adminRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  return request<T>(path, init, true)
}

export const resumeApi = {
  /** `/profile` 默认加载；404 时由页面回退到内置模板 */
  getCurrent(): Promise<ResumePublic> {
    return request<ResumePublic>('/resumes/current')
  },
  /** `/r/<code>` 加载；404 表示过期 / 撤销 / 简历已删 */
  getShared(code: string): Promise<ResumePublic> {
    return request<ResumePublic>(`/resumes/shared/${encodeURIComponent(code)}`)
  },
  list(limit: number, offset: number): Promise<Page<ResumeRow> & { total: number }> {
    return adminRequest<Page<ResumeRow> & { total: number }>(
      `/resumes?limit=${limit}&offset=${offset}`,
    )
  },
  get(id: number): Promise<ResumeDetail> {
    return adminRequest<ResumeDetail>(`/resumes/${id}`)
  },
  create(payload: ResumePayload): Promise<ResumeDetail> {
    return adminRequest<ResumeDetail>('/resumes', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
  update(id: number, payload: Partial<ResumePayload>): Promise<ResumeDetail> {
    return adminRequest<ResumeDetail>(`/resumes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  },
  remove(id: number): Promise<{ id: number }> {
    return adminRequest<{ id: number }>(`/resumes/${id}`, { method: 'DELETE' })
  },
  copy(id: number): Promise<ResumeDetail> {
    return adminRequest<ResumeDetail>(`/resumes/${id}/copy`, { method: 'POST' })
  },
  setDefault(id: number): Promise<ResumeRow> {
    return adminRequest<ResumeRow>(`/resumes/${id}/default`, { method: 'POST' })
  },
  createShare(id: number, expiresInMinutes: number): Promise<ResumeShare> {
    return adminRequest<ResumeShare>(`/resumes/${id}/shares`, {
      method: 'POST',
      body: JSON.stringify({ expires_in_minutes: expiresInMinutes }),
    })
  },
  listShares(id: number): Promise<ResumeShare[]> {
    return adminRequest<ResumeShare[]>(`/resumes/${id}/shares`)
  },
  revokeShare(code: string): Promise<{ code: string }> {
    return adminRequest<{ code: string }>(`/resumes/shares/${encodeURIComponent(code)}`, {
      method: 'DELETE',
    })
  },
}
