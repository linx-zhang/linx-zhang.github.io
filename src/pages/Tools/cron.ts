/** 5 段 cron 的解析、描述、下次执行时间和生成。 */

export interface CronSpec {
  expression: string
  /** 解析时实际展开的 5 段原文，保留 *、1-5、MON-FRI 这类写法 */
  fields: string[]
  minute: number[]
  hour: number[]
  dayOfMonth: number[]
  month: number[]
  dayOfWeek: number[]
}

const MONTH_NAMES: Record<string, number> = {
  JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
  JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12,
}

const WEEKDAY_NAMES: Record<string, number> = {
  SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6,
}

const WEEKDAY_CN = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const MONTH_CN = ['', '1 月', '2 月', '3 月', '4 月', '5 月', '6 月', '7 月', '8 月', '9 月', '10 月', '11 月', '12 月']

const MACROS: Record<string, string> = {
  '@yearly': '0 0 1 1 *',
  '@annually': '0 0 1 1 *',
  '@monthly': '0 0 1 * *',
  '@weekly': '0 0 * * 0',
  '@daily': '0 0 * * *',
  '@midnight': '0 0 * * *',
  '@hourly': '0 * * * *',
}

function parseValue(
  raw: string,
  min: number,
  max: number,
  label: string,
  names?: Record<string, number>,
): number {
  const text = raw.trim().toUpperCase()
  if (names && names[text] !== undefined) return names[text]
  if (!/^\d+$/.test(text)) throw new Error(`${label}「${raw}」不是有效数字`)
  const value = Number(text)
  if (value < min || value > max) throw new Error(`${label}「${raw}」超出 ${min}–${max}`)
  return value
}

function parseField(field: string, min: number, max: number, label: string, names?: Record<string, number>): number[] {
  if (!field.trim()) throw new Error(`${label}不能为空`)
  if (field.includes('?') && field !== '?') throw new Error(`${label}里的 ? 只能单独使用`)
  const values = new Set<number>()
  for (const part of field.split(',')) {
    if (!part) throw new Error(`${label}有空的列表项`)
    const [base, stepText] = part.split('/')
    if (!base) throw new Error(`${label}有空的步进项`)
    const step = stepText === undefined ? 1 : Number(stepText)
    if (!Number.isInteger(step) || step <= 0) throw new Error(`${label}的步进「${stepText}」无效`)

    let start: number
    let end: number
    if (base === '*' || base === '?') {
      start = min
      end = max
    } else if (base.includes('-')) {
      const [from, to] = base.split('-')
      start = parseValue(from, min, max, label, names)
      end = parseValue(to, min, max, label, names)
      if (start > end) throw new Error(`${label}的区间「${base}」起点大于终点`)
    } else {
      start = parseValue(base, min, max, label, names)
      end = stepText === undefined ? start : max
    }

    for (let value = start; value <= end; value += step) values.add(value)
  }
  if (values.size === 0) throw new Error(`${label}没有可选值`)
  return [...values].sort((a, b) => a - b)
}

function normalizeDows(values: number[]): number[] {
  const set = new Set(values.map((value) => (value === 7 ? 0 : value)))
  return [...set].sort((a, b) => a - b)
}

export function parseCron(expression: string): CronSpec {
  const raw = expression.trim()
  if (!raw) throw new Error('先输入 cron 表达式')
  const normalized = MACROS[raw.toLowerCase()] ?? raw
  const fields = normalized.split(/\s+/)
  if (fields.length !== 5) {
    throw new Error(`cron 应该是 5 段：分 时 日 月 周，现在有 ${fields.length} 段`)
  }
  const [minute, hour, dayOfMonth, month, dayOfWeek] = fields
  return {
    expression: raw,
    fields,
    minute: parseField(minute, 0, 59, '分钟'),
    hour: parseField(hour, 0, 23, '小时'),
    dayOfMonth: parseField(dayOfMonth, 1, 31, '日期'),
    month: parseField(month, 1, 12, '月份', MONTH_NAMES),
    dayOfWeek: normalizeDows(parseField(dayOfWeek, 0, 7, '星期', WEEKDAY_NAMES)),
  }
}

const pad = (value: number) => String(value).padStart(2, '0')

function timeText(hour: number, minute: number): string {
  return `${pad(hour)}:${pad(minute)}`
}

function setText(values: number[], formatter: (value: number) => string): string {
  if (values.length <= 5) return values.map(formatter).join('、')
  const contiguous = values.every((value, index) => index === 0 || value === values[index - 1] + 1)
  if (contiguous) return `${formatter(values[0])}–${formatter(values[values.length - 1])}`
  return values.slice(0, 4).map(formatter).join('、') + ` 等 ${values.length} 个`
}

/** 人话描述只覆盖常见形状，复杂组合会退回逐字段罗列，不硬编一句可能误导的话 */
export function describeCron(spec: CronSpec): string {
  const minuteAll = spec.minute.length === 60
  const hourAll = spec.hour.length === 24
  const domAll = spec.dayOfMonth.length === 31
  const monthAll = spec.month.length === 12
  const dowAll = spec.dayOfWeek.length === 7
  const minuteStep = minuteAll ? 1 : stepOf(spec.minute)
  const hourStep = hourAll ? 1 : stepOf(spec.hour)

  if (minuteAll && hourAll) return '每分钟执行一次'
  if (minuteAll && hourStep > 1 && domAll && monthAll && dowAll) {
    return `每 ${hourStep} 小时执行一次（从 0 点起算，每小时都跑）`
  }
  if (minuteAll && !hourAll && domAll && monthAll && dowAll) {
    return `每小时的第 ${spec.minute.slice(0, 5).join('、')} 分执行`
  }
  if (minuteStep > 1 && hourAll && domAll && monthAll && dowAll) {
    return `每 ${minuteStep} 分钟执行一次`
  }

  if (spec.minute.length === 1 && spec.hour.length === 1 && domAll && monthAll && dowAll) {
    return `每天 ${timeText(spec.hour[0], spec.minute[0])} 执行`
  }

  if (spec.minute.length === 1 && spec.hour.length === 1 && domAll && monthAll && !dowAll) {
    return `每${setText(spec.dayOfWeek, (value) => WEEKDAY_CN[value])} ${timeText(
      spec.hour[0],
      spec.minute[0],
    )} 执行`
  }

  if (spec.minute.length === 1 && spec.hour.length === 1 && !domAll && monthAll && dowAll) {
    return `每月 ${setText(spec.dayOfMonth, (value) => `${value} 日`)} ${timeText(
      spec.hour[0],
      spec.minute[0],
    )} 执行`
  }

  if (spec.minute.length === 1 && spec.hour.length === 1 && !domAll && !monthAll && dowAll) {
    return `每年 ${setText(spec.month, (value) => MONTH_CN[value])}的 ${setText(
      spec.dayOfMonth,
      (value) => `${value} 日`,
    )} ${timeText(spec.hour[0], spec.minute[0])} 执行`
  }

  return [
    `分钟：${setText(spec.minute, pad)}`,
    `小时：${setText(spec.hour, pad)}`,
    `日期：${setText(spec.dayOfMonth, String)}`,
    `月份：${setText(spec.month, String)}`,
    `星期：${setText(spec.dayOfWeek, (value) => WEEKDAY_CN[value])}`,
  ].join('；')
}

function stepOf(values: number[]): number {
  if (values.length < 2) return 0
  return values[1] - values[0]
}

function dayMatches(spec: CronSpec, date: Date): boolean {
  const domAll = spec.dayOfMonth.length === 31
  const dowAll = spec.dayOfWeek.length === 7
  const domHit = spec.dayOfMonth.includes(date.getDate())
  const dowHit = spec.dayOfWeek.includes(date.getDay())
  // 标准 cron：日和周都受限时取「或」，只有一个受限时取它
  if (!domAll && !dowAll) return domHit || dowHit
  return domHit && dowHit
}

export interface NextRunOptions {
  from?: Date
  count?: number
  /** 最多往后找多少年，默认 3 年 */
  maxYears?: number
}

export function nextRuns(spec: CronSpec, options: NextRunOptions = {}): Date[] {
  const count = Math.max(1, options.count ?? 5)
  const maxYears = Math.max(1, options.maxYears ?? 3)
  const date = new Date(options.from ?? new Date())
  date.setSeconds(0, 0)
  date.setMinutes(date.getMinutes() + 1)

  const end = new Date(date)
  end.setFullYear(end.getFullYear() + maxYears)
  const runs: Date[] = []

  while (date.getTime() <= end.getTime() && runs.length < count) {
    if (!spec.month.includes(date.getMonth() + 1)) {
      date.setMonth(date.getMonth() + 1, 1)
      date.setHours(0, 0, 0, 0)
      continue
    }
    if (!dayMatches(spec, date)) {
      date.setDate(date.getDate() + 1)
      date.setHours(0, 0, 0, 0)
      continue
    }
    if (!spec.hour.includes(date.getHours())) {
      date.setHours(date.getHours() + 1, 0, 0, 0)
      continue
    }
    if (!spec.minute.includes(date.getMinutes())) {
      date.setMinutes(date.getMinutes() + 1, 0, 0)
      continue
    }
    runs.push(new Date(date))
    date.setMinutes(date.getMinutes() + 1)
  }
  return runs
}

export type CronFrequency = 'minutes' | 'hours' | 'daily' | 'weekly' | 'monthly'

export interface CronBuildInput {
  frequency: CronFrequency
  interval: number
  minute: number
  hour: number
  weekday: number
  dayOfMonth: number
}

function intInRange(value: number, min: number, max: number, label: string): number {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${label}要在 ${min}–${max} 之间`)
  }
  return value
}

export function buildCron(input: CronBuildInput): string {
  const minute = intInRange(input.minute, 0, 59, '分钟')
  const hour = intInRange(input.hour, 0, 23, '小时')
  switch (input.frequency) {
    case 'minutes': {
      const interval = intInRange(input.interval, 1, 59, '分钟间隔')
      return `${interval === 1 ? '*' : `*/${interval}`} * * * *`
    }
    case 'hours': {
      const interval = intInRange(input.interval, 1, 23, '小时间隔')
      return interval === 1 ? `${minute} * * * *` : `${minute} */${interval} * * *`
    }
    case 'daily':
      return `${minute} ${hour} * * *`
    case 'weekly': {
      const weekday = intInRange(input.weekday, 0, 6, '星期')
      return `${minute} ${hour} * * ${weekday}`
    }
    case 'monthly': {
      const day = intInRange(input.dayOfMonth, 1, 31, '日期')
      return `${minute} ${hour} ${day} * *`
    }
    default:
      throw new Error('未知的生成频率')
  }
}

export function formatRunTime(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())} ${WEEKDAY_CN[date.getDay()]}`
}
