import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent, MouseEvent } from 'react'
import DatePicker from '@/components/DatePicker'
import { useConfirm } from '@/components/ConfirmDialog/useConfirm'
import { errorMessage } from '@/api/errors'
import { memoApi } from '@/api/memos'
import type { Memo, MemoSummary } from '@/api/memos'
import { useInfiniteList } from '@/hooks/useInfiniteList'
import { useResource } from '@/hooks/useResource'
import { MEMO_BODY_MAX } from '@/constants'
import { formatDate, localDayEndUtc } from '@/utils/format'
import { today } from '@/utils/calendar'
import SpaceCalendar from './SpaceCalendar'
import SpaceSkeleton from './SpaceSkeleton'
import { sortMemos } from './memoSort'
import type { MemoFilter, MemoView } from './memoSort'
import './SpaceMemos.css'

const FILTERS: { key: MemoFilter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '待办' },
  { key: 'done', label: '已完成' },
]

function dayLabel(day: string, todayKey: string): string {
  // 同一年沿用 12-03；跨年必须带年份，否则 2027 的条目会被看成今年
  return day.startsWith(todayKey.slice(0, 4)) ? day.slice(5) : day
}

export function dueMeta(dueAt: string): { text: string; tone: 'today' | 'late' | 'later' } {
  // due_at 存的是 UTC 时刻（本地当天 23:59:59），比较前先换算成本地那一天
  const day = formatDate(dueAt)
  const todayKey = today()
  if (day === todayKey) return { text: '今天到期', tone: 'today' }
  if (day < todayKey) return { text: `${dayLabel(day, todayKey)} 已过期`, tone: 'late' }
  return { text: `${dayLabel(day, todayKey)} 到期`, tone: 'later' }
}

interface Props {
  userId: number
  view: MemoView
  /** ?date=YYYY-MM-DD，只在首次进月历时定位那一天 */
  initialDay?: string
}

export async function loadAllMemos(): Promise<Memo[]> {
  const rows: Memo[] = []
  let offset = 0
  for (let page = 0; page < 200; page += 1) {
    const res = await memoApi.list(undefined, 100, offset)
    rows.push(...res.items)
    if (!res.has_next || res.items.length === 0) break
    offset += res.items.length
  }
  return rows
}

/**
 * 备忘录板块：列表 / 月历两种视图共用一份 memo 数据。
 *
 * 外壳（页头、板块 tab、列表/日历切换）留在 `Space`；这里负责备忘录自己的取数、
 * 输入区、就地编辑、筛选和月历编排，切到消耗品时整块卸载。
 */
export default function SpaceMemos({ userId, view, initialDay }: Props) {
  const { confirm, dialog } = useConfirm()
  const [filter, setFilter] = useState<MemoFilter>('all')

  /**
   * 列表用「追加型」状态机：只有 loadMore 会追加，reload 一定清空回第 1 页。
   * 这正是此前「同一页被追加两遍」的根因——旧实现在 reload 时只 bump 了 key，
   * 页码还停在原来的位置，于是 pageIndex !== 0 走了追加分支。
   */
  const list = useInfiniteList<Memo>(
    (limit, offset) => memoApi.list(filter === 'all' ? undefined : filter === 'done', limit, offset),
  )

  const summaryQuery = useResource<MemoSummary>(() => memoApi.summary(), [userId], {
    silent: true,
  })
  const summary = summaryQuery.data

  /**
   * 月历要「整月的到期点」，和列表视图的按页追加不是一回事：这里一次把全部条目取回来。
   * 个人备忘录量级很小，但也不再写死 5 页——数据攒到半年以上时，截断会让旧到期日
   * 在月历里凭空消失，而列表里还在。
   * 顺手把 done 的筛选去掉——月历要把已完成的也画出来，只是颜色淡一档。
   */
  const calendarQuery = useResource<Memo[]>(loadAllMemos, [userId], {
    enabled: view === 'calendar',
  })

  const [body, setBody] = useState('')
  // 输入框里的到期日只按「本地哪一天」保管，落库前换算成 UTC 时刻
  const [dueDay, setDueDay] = useState('')
  const [saving, setSaving] = useState(false)
  const [composeError, setComposeError] = useState('')
  // 就地编辑已有条目：内容和到期日都能改，改完直接落库
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editBody, setEditBody] = useState('')
  const [editDueDay, setEditDueDay] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')
  // 手机上先给一个「＋ 记一条」按钮，点开才是输入区；桌面上宽屏默认展开
  const [expanded, setExpanded] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches,
  )
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!expanded) return
    const timer = window.setTimeout(() => textareaRef.current?.focus(), 60)
    return () => window.clearTimeout(timer)
  }, [expanded])

  const items = list.items
  const status = list.status
  const hasNext = list.hasNext
  const error = list.error

  const refresh = () => {
    list.reload()
    summaryQuery.reload()
    // 月历视图下新建/删除也要跟着变；列表视图里它没开，reload 只是白记一个 key
    calendarQuery.reload()
  }

  const switchFilter = (next: MemoFilter) => {
    if (next === filter) return
    setFilter(next)
    list.reload()
  }

  /** 服务端返回值对齐到列表；当前筛选不该再包含它时直接移出，避免「勾完还留在待办里」 */
  const applyMemo = (memo: Memo) => {
    const visible = filter === 'all' || (filter === 'done' ? memo.done : !memo.done)
    list.setItems((prev) =>
      sortMemos(
        visible
          ? prev.map((item) => (item.id === memo.id ? memo : item))
          : prev.filter((item) => item.id !== memo.id),
        filter === 'done',
      ),
    )
  }

  const submit = async (event?: FormEvent) => {
    event?.preventDefault()
    setComposeError('')
    const text = body.trim()
    if (!text) {
      setComposeError('写点什么再保存')
      return
    }
    if (text.length > MEMO_BODY_MAX) {
      setComposeError(`一条最多 ${MEMO_BODY_MAX} 个字符`)
      return
    }
    setSaving(true)
    try {
      await memoApi.create({
        body: text,
        due_at: dueDay ? localDayEndUtc(dueDay) : null,
      })
      setBody('')
      setDueDay('')
      // 新建的条目在「已完成」里看不到，切回「全部」再刷新
      if (filter === 'done') setFilter('all')
      refresh()
    } catch (err) {
      setComposeError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (memo: Memo) => {
    setEditingId(memo.id)
    setEditBody(memo.body)
    setEditDueDay(memo.due_at ? formatDate(memo.due_at) : '')
    setEditError('')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditError('')
  }

  const saveEdit = async (memo: Memo) => {
    const text = editBody.trim()
    if (!text) {
      setEditError('内容不能为空')
      return
    }
    if (text.length > MEMO_BODY_MAX) {
      setEditError(`一条最多 ${MEMO_BODY_MAX} 个字符`)
      return
    }
    setEditSaving(true)
    try {
      const updated = await memoApi.update(memo.id, {
        body: text,
        due_at: editDueDay ? localDayEndUtc(editDueDay) : null,
      })
      applyMemo(updated)
      setEditingId(null)
      // 计数交给服务端：自己算 pending/done 迟早和过滤口径漂移
      summaryQuery.reload()
    } catch (err) {
      setEditError(errorMessage(err))
    } finally {
      setEditSaving(false)
    }
  }

  const toggleDone = async (memo: Memo) => {
    const nextDone = !memo.done
    // 先改本地：勾选要立刻有反馈，失败再回滚
    list.setItems((prev) =>
      prev.map((item) => (item.id === memo.id ? { ...item, done: nextDone } : item)),
    )
    try {
      const updated = await memoApi.update(memo.id, { done: nextDone })
      applyMemo(updated)
      summaryQuery.reload()
    } catch {
      // 失败就以服务端为准重取：本地回滚要判断它该不该留在当前筛选里，容易出错
      list.reload()
    }
  }

  /**
   * 月历里的勾选：改的是 calendarQuery 那一份，同时把列表里的同一行对齐（applyMemo）。
   * 两个视图共用一次请求结果，谁也不该在切回去以后显示旧状态。
   */
  const toggleDoneInCalendar = async (memo: Memo) => {
    const nextDone = !memo.done
    const rows = calendarQuery.data
    if (rows) {
      calendarQuery.setData(rows.map((item) => (item.id === memo.id ? { ...item, done: nextDone } : item)))
    }
    try {
      const updated = await memoApi.update(memo.id, { done: nextDone })
      const current = calendarQuery.data ?? []
      calendarQuery.setData(current.map((item) => (item.id === updated.id ? updated : item)))
      applyMemo(updated)
      summaryQuery.reload()
    } catch {
      calendarQuery.reload()
    }
  }

  /**
   * 月历里「在选中的那天记一条」：到期时刻在这里统一换算成本地 23:59:59 的 UTC，
   * 月历数据直接追加服务端返回值，省掉一次全量重取；列表与计数各刷新一次对齐。
   */
  const createFromCalendar = async (bodyText: string, day: string) => {
    const created = await memoApi.create({ body: bodyText, due_at: localDayEndUtc(day) })
    calendarQuery.setData([...(calendarQuery.data ?? []), created])
    summaryQuery.reload()
    // 新建的都是未完成，落在「已完成」筛选里看不见，和列表视图一样切回全部
    if (filter === 'done') setFilter('all')
    list.reload()
  }

  const remove = (memo: Memo) => {
    confirm({
      title: '删除这条备忘录？',
      description: '删除后不再出现在列表里。',
      confirmText: '删除',
      tone: 'danger',
      onConfirm: async () => {
        await memoApi.remove(memo.id)
        list.setItems((prev) => prev.filter((item) => item.id !== memo.id))
        summaryQuery.reload()
      },
    })
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault()
      void submit()
    }
  }

  /**
   * 输入区只有 textarea 本体可点，框内的边距、到期日右侧的空白点下去什么都不发生，
   * 手感上就是「点了输入框却没进编辑」。整条输入区都当热区，点击后把光标交给 textarea；
   * 按钮自己带 onClick，先排除掉，别抢它们的点击。
   */
  const focusComposer = (event: MouseEvent<HTMLFormElement>) => {
    const target = event.target as HTMLElement
    if (target.closest('button') || target.closest('textarea')) return
    textareaRef.current?.focus()
  }

  const counts = useMemo(() => {
    const total = summary ? summary.pending + summary.done : null
    return {
      all: total,
      pending: summary?.pending ?? null,
      done: summary?.done ?? null,
    }
  }, [summary])

  const filtering = filter !== 'all'

  return (
    <>
      {view === 'list' ? (
        <>
          <div className="space-dock">
            {!expanded ? (
              <button
                type="button"
                className="space-compose-trigger"
                onClick={() => setExpanded(true)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                记一条
                <span>备忘录 / 待办</span>
              </button>
            ) : (
              <>
                <form className="space-composer" onSubmit={submit} onClick={focusComposer} noValidate>
                  <textarea
                    ref={textareaRef}
                    value={body}
                    rows={1}
                    maxLength={MEMO_BODY_MAX}
                    placeholder="写点什么，比如「周五前交周报」"
                    aria-label="新备忘录"
                    onChange={(event) => {
                      setBody(event.target.value)
                      setComposeError('')
                      event.target.style.height = 'auto'
                      event.target.style.height = `${Math.min(event.target.scrollHeight, 140)}px`
                    }}
                    onKeyDown={onKeyDown}
                  />
                  {/* 原生 date 输入在中文环境里会露出「年/月/日」三个空槽，很怪：
                      把它藏起来，只用一个按钮显示状态，点按钮再拉起系统日历 */}
                  <div className="space-due">
                    <DatePicker
                      value={dueDay || null}
                      onChange={(day) => setDueDay(day ?? '')}
                      placeholder="到期日"
                      ariaLabel="到期日"
                      triggerClassName="space-due-trigger"
                      icon={
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                          <path d="M7 4v3M17 4v3M4 9h16M5 7h14v12H5z" />
                        </svg>
                      }
                    />
                    {dueDay && (
                      <button
                        type="button"
                        className="space-due-clear"
                        aria-label="清除到期日"
                        onClick={() => setDueDay('')}
                      >
                        ×
                      </button>
                    )}
                  </div>
                  <button
                    type="submit"
                    className="space-button space-button-primary"
                    disabled={saving || body.trim().length === 0}
                  >
                    {saving ? '保存中…' : '保存'}
                  </button>
                </form>
                <div className="space-dock-foot">
                  <button
                    type="button"
                    className="space-collapse"
                    onClick={() => {
                      setExpanded(false)
                      setComposeError('')
                    }}
                  >
                    收起
                  </button>
                  {composeError ? (
                    <p className="space-error">{composeError}</p>
                  ) : (
                    <p className="space-hint">Ctrl / ⌘ + Enter 保存</p>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="space-list-head">
            <div className="space-seg" role="group" aria-label="筛选">
              {FILTERS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  aria-pressed={filter === item.key}
                  onClick={() => switchFilter(item.key)}
                >
                  {item.label}
                  {counts[item.key] !== null ? ` ${counts[item.key]}` : ''}
                </button>
              ))}
            </div>
          </div>

          {status === 'error' && (
            <div className="space-state space-state-error">
              <p>{error}</p>
              <button type="button" className="space-button" onClick={refresh}>
                重试
              </button>
            </div>
          )}

          {status === 'loading' && items.length === 0 && <SpaceSkeleton className="space-list" />}

          {status !== 'error' && items.length === 0 && status === 'ready' && (
            <div className="space-state">
              {filtering ? '这里还没有条目。' : '还没有备忘录，点下面的「＋ 记一条」写第一条。'}
            </div>
          )}

          {items.length > 0 && (
            <div className="space-list">
              {items.map((memo) => {
                const due = memo.due_at ? dueMeta(memo.due_at) : null
                const isEditing = editingId === memo.id
                if (isEditing) {
                  return (
                    <article key={memo.id} className="space-memo is-editing">
                      <div className="space-edit">
                        <textarea
                          className="space-edit-text"
                          value={editBody}
                          rows={3}
                          maxLength={MEMO_BODY_MAX}
                          autoFocus
                          aria-label="修改备忘录"
                          onChange={(event) => {
                            setEditBody(event.target.value)
                            setEditError('')
                          }}
                          onKeyDown={(event) => {
                            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                              event.preventDefault()
                              void saveEdit(memo)
                            }
                            if (event.key === 'Escape') {
                              event.preventDefault()
                              cancelEdit()
                            }
                          }}
                        />
                        <div className="space-edit-foot">
                          <div className="space-due">
                            <DatePicker
                              value={editDueDay || null}
                              onChange={(day) => setEditDueDay(day ?? '')}
                              placeholder="到期日"
                              ariaLabel="到期日"
                              triggerClassName="space-due-trigger"
                              icon={
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                                  <path d="M7 4v3M17 4v3M4 9h16M5 7h14v12H5z" />
                                </svg>
                              }
                            />
                            {editDueDay && (
                              <button
                                type="button"
                                className="space-due-clear"
                                aria-label="清除到期日"
                                onClick={() => setEditDueDay('')}
                              >
                                ×
                              </button>
                            )}
                          </div>
                          <div className="space-edit-actions">
                            <button type="button" className="space-button" onClick={cancelEdit}>
                              取消
                            </button>
                            <button
                              type="button"
                              className="space-button space-button-primary"
                              disabled={editSaving || editBody.trim().length === 0}
                              onClick={() => void saveEdit(memo)}
                            >
                              {editSaving ? '保存中…' : '保存'}
                            </button>
                          </div>
                        </div>
                        {editError && <p className="space-error">{editError}</p>}
                      </div>
                    </article>
                  )
                }
                return (
                  <article key={memo.id} className={memo.done ? 'space-memo is-done' : 'space-memo'}>
                    <button
                      type="button"
                      className="space-check"
                      aria-pressed={memo.done}
                      aria-label={memo.done ? '取消完成' : '标记完成'}
                      onClick={() => void toggleDone(memo)}
                    >
                      <span className="space-box">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
                          <path d="M20 7L9 18 4 13" />
                        </svg>
                      </span>
                    </button>

                    <button
                      type="button"
                      className="space-memo-main"
                      onClick={() => startEdit(memo)}
                      title="点一下修改"
                    >
                      <span className="space-memo-text">{memo.body}</span>
                      <span className="space-memo-meta">
                        {due && (
                          <span className={`space-tag space-tag-${due.tone}`}>{due.text}</span>
                        )}
                        {memo.done && memo.done_at && <span>完成于 {formatDate(memo.done_at)}</span>}
                        {!memo.done && <span>{formatDate(memo.created_at)}</span>}
                      </span>
                    </button>

                    <button
                      type="button"
                      className="space-del"
                      aria-label="删除"
                      onClick={() => remove(memo)}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                        <path d="M6 7h12M9 7V5h6v2M8 7l1 12h6l1-12" />
                      </svg>
                    </button>
                  </article>
                )
              })}

              {hasNext && (
                <button
                  type="button"
                  className="space-button space-more"
                  disabled={status === 'loading'}
                  onClick={list.loadMore}
                >
                  {status === 'loading' ? '加载中…' : '加载更多'}
                </button>
              )}
            </div>
          )}
        </>
      ) : (
        <SpaceCalendar
          memos={calendarQuery.data ?? []}
          status={calendarQuery.status}
          error={calendarQuery.error}
          initialDay={initialDay}
          onRetry={calendarQuery.reload}
          onToggleDone={(memo) => void toggleDoneInCalendar(memo)}
          onCreate={createFromCalendar}
        />
      )}

      {dialog}
    </>
  )
}
