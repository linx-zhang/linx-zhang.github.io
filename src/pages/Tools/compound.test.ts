import { describe, expect, it } from 'vitest'
import { compactMoney, formatMoney, monthlyRate, simulate } from './compound'

const base = {
  principal: 0,
  monthly: 0,
  annualRate: 0,
  years: 1,
  timing: 'end' as const,
}

describe('复利定投', () => {
  it('0% 收益时终值等于累计投入', () => {
    const result = simulate({ ...base, principal: 10_000, monthly: 1_000, years: 1 })
    expect(result.final).toBeCloseTo(22_000, 6)
    expect(result.contributed).toBe(22_000)
    expect(result.growth).toBeCloseTo(0, 6)
    expect(result.multiple).toBeCloseTo(1, 6)
  })

  it('本金按年化收益增长', () => {
    const result = simulate({ ...base, principal: 10_000, annualRate: 10, years: 1 })
    expect(result.final).toBeCloseTo(11_000, 6)
    expect(result.growth).toBeCloseTo(1_000, 6)
  })

  it('年初定投比年末多赚一个月利息', () => {
    const begin = simulate({ ...base, monthly: 1_000, annualRate: 6, timing: 'begin' })
    const end = simulate({ ...base, monthly: 1_000, annualRate: 6, timing: 'end' })
    expect(begin.final).toBeGreaterThan(end.final)
  })

  it('负收益也能计算', () => {
    const result = simulate({ ...base, principal: 10_000, annualRate: -10, years: 1 })
    expect(result.final).toBeCloseTo(9_000, 6)
    expect(result.growth).toBeLessThan(0)
  })

  it('月利率按年有效收益折算', () => {
    expect(monthlyRate(12.6825)).toBeCloseTo(0.01, 6)
  })

  it('参数越界会报错', () => {
    expect(() => simulate({ ...base, monthly: -1 })).toThrow(/每月定投/)
    expect(() => simulate({ ...base, years: 0 })).toThrow(/定投年限/)
    expect(() => simulate({ ...base, years: 1.5 })).toThrow(/整数/)
    expect(() => simulate({ ...base, annualRate: -100 })).toThrow(/年化收益/)
  })

  it('金额格式', () => {
    expect(formatMoney(1234567)).toBe('1,234,567')
    expect(compactMoney(12_000)).toBe('1.2 万')
    expect(compactMoney(150_000_000)).toBe('1.5 亿')
  })
})
