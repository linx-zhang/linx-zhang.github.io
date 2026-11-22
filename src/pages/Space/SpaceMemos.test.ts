import { describe, expect, it, vi } from 'vitest'
import { today, parseDay } from '@/utils/calendar'
import { localDayEndUtc } from '@/utils/format'

const api = vi.hoisted(() => ({ list: vi.fn() }))
vi.mock('@/api/memos', () => ({ memoApi: api }))

import { CALENDAR_UNDATED_PREVIEW, dueMeta, loadCalendarMemos } from './SpaceMemos'

const YEAR = today().slice(0, 4)

function memo(id: number, due_at: string | null = null) {
  return {
    id,
    body: `第 ${id} 条`,
    done: false,
    done_at: null,
    due_at,
    created_at: '2026-01-01 00:00:00',
    updated_at: '2026-01-01 00:00:00',
  }
}

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

  it('月历只取可见窗口的到期条目，未排到期日单独取一页预览', async () => {
    let datedPage = 0
    api.list.mockImplementation(async (query: { undated?: boolean }, _limit: number, offset: number) => {
      if (query.undated) {
        return { items: [memo(900)], has_next: false }
      }
      datedPage += 1
      const items = Array.from({ length: 100 }, (_, index) => memo(offset + index + 1))
      return { items, has_next: datedPage === 1 }
    })

    const range = { from: '2026-11-01 00:00:00', to: '2026-11-30 23:59:59' }
    await expect(loadCalendarMemos(range)).resolves.toHaveLength(201)

    expect(api.list).toHaveBeenNthCalledWith(
      1,
      { dueFrom: range.from, dueTo: range.to },
      100,
      0,
    )
    expect(api.list).toHaveBeenNthCalledWith(
      2,
      { dueFrom: range.from, dueTo: range.to },
      100,
      100,
    )
    expect(api.list).toHaveBeenNthCalledWith(
      3,
      { undated: true },
      CALENDAR_UNDATED_PREVIEW,
      0,
    )
  })
})
