import { request } from '@/api/client'

/** 状态全部由服务端按「本地今天 + 周期 + 提前天数」现算，前端只负责翻译成文案 */
export type ConsumableStatus = 'ok' | 'soon' | 'due' | 'unknown' | 'idle'

export type ConsumableCategory = 'paper' | 'clean' | 'food' | 'pet' | 'other'

/** 一轮：started_on 开封、ended_on 用完；ended_on 为空表示还在用 */
export interface ConsumableCycle {
  id: number
  started_on: string
  ended_on: string | null
  expected_days: number | null
  note: string | null
  created_at: string
  updated_at: string
  /** 已结束周期的实际天数；进行中的为 null */
  actual_days: number | null
}

export interface Consumable {
  id: number
  name: string
  category: ConsumableCategory
  unit: string | null
  /** 辅助展示的数量，不参与计算 */
  quantity: number | null
  lead_days: number
  note: string | null
  created_at: string
  updated_at: string
  cycle: ConsumableCycle | null
  days_used: number | null
  days_left: number | null
  due_on: string | null
  progress: number | null
  status: ConsumableStatus
  last_days: number | null
  suggested_days: number | null
}

export interface CreateConsumablePayload {
  name: string
  category?: ConsumableCategory
  unit?: string | null
  quantity?: number | null
  lead_days?: number
  note?: string | null
  /** 本地今天；服务端不猜时区 */
  started_on?: string
  expected_days?: number | null
}

export interface UpdateConsumablePayload {
  name?: string
  category?: ConsumableCategory
  unit?: string | null
  quantity?: number | null
  lead_days?: number
  note?: string | null
}

export interface StartCyclePayload {
  started_on: string
  expected_days?: number | null
  note?: string | null
}

export interface UpdateCyclePayload {
  started_on?: string
  /** null 表示撤回「用完」 */
  ended_on?: string | null
  expected_days?: number | null
  note?: string | null
}

const todayQuery = (today: string) => `?today=${encodeURIComponent(today)}`

export const consumableApi = {
  list(today: string): Promise<{ items: Consumable[] }> {
    return request<{ items: Consumable[] }>(`/consumables${todayQuery(today)}`, {}, true)
  },
  create(payload: CreateConsumablePayload, today: string): Promise<Consumable> {
    return request<Consumable>(
      `/consumables${todayQuery(today)}`,
      { method: 'POST', body: JSON.stringify(payload) },
      true,
    )
  },
  update(id: number, payload: UpdateConsumablePayload, today: string): Promise<Consumable> {
    return request<Consumable>(
      `/consumables/${id}${todayQuery(today)}`,
      { method: 'PATCH', body: JSON.stringify(payload) },
      true,
    )
  },
  remove(id: number): Promise<{ id: number }> {
    return request<{ id: number }>(`/consumables/${id}`, { method: 'DELETE' }, true)
  },
  /** 「用完了」：只关当前这一轮；是否立刻开下一轮由调用方决定 */
  finish(id: number, endedOn: string, today: string): Promise<Consumable> {
    return request<Consumable>(
      `/consumables/${id}/finish${todayQuery(today)}`,
      { method: 'POST', body: JSON.stringify({ ended_on: endedOn }) },
      true,
    )
  },
  startCycle(id: number, payload: StartCyclePayload, today: string): Promise<Consumable> {
    return request<Consumable>(
      `/consumables/${id}/cycles${todayQuery(today)}`,
      { method: 'POST', body: JSON.stringify(payload) },
      true,
    )
  },
  cycles(id: number): Promise<{ items: ConsumableCycle[] }> {
    return request<{ items: ConsumableCycle[] }>(`/consumables/${id}/cycles`, {}, true)
  },
  updateCycle(
    id: number,
    cycleId: number,
    payload: UpdateCyclePayload,
    today: string,
  ): Promise<Consumable> {
    return request<Consumable>(
      `/consumables/${id}/cycles/${cycleId}${todayQuery(today)}`,
      { method: 'PATCH', body: JSON.stringify(payload) },
      true,
    )
  },
}
