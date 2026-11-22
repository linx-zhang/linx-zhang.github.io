import { describe, expect, it, vi } from 'vitest'
import { today, parseDay } from '@/utils/calendar'
import { localDayEndUtc } from '@/utils/format'

const api = vi.hoisted(() => ({ list: vi.fn() }))
vi.mock('@/api/memos', () => ({ memoApi: api }))

import { dueMeta, loadAllMemos } from './SpaceMemos'

const YEAR = today().slice(0, 4)

describe('memo dueMeta', () => {
  it('同年到期沿用月日短格式', () => {
    expect(dueMeta(localDayEndUtc(`${YEAR}-12-31`))).toEqual({
      text: '12-31 到期',
      tone: 'later',
    })
  })

  it('跨年到期带上年份', () => {
    expect(dueMeta(localDayEndUtc(`${Number(YEAR) + 1}-01-05`))).toEqual({
      text: `${Number(YEAR) + 1}-01-05 到期`,
      tone: 'later',
    })
  })

  it('上一年的逾期条目不会被误读成本年', () => {
    const past = parseDay(`${Number(YEAR) - 1}-12-01`)
    const day = `${past.getFullYear()}-12-01`
    expect(dueMeta(localDayEndUtc(day)).text).toBe(`${day} 已过期`)
  })

  it('月历取数超过 5 页时不截断', async () => {
    api.list.mockImplementation(async (_done: unknown, _limit: number, offset: number) => {
      const items = Array.from({ length: 100 }, (_, index) => ({
        id: offset + index + 1,
        body: `第 ${offset + index + 1} 条`,
        done: false,
        done_at: null,
        due_at: null,
        created_at: '2026-01-01 00:00:00',
        updated_at: '2026-01-01 00:00:00',
      }))
      return { items, has_next: offset + 100 < 600 }
    })

    await expect(loadAllMemos()).resolves.toHaveLength(600)
    expect(api.list).toHaveBeenCalledTimes(6)
  })
})
