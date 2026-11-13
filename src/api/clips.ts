import { request } from '@/api/client'

/** 一条共享剪切板；read 是公开的，code 本身就是访问凭证 */
export interface ClipShare {
  code: string
  title: string
  body: string
  created_at: string
  expires_at: string
}

export interface CreateClipPayload {
  title?: string
  body: string
}

export const clipApi = {
  create(payload: CreateClipPayload): Promise<ClipShare> {
    return request<ClipShare>(
      '/clips',
      { method: 'POST', body: JSON.stringify(payload) },
      true,
    )
  },
  read(code: string): Promise<ClipShare> {
    return request<ClipShare>(`/clips/${encodeURIComponent(code)}`)
  },
  revoke(code: string): Promise<{ code: string }> {
    return request<{ code: string }>(
      `/clips/${encodeURIComponent(code)}`,
      { method: 'DELETE' },
      true,
    )
  },
}
