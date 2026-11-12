/**
 * 后端返回的时间串都是 UTC（D1 的 datetime('now') 不带时区），
 * 这里统一按 UTC 解析，再按浏览器本地时区展示，避免与本地时间差 8 小时。
 */
export function parseServerTimestamp(value: string): Date | null {
  const normalized = value.includes('T') ? value : value.replace(' ', 'T')
  const withZone = /Z|[+-]\d{2}:\d{2}$/.test(normalized) ? normalized : `${normalized}Z`
  const date = new Date(withZone)
  return Number.isNaN(date.getTime()) ? null : date
}

const pad = (input: number) => String(input).padStart(2, '0')

/** 后端时间串 → 本地日期（YYYY-MM-DD） */
export function formatDate(value: string): string {
  const date = parseServerTimestamp(value)
  if (!date) return value.replace('T', ' ').slice(0, 10)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** 后端时间串 → 本地时间（YYYY-MM-DD HH:MM） */
export function formatTimestamp(value: string): string {
  const date = parseServerTimestamp(value)
  if (!date) return value.replace('T', ' ').slice(0, 16)
  return `${formatDate(value)} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** 列表类页面统一的分页大小 */
export const PAGE_SIZE = 20
