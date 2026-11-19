/**
 * 农历与节日：服务个人空间页头那一行小字，以及工具箱里的万年历。
 *
 * 为什么用 lunar-javascript：除夕是「腊月最后一天」、中秋要看闰月、
 * 节气靠天文算法，自己写表会长期漂。这里只做薄封装 + 按天缓存，
 * 一个页面整天只算一次。
 */
import { HolidayUtil, Solar } from 'lunar-javascript'
import { addDays, parseDay } from '@/utils/calendar'

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

/** 某一天的法定节假日安排：休假还是调休上班 */
export interface DayHoliday {
  /** 假期名，如「国庆节」；补班日也带这个名字 */
  name: string
  /** true = 调休上班（补班日），false = 放假 */
  work: boolean
  /** 这次安排的正日子，YYYY-MM-DD（补班日指向被补的那天） */
  target: string
}

/** 连续的一整段假期或一整段补班 */
export interface HolidayRun extends DayHoliday {
  from: string
  to: string
  days: number
}

const holidayCache = new Map<string, DayHoliday | null>()

function readHoliday(day: string): DayHoliday | null {
  const raw = HolidayUtil.getHoliday(day)
  if (!raw) return null
  const name = raw.getName()
  const target = raw.getTarget()
  // 库里偶有字段为空，宁可不标也不要渲染半截
  if (!name || !target) return null
  return { name, work: raw.isWork(), target }
}

/**
 * 某一天是否放假 / 补班。
 * 数据是 lunar-javascript 内置的国务院放假安排：2001–2027 已覆盖，
 * 更远的年份返回 null（要等库升级），所以展示侧按「没有安排」静默处理。
 */
export function holidayOf(day: string): DayHoliday | null {
  if (holidayCache.has(day)) return holidayCache.get(day) ?? null
  const info = readHoliday(day)
  if (holidayCache.size > 256) holidayCache.clear()
  holidayCache.set(day, info)
  return info
}

/**
 * 当天所在的连续假期 / 连续补班段。
 * 库只标「每天属于哪次安排」，连休几天要自己前后走：同 target、同 work 才算一段。
 */
export function holidayRun(day: string): HolidayRun | null {
  const info = holidayOf(day)
  if (!info) return null
  const same = (other: string): boolean => {
    const h = holidayOf(other)
    return !!h && h.target === info.target && h.work === info.work
  }

  let from = day
  let to = day
  for (let i = 0; i < 40; i += 1) {
    const prev = addDays(from, -1)
    if (!same(prev)) break
    from = prev
  }
  for (let i = 0; i < 40; i += 1) {
    const next = addDays(to, 1)
    if (!same(next)) break
    to = next
  }
  // 用中午的 Date 相减，避开夏令时边界，向上取整到自然日数
  const days = Math.round((parseDay(to).getTime() - parseDay(from).getTime()) / 86400000) + 1
  return { ...info, from, to, days }
}

/** YYYY-MM-DD →「10 月 1 日」 */
function monthDay(day: string): string {
  const [, month, date] = day.split('-').map(Number)
  return `${month} 月 ${date} 日`
}

/**
 * 详情面板上的那一行假期说明。
 * 放假：休假 · 国庆节（10 月 1 日 – 10 月 7 日，共 7 天）
 * 补班：调休上班 · 国庆节（补 10 月 1 日的班）
 */
export function holidayLabel(day: string): { kind: 'off' | 'work'; text: string } | null {
  const run = holidayRun(day)
  if (!run) return null
  if (run.work) {
    return { kind: 'work', text: `调休上班 · ${run.name}（补 ${monthDay(run.target)}的班）` }
  }
  if (run.days > 1) {
    return { kind: 'off', text: `休假 · ${run.name}（${monthDay(run.from)} – ${monthDay(run.to)}，共 ${run.days} 天）` }
  }
  return { kind: 'off', text: `休假 · ${run.name}` }
}

/** 单元格角标：放假「休」、补班「班」；没安排不给 */
export function holidayTag(day: string): '休' | '班' | undefined {
  const info = holidayOf(day)
  if (!info) return undefined
  return info.work ? '班' : '休'
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
  /** 当天的法定安排：放假或调休上班 */
  holiday?: { kind: 'off' | 'work'; text: string }
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
    holiday: holidayLabel(day) ?? undefined,
    next: nextSpecial(day) ?? undefined,
  }
}
