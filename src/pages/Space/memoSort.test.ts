import { describe, expect, it } from 'vitest'
import { sortMemos } from './memoSort'
import type { Memo } from '@/api/memos'

function memo(over: Partial<Memo> & { id: number }): Memo {
  return {
    body: `memo-${over.id}`,
    done: false,
    done_at: null,
    due_at: null,
    created_at: '2026-01-01 00:00:00',
    updated_at: '2026-01-01 00:00:00',
    ...over,
  }
}

describe('sortMemos', () => {
  it('待办：有到期日按到期升序，无到期日排后面并按创建倒序', () => {
    const rows = [
      memo({ id: 1, created_at: '2026-01-01 00:00:00' }),
      memo({ id: 2, created_at: '2026-01-03 00:00:00', due_at: '2026-02-10 15:59:59' }),
      memo({ id: 3, created_at: '2026-01-02 00:00:00', due_at: '2026-02-01 15:59:59' }),
      memo({ id: 4, created_at: '2026-01-04 00:00:00' }),
    ]
    expect(sortMemos(rows, false).map((m) => m.id)).toEqual([3, 2, 4, 1])
  })

  it('待办：到期日相同按创建倒序，创建也相同按 id 倒序', () => {
    const rows = [
      memo({ id: 1, created_at: '2026-01-01 00:00:00', due_at: '2026-02-01 15:59:59' }),
      memo({ id: 2, created_at: '2026-01-02 00:00:00', due_at: '2026-02-01 15:59:59' }),
      memo({ id: 3, created_at: '2026-01-02 00:00:00', due_at: '2026-02-01 15:59:59' }),
    ]
    expect(sortMemos(rows, false).map((m) => m.id)).toEqual([3, 2, 1])
  })

  it('已完成：按完成时间倒序，未完成的（done_at 为空）排最后', () => {
    const rows = [
      memo({ id: 1, done: true, done_at: '2026-02-01 00:00:00' }),
      memo({ id: 2, done: true, done_at: '2026-02-03 00:00:00' }),
      memo({ id: 3, done: false }),
    ]
    expect(sortMemos(rows, true).map((m) => m.id)).toEqual([2, 1, 3])
  })

  it('不修改原数组', () => {
    const rows = [memo({ id: 1 }), memo({ id: 2, due_at: '2026-02-01 15:59:59' })]
    const before = rows.map((m) => m.id)
    sortMemos(rows, false)
    expect(rows.map((m) => m.id)).toEqual(before)
  })
})
