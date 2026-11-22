import { describe, expect, it } from 'vitest'
import type { Consumable } from '@/api/consumables'
import { today } from '@/utils/calendar'
import { dueLabel, shortDay } from './consumableFormat'

const YEAR = today().slice(0, 4)

function withDue(dueOn: string, daysLeft: number): Consumable {
  return { due_on: dueOn, days_left: daysLeft } as Consumable
}

describe('consumableFormat', () => {
  it('同年到期只显示月日', () => {
    expect(dueLabel(withDue(`${YEAR}-12-31`, 39))).toBe('12 月 31 日见底')
  })

  it('跨年到期带上年份，避免把明年看成今年', () => {
    expect(dueLabel(withDue(`${Number(YEAR) + 1}-01-05`, 409))).toBe(
      `${Number(YEAR) + 1} 年 1 月 5 日见底`,
    )
  })

  it('周期历史跨年时保留年份', () => {
    expect(shortDay(`${YEAR}-11-22`)).toBe('11/22')
    expect(shortDay(`${Number(YEAR) - 1}-12-01`)).toBe(`${Number(YEAR) - 1}/12/01`)
  })
})
