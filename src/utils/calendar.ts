/**
 * 日历计算：DatePicker 与 DateRangePicker 共用同一份规则。
 *
 * 三条约定，改动前请确认两处组件都能接受：
 * 1. 内部一律用「本地日 YYYY-MM-DD」字符串做键，避免 Date 对象时区漂移；
 * 2. 所有 Date 统一取本地中午，规避夏令时切换导致的跨日偏移；
 * 3. 月视图固定 42 格（6 行），首格是所在周的周日。
 */

export const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'] as const

 /** 月视图固定格数：6 行 × 7 列 */
export const MONTH_GRID_CELLS = 42

const pad = (value: number): string => String(value).padStart(2, '0')

/** Date → 本地日 YYYY-MM-DD */
export function toDay(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** 本地日 YYYY-MM-DD → Date（取中午，规避夏令时偏移） */
export function parseDay(day: string): Date {
  const [year, month, date] = day.split('-').map(Number)
  return new Date(year, month - 1, date, 12)
}

/** 今天（本地，YYYY-MM-DD） */
export function today(): string {
  return toDay(new Date())
}

export function addDays(day: string, delta: number): string {
  const date = parseDay(day)
  date.setDate(date.getDate() + delta)
  return toDay(date)
}

export function startOfMonth(day: string): Date {
  const date = parseDay(day)
  return new Date(date.getFullYear(), date.getMonth(), 1, 12)
}

export function addMonths(month: Date, delta: number): Date {
  return new Date(month.getFullYear(), month.getMonth() + delta, 1, 12)
}

/** 42 格日期表（含上月尾部与下月头部），首格为所在周的周日 */
export function monthGrid(month: Date): string[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1, 12)
  const start = addDays(toDay(first), -first.getDay())
  return Array.from({ length: MONTH_GRID_CELLS }, (_, index) => addDays(start, index))
}

/** 是否不属于当前视图月份 */
export function isOutsideMonth(day: string, month: Date): boolean {
  return parseDay(day).getMonth() !== month.getMonth()
}

/** 月内的日号（1–31），单元格里显示的数字 */
export function dayNumber(day: string): number {
  return parseDay(day).getDate()
}
