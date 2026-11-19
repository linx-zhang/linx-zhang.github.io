import { describe, expect, it } from 'vitest'
import { cellLabel, dayExtrasLabel, describeDay, describeDetail, holidayLabel, holidayOf, holidayRun, holidayTag, nextSpecial } from './lunar'

/**
 * 固定日期断言：节日/节气/农历换算各一条，防止换库或升级后静默漂。
 * 日期都取自 lunar-javascript 1.7.8 实测结果，改动实现时要重新核对。
 */
describe('describeDay', () => {
  it('春节：正月初一 + 春节', () => {
    expect(describeDay('2026-02-17')).toEqual({
      lunar: '正月初一',
      special: '春节',
      specialKind: 'festival',
    })
  })

  it('中秋：八月十五 + 中秋节', () => {
    expect(describeDay('2026-09-25')).toEqual({
      lunar: '八月十五',
      special: '中秋节',
      specialKind: 'festival',
    })
  })

  it('端午：五月初五 + 端午节', () => {
    expect(describeDay('2026-06-19')).toEqual({
      lunar: '五月初五',
      special: '端午节',
      specialKind: 'festival',
    })
  })

  it('节气日：冬至按节气展示', () => {
    const day = describeDay('2026-12-22')
    expect(day.special).toBe('冬至')
    expect(day.specialKind).toBe('jieqi')
  })

  it('普通日：只有农历，没有 special', () => {
    expect(describeDay('2026-11-19')).toEqual({ lunar: '十月十一' })
  })

  it('同一天重复调用命中缓存，结果一致', () => {
    expect(describeDay('2026-09-25')).toEqual(describeDay('2026-09-25'))
  })
})

describe('nextSpecial', () => {
  it('往后找最近节气：11-19 距小雪 3 天', () => {
    expect(nextSpecial('2026-11-19')).toEqual({
      name: '小雪',
      kind: 'jieqi',
      day: '2026-11-22',
      days: 3,
    })
  })

  it('把公历节日算进来：12-26 之后是元旦', () => {
    expect(nextSpecial('2026-12-26')).toMatchObject({ name: '元旦节', day: '2027-01-01', days: 6 })
  })

  it('不含当天：当天已有节气时，返回的是下一个', () => {
    expect(nextSpecial('2026-11-22')?.day).not.toBe('2026-11-22')
  })

  it('节日优先于节气：春节前一天指向春节', () => {
    expect(nextSpecial('2026-02-16')).toMatchObject({ name: '春节', kind: 'festival', days: 1 })
  })
})

describe('dayExtrasLabel', () => {
  it('节日不加「今日」前缀', () => {
    expect(dayExtrasLabel('2026-09-25')).toBe(' · 农历八月十五 · 中秋节')
  })

  it('节气加「今日」前缀', () => {
    expect(dayExtrasLabel('2026-12-22')).toBe(' · 农历冬月十四 · 今日冬至')
  })

  it('普通日改说还有几天到下一个节气', () => {
    expect(dayExtrasLabel('2026-11-19')).toBe(' · 农历十月十一 · 距小雪还有 3 天')
  })
})

describe('cellLabel', () => {
  it('普通日显示农历日，不重复月份', () => {
    expect(cellLabel('2026-11-19')).toEqual({ text: '十一' })
  })

  it('初一显示月份名（万年历惯例）', () => {
    expect(cellLabel('2026-11-09').text).toBe('十月')
  })

  it('节日/节气覆盖农历日，并带上来源', () => {
    expect(cellLabel('2026-12-22')).toEqual({ text: '冬至', kind: 'jieqi' })
    expect(cellLabel('2026-09-25')).toEqual({ text: '中秋节', kind: 'festival' })
  })
})

describe('describeDetail', () => {
  it('详情面板：公历、农历、干支生肖、下一个节点', () => {
    const detail = describeDetail('2026-11-19')
    expect(detail.solarText).toBe('2026 年 11 月 19 日 · 星期四')
    expect(detail.lunarText).toBe('十月十一')
    expect(detail.yearText).toBe('丙午年 · 马')
    expect(detail.next).toMatchObject({ name: '小雪', days: 3 })
  })
})

/**
 * 法定节假日：数据来自 lunar-javascript 内置的国务院放假安排。
 * 这些日期是 2026 年真实安排，换库升级后要重新核对，别直接改断言凑绿。
 */
describe('holidayOf / holidayRun', () => {
  it('国庆连休的中间一天：休假，区间 10-01 到 10-07', () => {
    const run = holidayRun('2026-10-03')
    expect(run).toMatchObject({ name: '国庆节', work: false, from: '2026-10-01', to: '2026-10-07', days: 7 })
  })

  it('补班日：work 为 true，target 指向被补的那天', () => {
    const info = holidayOf('2026-10-10')
    expect(info).toMatchObject({ name: '国庆节', work: true, target: '2026-10-01' })
  })

  it('单日假期不编区间：库里给的是几天就报几天（中秋 2026 是 3 天）', () => {
    expect(holidayLabel('2026-09-25')).toEqual({
      kind: 'off',
      text: '休假 · 中秋节（9 月 25 日 – 9 月 27 日，共 3 天）',
    })
  })

  it('元旦 2026 是 1 月 1–3 日三天假', () => {
    expect(holidayLabel('2026-01-01')?.text).toBe('休假 · 元旦节（1 月 1 日 – 1 月 3 日，共 3 天）')
  })

  it('补班日的说明带上被补的日期', () => {
    expect(holidayLabel('2026-10-10')).toEqual({ kind: 'work', text: '调休上班 · 国庆节（补 10 月 1 日的班）' })
  })

  it('普通工作日没有安排', () => {
    expect(holidayOf('2026-11-19')).toBeNull()
    expect(holidayTag('2026-11-19')).toBeUndefined()
    expect(holidayLabel('2026-11-19')).toBeNull()
  })

  it('角标：休假「休」、补班「班」', () => {
    expect(holidayTag('2026-10-03')).toBe('休')
    expect(holidayTag('2026-10-10')).toBe('班')
  })

  it('数据边界：2027 有安排，2028 起库里没有（返回 null 而不是报错）', () => {
    expect(holidayOf('2027-10-01')).toMatchObject({ name: '国庆节' })
    expect(holidayOf('2028-10-01')).toBeNull()
  })

  it('describeDetail 把假期说明一并带出，供详情卡渲染', () => {
    const detail = describeDetail('2026-09-25')
    expect(detail.special).toBe('中秋节')
    expect(detail.holiday).toEqual({
      kind: 'off',
      text: '休假 · 中秋节（9 月 25 日 – 9 月 27 日，共 3 天）',
    })
  })
})
