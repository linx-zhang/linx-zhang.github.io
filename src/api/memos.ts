import { request } from '@/api/client'

export interface Memo {
  id: number
  body: string
  done: boolean
  /** 最近一次完成的时间；取消勾选时后端会清空它 */
  done_at: string | null
  /** 到期日，本地日期 YYYY-MM-DD；只用于展示与标红，不做提醒 */
  due_at: string | null
  created_at: string
  updated_at: string
}

/** 与全站一致的分页形状：服务端多取一条判断 has_next */
export interface MemoPage {
  items: Memo[]
  has_next: boolean
}

/** 个人空间的计数，单独一个接口，列表里不带 total */
export interface MemoSummary {
  pending: number
  done: number
  /** 未完成且到期日不晚于今天（含逾期） */
  due: number
}

export interface CreateMemoPayload {
  body: string
  due_at?: string | null
}

export interface UpdateMemoPayload {
  body?: string
  done?: boolean
  due_at?: string | null
}

export const memoApi = {
  list(done: boolean | undefined, limit: number, offset: number): Promise<MemoPage> {
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    })
    if (done !== undefined) params.set('done', String(done))
    return request<MemoPage>(`/memos?${params.toString()}`, {}, true)
  },
  summary(): Promise<MemoSummary> {
    return request<MemoSummary>('/memos/summary', {}, true)
  },
  create(payload: CreateMemoPayload): Promise<Memo> {
    return request<Memo>('/memos', { method: 'POST', body: JSON.stringify(payload) }, true)
  },
  update(id: number, payload: UpdateMemoPayload): Promise<Memo> {
    return request<Memo>(
      `/memos/${id}`,
      { method: 'PATCH', body: JSON.stringify(payload) },
      true,
    )
  },
  remove(id: number): Promise<{ id: number }> {
    return request<{ id: number }>(`/memos/${id}`, { method: 'DELETE' }, true)
  },
}
