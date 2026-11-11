/** 后端时间串（如 "2026-11-11T10:20:30"）只取日期部分 */
export function formatDate(value: string): string {
  return value.replace('T', ' ').slice(0, 10)
}

/** 同上，取到分钟（"2026-11-11 10:20"） */
export function formatTimestamp(value: string): string {
  return value.replace('T', ' ').slice(0, 16)
}

/** 列表类页面统一的分页大小 */
export const PAGE_SIZE = 20
