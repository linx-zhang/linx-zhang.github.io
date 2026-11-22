import { useMemo, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import type { Memo } from '@/api/memos'
import { errorMessage } from '@/api/errors'
import { MEMO_BODY_MAX } from '@/constants'
import { formatDate } from '@/utils/format'
import { addMonths, dayNumber, isOutsideMonth, monthGrid, parseDay, startOfMonth, today } from '@/utils/calendar'
import './SpaceCalendar.css'

/**
 * 个人空间的月历视图：只做一件事——把 `due_at` 摊到月网格上看。
 *
 * 四条约定：
 * 1. 一律按「本地日 YYYY-MM-DD」分组。`due_at` 在库里是 UTC datetime（本地当天 23:59:59
 *    换算而来），直接切字符串会差一天，必须走 `formatDate` 转成本地日。
 * 2. 没有 `due_at` 的条目不上网格，单独收在下面的「未排到期日」里，否则它们在月历里凭空消失。
 * 3. 组件不取数：`memos` 由调用方一次性取全量传进来，勾选完成也回调给调用方落库，
 *    保证列表视图与月历视图只有一份写入路径。
 * 4. 新增也走调用方：输入区只收集「内容 + 当前选中的那一天」，到期时刻统一由父组件换算落库。
 */

const CAL_WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'] as const

interface SpaceCalendarProps {
  memos: Memo[]
  /** 与 useResource 的四态对齐；missing 在月历里按「暂无数据」处理 */
  status: 'loading' | 'ready' | 'error' | 'missing'
  error: string
  /** 带着某一天进来（万年历点「查看我的待办」时传） */
  initialDay?: string
  onRetry: () => void
  onToggleDone: (memo: Memo) => void
  /** 在当前选中的那一天新增一条；失败时抛出，由输入区就地显示 */
  onCreate: (body: string, day: string) => Promise<void>
}

function monthTitle(month: Date): string {
  return `${month.getFullYear()} 年 ${month.getMonth() + 1} 月`
}

/** 「10 月 12 日 星期一」 */
function dayTitle(day: string): string {
  const date = parseDay(day)
  return `${date.getMonth() + 1} 月 ${date.getDate()} 日 星期${CAL_WEEKDAYS[(date.getDay() + 6) % 7]}`
}

export default function SpaceCalendar({
  memos,
  status,
  error,
  initialDay,
  onRetry,
  onToggleDone,
  onCreate,
}: SpaceCalendarProps) {
  const todayKey = today()
  const [cursor, setCursor] = useState(() => startOfMonth(initialDay ?? todayKey))
  const [selected, setSelected] = useState(() => initialDay ?? todayKey)
  // 「未排到期日」默认折叠：它只是提示，不该抢月历的面积
  const [showUndated, setShowUndated] = useState(false)
  // 面板里的「在这天记一条」：不弹窗，就地展开，到期日永远跟着当前选中的格子走
  const [composing, setComposing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [composeError, setComposeError] = useState('')
  const draftRef = useRef<HTMLTextAreaElement>(null)

  const cells = useMemo(() => monthGrid(cursor, 1), [cursor])

  /** 本地日 → 当天到期的条目（未完成在前，同状态按创建时间倒序） */
  const byDay = useMemo(() => {
    const map = new Map<string, Memo[]>()
    const undated: Memo[] = []
    for (const memo of memos) {
      if (!memo.due_at) {
        undated.push(memo)
        continue
      }
      const day = formatDate(memo.due_at)
      const list = map.get(day)
      if (list) list.push(memo)
      else map.set(day, [memo])
    }
    for (const list of map.values()) {
      list.sort((a, b) => Number(a.done) - Number(b.done) || (a.created_at < b.created_at ? 1 : -1))
    }
    return { map, undated }
  }, [memos])

  const dayMemos = byDay.map.get(selected) ?? []

  const pick = (day: string) => {
    // 换一天就把草稿丢掉：输入区的「到期日」跟着格子走，别让上一格的文字落到新日期上
    if (day !== selected) {
      setDraft('')
      setComposeError('')
    }
    setSelected(day)
    const date = parseDay(day)
    if (date.getMonth() !== cursor.getMonth() || date.getFullYear() !== cursor.getFullYear()) {
      setCursor(startOfMonth(day))
    }
  }

  const goToday = () => {
    setSelected(todayKey)
    setCursor(startOfMonth(todayKey))
  }

  const openComposer = () => {
    setComposing(true)
    setComposeError('')
    // 展开后按钮消失、焦点直接落到输入框，手机上也不会出现「点了没反应」
    window.setTimeout(() => draftRef.current?.focus(), 30)
  }

  const closeComposer = () => {
    setComposing(false)
    setDraft('')
    setComposeError('')
  }

  const submitDraft = async (event?: FormEvent) => {
    event?.preventDefault()
    const text = draft.trim()
    if (!text) {
      setComposeError('写点什么再添加')
      draftRef.current?.focus()
      return
    }
    if (text.length > MEMO_BODY_MAX) {
      setComposeError(`一条最多 ${MEMO_BODY_MAX} 个字符`)
      return
    }
    setSaving(true)
    setComposeError('')
    try {
      await onCreate(text, selected)
      setDraft('')
      // 连续录入：清空但保持展开与焦点，回车可以接着写下一条
      window.setTimeout(() => draftRef.current?.focus(), 30)
    } catch (cause) {
      setComposeError(errorMessage(cause))
    } finally {
      setSaving(false)
    }
  }

  const onDraftKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // 中文输入法选词时的回车不能当成保存
    if (event.nativeEvent.isComposing) return
    if (event.key === 'Escape') {
      event.preventDefault()
      closeComposer()
      return
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void submitDraft()
    }
  }

  const selectedLabel = `${parseDay(selected).getMonth() + 1} 月 ${dayNumber(selected)} 日`

  return (
    <div className="space-cal">
      <header className="space-cal-bar">
        <div className="space-cal-month">
          <button
            type="button"
            className="space-cal-nav"
            onClick={() => setCursor(addMonths(cursor, -1))}
            aria-label="上个月"
          >
            ‹
          </button>
          <span className="space-cal-month-text">{monthTitle(cursor)}</span>
          <button
            type="button"
            className="space-cal-nav"
            onClick={() => setCursor(addMonths(cursor, 1))}
            aria-label="下个月"
          >
            ›
          </button>
        </div>
        <button type="button" className="space-button" onClick={goToday}>
          今天
        </button>
      </header>

      {status === 'error' ? (
        <div className="space-state space-state-error">
          <p>{error}</p>
          <button type="button" className="space-button" onClick={onRetry}>
            重试
          </button>
        </div>
      ) : (
        <>
          <div className="space-cal-week" aria-hidden="true">
            {CAL_WEEKDAYS.map((label, index) => (
              <span key={label} className={index >= 5 ? 'is-weekend' : undefined}>
                {label}
              </span>
            ))}
          </div>

          <div className="space-cal-grid" role="grid" aria-label={`${monthTitle(cursor)}的到期日`}>
            {cells.map((day) => {
              const list = byDay.map.get(day) ?? []
              const outside = isOutsideMonth(day, cursor)
              const isToday = day === todayKey
              const isSelected = day === selected
              const hasLate = list.some((memo) => !memo.done && day < todayKey)
              const classes = [
                'space-cal-cell',
                outside ? 'is-outside' : '',
                isToday ? 'is-today' : '',
                isSelected ? 'is-selected' : '',
                list.length > 0 ? (hasLate ? 'has-late' : 'has-memo') : '',
              ]
                .filter(Boolean)
                .join(' ')
              return (
                <button
                  key={day}
                  type="button"
                  role="gridcell"
                  className={classes}
                  aria-label={`${parseDay(day).getMonth() + 1} 月 ${dayNumber(day)} 日${list.length ? `，${list.length} 条到期` : ''}`}
                  aria-selected={isSelected}
                  onClick={() => pick(day)}
                >
                  <span className="space-cal-day">{dayNumber(day)}</span>
                  <span className="space-cal-marks">
                    {list.slice(0, 3).map((memo) => (
                      <span key={memo.id} className={memo.done ? 'is-done' : undefined} />
                    ))}
                    {list.length > 3 && <em>+{list.length - 3}</em>}
                  </span>
                </button>
              )
            })}
          </div>

          <section className="space-cal-day-panel" aria-live="polite">
            <div className="space-cal-day-head">
              <h2>
                {dayTitle(selected)}
                {status === 'loading' ? ' · 加载中…' : ''}
              </h2>
              {!composing && (
                <button type="button" className="space-cal-add" onClick={openComposer}>
                  <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                    <path d="M8 3v10M3 8h10" />
                  </svg>
                  记一条
                </button>
              )}
            </div>
            {dayMemos.length === 0 ? (
              <p className="space-cal-empty">
                {composing ? '这天还没有条目，写下第一条。' : '这天还没有条目。'}
              </p>
            ) : (
              <ul>
                {dayMemos.map((memo) => (
                  <li key={memo.id} className={memo.done ? 'is-done' : undefined}>
                    <button
                      type="button"
                      className="space-check"
                      aria-pressed={memo.done}
                      aria-label={memo.done ? '取消完成' : '标记完成'}
                      onClick={() => onToggleDone(memo)}
                    >
                      <span className="space-box">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
                          <path d="M20 7L9 18 4 13" />
                        </svg>
                      </span>
                    </button>
                    <span className="space-cal-text">{memo.body}</span>
                    {!memo.done && selected < todayKey && <span className="space-tag space-tag-late">已过期</span>}
                    {memo.done && memo.done_at && (
                      <span className="space-cal-done">完成于 {formatDate(memo.done_at).slice(5)}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {composing && (
              <form className="space-cal-compose" onSubmit={submitDraft} noValidate>
                <div className="space-cal-compose-head">
                  <span className="space-cal-compose-target">
                    到期日 <b>{selectedLabel}</b>
                  </span>
                  <span className="space-cal-compose-hint">Enter 添加 · Shift+Enter 换行</span>
                </div>
                <textarea
                  ref={draftRef}
                  value={draft}
                  rows={2}
                  maxLength={MEMO_BODY_MAX}
                  placeholder="写点什么，比如「交周报」"
                  aria-label={`在 ${selectedLabel} 到期的新条目`}
                  onChange={(event) => {
                    setDraft(event.target.value)
                    setComposeError('')
                    event.target.style.height = 'auto'
                    event.target.style.height = `${Math.min(event.target.scrollHeight, 120)}px`
                  }}
                  onKeyDown={onDraftKeyDown}
                />
                {composeError && <p className="space-error">{composeError}</p>}
                <div className="space-cal-compose-actions">
                  <button type="button" className="space-button" onClick={closeComposer}>
                    取消
                  </button>
                  <button
                    type="submit"
                    className="space-button space-button-primary"
                    disabled={saving || draft.trim().length === 0}
                  >
                    {saving ? '添加中…' : '添加'}
                  </button>
                </div>
              </form>
            )}
          </section>
        </>
      )}

      {byDay.undated.length > 0 && (
        <section className="space-cal-undated">
          <button
            type="button"
            className="space-cal-undated-toggle"
            aria-expanded={showUndated}
            onClick={() => setShowUndated(!showUndated)}
          >
            未排到期日 {byDay.undated.length} 条
            <span aria-hidden="true">{showUndated ? '收起' : '展开'}</span>
          </button>
          {showUndated && (
            <ul>
              {byDay.undated.map((memo) => (
                <li key={memo.id} className={memo.done ? 'is-done' : undefined}>
                  <button
                    type="button"
                    className="space-check"
                    aria-pressed={memo.done}
                    aria-label={memo.done ? '取消完成' : '标记完成'}
                    onClick={() => onToggleDone(memo)}
                  >
                    <span className="space-box">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
                        <path d="M20 7L9 18 4 13" />
                      </svg>
                    </span>
                  </button>
                  <span className="space-cal-text">{memo.body}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}
