import { describe, expect, it } from 'vitest'
import { buildCron, describeCron, formatRunTime, nextRuns, parseCron } from './cron'

describe('Cron 解析', () => {
  it('解析 5 段和默认全天', () => {
    const spec = parseCron('0 9 * * *')
    expect(spec.minute).toEqual([0])
    expect(spec.hour).toEqual([9])
    expect(spec.dayOfMonth).toHaveLength(31)
    expect(spec.dayOfWeek).toHaveLength(7)
  })

  it('支持步进、区间和列表', () => {
    expect(parseCron('*/15 8-18/2 * * *').minute).toEqual([0, 15, 30, 45])
    expect(parseCron('0 9 * * MON-FRI').dayOfWeek).toEqual([1, 2, 3, 4, 5])
    expect(parseCron('0,30 9 1,15 * *').minute).toEqual([0, 30])
    expect(parseCron('0 9 * * MON-FRI').fields).toEqual(['0', '9', '*', '*', 'MON-FRI'])
  })

  it('支持宏', () => {
    expect(parseCron('@daily').expression).toBe('@daily')
    expect(parseCron('@daily').fields).toEqual(['0', '0', '*', '*', '*'])
    expect(parseCron('@daily').hour).toEqual([0])
  })

  it('非法表达式逐项报错', () => {
    expect(() => parseCron('0 9 * *')).toThrow(/5 段/)
    expect(() => parseCron('99 9 * * *')).toThrow(/分钟/)
    expect(() => parseCron('*/0 * * * *')).toThrow(/步进/)
    expect(() => parseCron('0 9 * * MON-XYZ')).toThrow()
  })
})

describe('Cron 描述与下次执行', () => {
  const from = new Date(2026, 0, 1, 8, 0, 0)

  it('每天 09:00 的下一次是当天 09:00', () => {
    const runs = nextRuns(parseCron('0 9 * * *'), { from, count: 2 })
    expect(formatRunTime(runs[0])).toBe('2026-01-01 09:00 周四')
    expect(formatRunTime(runs[1])).toBe('2026-01-02 09:00 周五')
  })

  it('每 15 分钟从下一分钟开始', () => {
    const runs = nextRuns(parseCron('*/15 * * * *'), { from, count: 2 })
    expect(formatRunTime(runs[0])).toBe('2026-01-01 08:15 周四')
    expect(formatRunTime(runs[1])).toBe('2026-01-01 08:30 周四')
  })

  it('日和周都受限时按「或」匹配', () => {
    const runs = nextRuns(parseCron('0 0 13 * 5'), { from, count: 2 })
    expect(formatRunTime(runs[0])).toBe('2026-01-02 00:00 周五')
    expect(formatRunTime(runs[1])).toBe('2026-01-09 00:00 周五')
  })

  it('常见形状有人话描述', () => {
    expect(describeCron(parseCron('0 9 * * *'))).toBe('每天 09:00 执行')
    expect(describeCron(parseCron('*/15 * * * *'))).toBe('每 15 分钟执行一次')
    expect(describeCron(parseCron('0 9 * * 1-5'))).toMatch(/周一/)
  })
})

describe('Cron 生成', () => {
  it('按频率生成 5 段表达式', () => {
    expect(
      buildCron({ frequency: 'daily', interval: 1, minute: 30, hour: 9, weekday: 1, dayOfMonth: 1 }),
    ).toBe('30 9 * * *')
    expect(
      buildCron({ frequency: 'weekly', interval: 1, minute: 0, hour: 9, weekday: 1, dayOfMonth: 1 }),
    ).toBe('0 9 * * 1')
    expect(
      buildCron({ frequency: 'monthly', interval: 1, minute: 0, hour: 0, weekday: 1, dayOfMonth: 15 }),
    ).toBe('0 0 15 * *')
    expect(
      buildCron({ frequency: 'minutes', interval: 5, minute: 0, hour: 0, weekday: 1, dayOfMonth: 1 }),
    ).toBe('*/5 * * * *')
    expect(
      buildCron({ frequency: 'hours', interval: 1, minute: 0, hour: 0, weekday: 1, dayOfMonth: 1 }),
    ).toBe('0 * * * *')
  })

  it('越界参数会报错', () => {
    expect(() =>
      buildCron({ frequency: 'daily', interval: 1, minute: 60, hour: 9, weekday: 1, dayOfMonth: 1 }),
    ).toThrow(/分钟/)
    expect(() =>
      buildCron({ frequency: 'weekly', interval: 1, minute: 0, hour: 9, weekday: 7, dayOfMonth: 1 }),
    ).toThrow(/星期/)
  })
})
