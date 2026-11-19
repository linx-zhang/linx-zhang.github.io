/**
 * 农历与节日：服务个人空间页头那一行小字，以及工具箱里的万年历。
 *
 * 为什么用 lunar-javascript：除夕是「腊月最后一天」、中秋要看闰月、
 * 节气靠天文算法，自己写表会长期漂。这里只做薄封装 + 按天缓存，
 * 一个页面整天只算一次。
 */
import { Solar } from 'lunar-javascript'
import { addDays } from '@/utils/calendar'

export interface DayExtras {
  /** 农历月日，如「十月十一」 */
  lunar: string
  /** 节日或节气名，没有则 undefined（节日优先于节气） */
  special?: string
  /** special 的来源，决定展示时是否加「今日」前缀 */
  specialKind?: 'festival' | 'jieqi'
}

export interface UpcomingSpecial {
  /** 节日或节气名，如「小雪」「春节」 */
  name: string
  kind: 'festival' | 'jieqi'
  /** 发生的那一天，YYYY-MM-DD */
  day: string
  /** 距今还有几天，明天为 1 */
  days: number
}

/** 往后找多少个自然日；一个农历年最长 385 天，多留一点余量 */
const LOOKAHEAD_DAYS = 400

/** 按本地日 YYYY-MM-DD 缓存，页面一天只解析一次 */
const cache = new Map<string, DayExtras>()
const upcomingCache = new Map<string, UpcomingSpecial | null>()

function build(day: string): DayExtras {
  const [year, month, date] = day.split('-').map(Number)
  const solar = Solar.fromYmd(year, month, date)
  const lunar = solar.getLunar()

  const lunarText = `${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`
  // 节日优先：农历节日 > 公历节日 > 节气，同日多个只取第一个，避免撑行
  const festival = lunar.getFestivals()[0] ?? solar.getFestivals()[0]
  const jieqi = lunar.getJieQi()

  if (festival) return { lunar: lunarText, special: festival, specialKind: 'festival' }
  if (jieqi) return { lunar: lunarText, special: jieqi, specialKind: 'jieqi' }
  return { lunar: lunarText }
}

/**
 * 描述某一天的农历信息。
 * @param day 本地日 YYYY-MM-DD
 */
export function describeDay(day: string): DayExtras {
  const cached = cache.get(day)
  if (cached) return cached

  const extras = build(day)

  // 缓存只留最近 64 天（万年历一屏 42 格也够），跨月浏览不会无限增长
  if (cache.size > 64) cache.clear()
  cache.set(day, extras)
  return extras
}

/**
 * 从某天起往后找最近的一个节日或节气（不含当天）。
 *
 * 页头用：今天没有节日节气时，改说「距小雪还有 3 天」。
 * 同一天既有节日又有节气时按节日算，与 describeDay 的优先级一致。
 */
export function nextSpecial(from: string): UpcomingSpecial | null {
  if (upcomingCache.has(from)) return upcomingCache.get(from) ?? null

  let found: UpcomingSpecial | null = null
  for (let offset = 1; offset <= LOOKAHEAD_DAYS; offset += 1) {
    const day = addDays(from, offset)
    const { special, specialKind } = build(day)
    if (!special || !specialKind) continue
    found = { name: special, kind: specialKind, day, days: offset }
    break
  }

  if (upcomingCache.size > 16) upcomingCache.clear()
  upcomingCache.set(from, found)
  return found
}

/**
 * 页头展示用的后缀串。
 * 有节日/节气 → 「 · 农历十月十一 · 今日小雪」
 * 都没有 → 「 · 农历十月十一 · 距小雪还有 3 天」
 */
export function dayExtrasLabel(day: string): string {
  const { lunar, special, specialKind } = describeDay(day)
  let tail = ''
  if (special) {
    tail = ` · ${specialKind === 'jieqi' ? '今日' : ''}${special}`
  } else {
    const next = nextSpecial(day)
    if (next) tail = ` · 距${next.name}还有 ${next.days} 天`
  }
  return ` · 农历${lunar}${tail}`
}

/** 万年历单元格里那一行小字：初一显示月名，其余显示农历日；节日/节气优先 */
export function cellLabel(day: string): { text: string; kind?: 'festival' | 'jieqi' } {
  const { lunar, special, specialKind } = describeDay(day)
  if (special) return { text: special, kind: specialKind }
  // 农历初一显示「十月」而不是「初一」，与常见万年历一致
  if (lunar.endsWith('初一')) return { text: lunar.slice(0, -2) }
  // 其余只留日名：「十月十一」→「十一」
  return { text: lunar.slice(lunar.indexOf('月') + 1) }
}

/** 某一天的完整说明，给万年历的详情面板用 */
export interface DayDetail {
  day: string
  solarText: string
  lunarText: string
  /** 干支年 + 生肖，如「丙午年 · 马」 */
  yearText: string
  special?: string
  specialKind?: 'festival' | 'jieqi'
  next?: UpcomingSpecial
}

export function describeDetail(day: string): DayDetail {
  const [year, month, date] = day.split('-').map(Number)
  const solar = Solar.fromYmd(year, month, date)
  const lunar = solar.getLunar()
  const extras = describeDay(day)
  const weekday = '日一二三四五六'[solar.getWeek()]

  return {
    day,
    solarText: `${year} 年 ${month} 月 ${date} 日 · 星期${weekday}`,
    lunarText: `${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`,
    yearText: `${lunar.getYearInGanZhi()}年 · ${lunar.getYearShengXiao()}`,
    special: extras.special,
    specialKind: extras.specialKind,
    next: nextSpecial(day) ?? undefined,
  }
}
