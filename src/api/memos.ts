import { request } from '@/api/client'
import type { Page } from '@/types'

export interface Memo {
  id: number
  body: string
  done: boolean
  /** 最近一次完成的时间；取消勾选时后端会清空它 */
  done_at: string | null
  /** 到期时刻，UTC datetime（本地当天 23:59:59 换算而来）；只用于展示与标红，不做提醒 */
  due_at: string | null
  created_at: string
  updated_at: string
}

/** 与全站一致的分页形状：服务端多取一条判断 has_next */
export type MemoPage = Page<Memo>

/** 列表/月历共用的筛选条件；日期都是服务端 UTC datetime 串 */
export interface MemoListQuery {
  done?: boolean
  dueFrom?: string
  dueTo?: string
  undated?: boolean
}

/** 个人空间的计数，单独一个接口，列表里不带 total */
export interface MemoSummary {
  pending: number
  done: number
  /** 未完成且到期时刻已到（含逾期） */
  due: number
  /** 没有到期日的条数；月历只预览其中前若干条 */
  undated: number
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
  list(query: MemoListQuery, limit: number, offset: number): Promise<MemoPage> {
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    })
    if (query.done !== undefined) params.set('done', String(query.done))
    if (query.dueFrom) params.set('due_from', query.dueFrom)
    if (query.dueTo) params.set('due_to', query.dueTo)
    if (query.undated) params.set('undated', 'true')
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
