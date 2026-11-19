import { useMemo, useState } from 'react'
import type { Memo } from '@/api/memos'
import { formatDate } from '@/utils/format'
import { addMonths, dayNumber, isOutsideMonth, monthGrid, parseDay, startOfMonth, today } from '@/utils/calendar'

/**
 * 个人空间的月历视图：只做一件事——把 `due_at` 摊到月网格上看。
 *
 * 三条约定：
 * 1. 一律按「本地日 YYYY-MM-DD」分组。`due_at` 在库里是 UTC datetime（本地当天 23:59:59
 *    换算而来），直接切字符串会差一天，必须走 `formatDate` 转成本地日。
 * 2. 没有 `due_at` 的条目不上网格，单独收在下面的「未排到期日」里，否则它们在月历里凭空消失。
 * 3. 组件不取数：`memos` 由调用方一次性取全量传进来，勾选完成也回调给调用方落库，
 *    保证列表视图与月历视图只有一份写入路径。
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
}: SpaceCalendarProps) {
  const todayKey = today()
  const [cursor, setCursor] = useState(() => startOfMonth(initialDay ?? todayKey))
  const [selected, setSelected] = useState(() => initialDay ?? todayKey)
  // 「未排到期日」默认折叠：它只是提示，不该抢月历的面积
  const [showUndated, setShowUndated] = useState(false)

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
            <h2>
              {dayTitle(selected)}
              {status === 'loading' ? ' · 加载中…' : ''}
            </h2>
            {dayMemos.length === 0 ? (
              <p className="space-cal-empty">这天没有到期的条目。</p>
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
