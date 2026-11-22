import { parseDay } from '@/utils/calendar'
import type { Consumable, ConsumableCategory, ConsumableStatus } from '@/api/consumables'

/** 类别只决定图标和分组，不参与计算 */
export const CATEGORIES: { key: ConsumableCategory; label: string; icon: string }[] = [
  { key: 'paper', label: '纸品', icon: '🧻' },
  { key: 'clean', label: '清洁', icon: '🧴' },
  { key: 'food', label: '食品', icon: '🥫' },
  { key: 'pet', label: '宠物', icon: '🐾' },
  { key: 'other', label: '其他', icon: '📦' },
]

export const STATUS_TEXT: Record<ConsumableStatus, string> = {
  due: '该买了',
  soon: '快用完',
  idle: '待补货',
  unknown: '估不准',
  ok: '正常',
}

/** 排序：能买的排前面；估不准的还没进入节奏，沉到正常项后面 */
export const STATUS_ORDER: Record<ConsumableStatus, number> = {
  due: 0,
  idle: 1,
  soon: 2,
  ok: 3,
  unknown: 4,
}

/** '2026-12-03' → '12 月 3 日' */
function monthDay(day: string): string {
  const date = parseDay(day)
  return `${date.getMonth() + 1} 月 ${date.getDate()} 日`
}

/** '2026-10-08' → '10/08'，周期历史用短格式 */
export function shortDay(day: string): string {
  return day.slice(5).replace('-', '/')
}

export function categoryMeta(key: ConsumableCategory) {
  return CATEGORIES.find((item) => item.key === key) ?? CATEGORIES[CATEGORIES.length - 1]
}

/** 数量 + 单位只是辅助信息：没填数量就不显示，单留个单位没有意义 */
export function amountLabel(item: Consumable): string {
  if (item.quantity === null) return ''
  const value = Number.isInteger(item.quantity) ? String(item.quantity) : item.quantity.toFixed(1)
  return `${value}${item.unit ? ` ${item.unit}` : ''}`
}

/** 「11 月 28 日见底」/「今天见底」/「已超 3 天」——过期后不再说未来日期 */
export function dueLabel(item: Consumable): string | null {
  if (!item.due_on) return null
  const left = item.days_left ?? 0
  if (left < 0) return `已超 ${-left} 天`
  if (left === 0) return '今天见底'
  return `${monthDay(item.due_on)}见底`
}

interface RawNumbers {
  expected: string
  lead: string
  quantity: string
}

/**
 * 新建表单与详情修正共用同一套三字段校验：
 * 预计天数 1–3650、提前 0–60、数量非负；空串按默认/不设处理。
 */
export function parseConsumableNumbers(raw: RawNumbers):
  | { expectedDays: number | null; leadDays: number; quantity: number | null }
  | { error: string } {
  const expected = raw.expected.trim() ? Number(raw.expected) : null
  if (expected !== null && (!Number.isFinite(expected) || expected < 1 || expected > 3650)) {
    return { error: '预计天数填 1–3650 之间' }
  }
  const lead = raw.lead.trim() ? Number(raw.lead) : 7
  if (!Number.isFinite(lead) || lead < 0 || lead > 60) {
    return { error: '提前提醒填 0–60 天' }
  }
  const quantity = raw.quantity.trim() ? Number(raw.quantity) : null
  if (quantity !== null && (!Number.isFinite(quantity) || quantity < 0)) {
    return { error: '数量不能是负数' }
  }
  return { expectedDays: expected, leadDays: lead, quantity }
}
