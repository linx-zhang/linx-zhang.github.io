import type { Memo } from '@/api/memos'

export type MemoFilter = 'all' | 'pending' | 'done'
export type MemoView = 'list' | 'calendar'

/**
 * 和服务端同一套顺序：待办按到期日升序（越紧越前，没有到期日的排后面并按创建倒序）；
 * 已完成没有到期语义，按完成时间倒序。本地改到期日/勾选后也用它重排，
 * 不至于原地不动、等下一次刷新才跳到该在的位置。
 */
export function sortMemos(rows: Memo[], doneView: boolean): Memo[] {
  return [...rows].sort((a, b) => {
    if (doneView) return (b.done_at ?? '').localeCompare(a.done_at ?? '') || b.id - a.id
    if (!a.due_at && !b.due_at) return b.created_at.localeCompare(a.created_at) || b.id - a.id
    if (!a.due_at) return 1
    if (!b.due_at) return -1
    return a.due_at.localeCompare(b.due_at) || b.created_at.localeCompare(a.created_at) || b.id - a.id
  })
}
