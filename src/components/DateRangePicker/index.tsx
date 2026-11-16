import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useFloatingPanel } from '@/components/FloatingPanel/useFloatingPanel'
import {
  WEEKDAYS,
  addDays,
  addMonths,
  dayNumber,
  isOutsideMonth,
  monthGrid,
  startOfMonth,
  today as todayDay,
} from '@/utils/calendar'
// 触发按钮与 Select 共用同一套样式，避免两处边框/圆角/高度漂移
import '@/components/Select/Select.css'
import './DateRangePicker.css'

export interface DateRangeValue {
  /** 本地日，YYYY-MM-DD */
  from?: string
  /** 本地日，YYYY-MM-DD */
  to?: string
  /** 'HH:mm'，缺省按 00:00 理解（仅时间范围模式使用） */
  fromTime?: string
  /** 'HH:mm'，缺省按 23:59 理解 */
  toTime?: string
}

export interface DateRangePickerProps {
  value: DateRangeValue
  onChange: (value: DateRangeValue) => void
  disabled?: boolean
  /**
   * 是否带时分。默认关闭——博客、备忘录这类按「日」说话的筛选不需要假精度；
   * 活动日志的事件是毫秒时间戳，按天粗筛会损失信息，那里才开。
   */
  withTime?: boolean
  placeholder?: string
  ariaLabel?: string
}

const PANEL_MIN_WIDTH = 344
const PANEL_ESTIMATE_HEIGHT = 372

const DAY_START = '00:00'
const DAY_END = '23:59'

function pad2(input: number): string {
  return String(input).padStart(2, '0')
}

/** 'HH:mm' → 分钟数；非法返回 null */
function parseClock(text: string): number | null {
  const match = /^(\d{1,2}):(\d{1,2})$/.exec(text.trim())
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour > 23 || minute > 59) return null
  return hour * 60 + minute
}

function formatClock(minutes: number): string {
  return `${pad2(Math.floor(minutes / 60))}:${pad2(minutes % 60)}`
}

/** 把「最小可读」的时间串规整：'9:5' → '09:05'，非法则返回 null */
function normalizeClock(text: string): string | null {
  const minutes = parseClock(text)
  return minutes === null ? null : formatClock(minutes)
}

function rangeText(value: DateRangeValue, placeholder: string, withTime: boolean): string {
  // 带时分时年份会重复两遍、把触发器挤爆：两边都是今年，只留 MM-DD
  const label = (day: string, time: string | undefined, fallback: string) => {
    if (!withTime) return day
    return `${day.slice(0, 4) === String(new Date().getFullYear()) ? day.slice(5) : day} ${time ?? fallback}`
  }
  if (value.from && value.to) {
    if (!withTime && value.from === value.to) return value.from
    return `${label(value.from, value.fromTime, DAY_START)} ~ ${label(value.to, value.toTime, DAY_END)}`
  }
  if (value.from) return `${label(value.from, value.fromTime, DAY_START)} ~`
  if (value.to) return `~ ${label(value.to, value.toTime, DAY_END)}`
  return placeholder
}

/** 受控时间范围选择：浮层挂 body，左侧单月日历 + 右侧相对区间，底部为起止与「应用」 */
export default function DateRangePicker({
  value,
  onChange,
  disabled = false,
  withTime = false,
  placeholder = '全部日期',
  ariaLabel,
}: DateRangePickerProps) {
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(todayDay()))
  const [focusDay, setFocusDay] = useState(todayDay)
  // 时分输入是「先打字、再校验」的草稿态：直接绑 value 会在输入 '1' 这种中间态时把光标顶掉
  const [fromTimeText, setFromTimeText] = useState(DAY_START)
  const [toTimeText, setToTimeText] = useState(DAY_END)

  const {
    open,
    position,
    triggerRef,
    panelRef,
    openPanel: openFloating,
    closePanel,
  } = useFloatingPanel({ estimateHeight: PANEL_ESTIMATE_HEIGHT, minWidth: PANEL_MIN_WIDTH })

  const [today] = useState(todayDay)
  const days = monthGrid(viewMonth)
  const hasValue = Boolean(value.from || value.to)

  const openPanel = () => {
    if (disabled) return
    const anchor = value.from ?? today
    setFocusDay(anchor)
    setViewMonth(startOfMonth(anchor))
    setFromTimeText(value.fromTime ?? DAY_START)
    setToTimeText(value.toTime ?? DAY_END)
    openFloating()
  }

  const closeAndRefocus = () => {
    closePanel()
    triggerRef.current?.focus()
  }

  useEffect(() => {
    if (!open) return
    const node = panelRef.current?.querySelector<HTMLButtonElement>(`[data-day="${focusDay}"]`)
    node?.focus({ preventScroll: true })
  }, [open, focusDay, viewMonth, panelRef])

  const pickDay = (day: string) => {
    setFocusDay(day)
    // 起点没了，或两端都齐了：重新开始一段
    if (!value.from || value.to) {
      onChange({ from: day, fromTime: withTime ? DAY_START : undefined })
      return
    }
    const next: DateRangeValue = day < value.from
      ? { from: day, to: value.from, fromTime: withTime ? DAY_START : undefined, toTime: withTime ? DAY_END : undefined }
      : { from: value.from, to: day, fromTime: withTime ? DAY_START : undefined, toTime: withTime ? DAY_END : undefined }
    onChange(next)
    // 不带时分时没有需要再调的参数，点完第二下就直接收起来
    if (!withTime) closeAndRefocus()
  }

  const commitTime = (edge: 'from' | 'to', raw: string) => {
    const normalized = normalizeClock(raw)
    if (normalized === null) return false
    const key = edge === 'from' ? 'fromTime' : 'toTime'
    onChange({ ...value, [key]: normalized })
    return true
  }

  /** 相对区间：'day' 走整日，'hour' 精确到当前时刻 */
  const pickRelative = (daysBack: number, hoursBack?: number) => {
    const now = new Date()
    if (hoursBack) {
      const from = new Date(now.getTime() - hoursBack * 60 * 60 * 1000)
      const toDay = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`
      const fromDay = `${from.getFullYear()}-${pad2(from.getMonth() + 1)}-${pad2(from.getDate())}`
      const fromClock = `${pad2(from.getHours())}:${pad2(from.getMinutes())}`
      const toClock = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`
      setFromTimeText(fromClock)
      setToTimeText(toClock)
      onChange({ from: fromDay, to: toDay, fromTime: fromClock, toTime: toClock })
      return
    }
    const fromDay = addDays(today, -(daysBack - 1))
    setFromTimeText(DAY_START)
    setToTimeText(DAY_END)
    onChange({
      from: fromDay,
      to: today,
      fromTime: withTime ? DAY_START : undefined,
      toTime: withTime ? DAY_END : undefined,
    })
  }

  const clearRange = () => {
    setFromTimeText(DAY_START)
    setToTimeText(DAY_END)
    onChange({})
    closeAndRefocus()
  }

  const timeInvalid =
    (value.from ? parseClock(fromTimeText) === null : false) ||
    (value.to ? parseClock(toTimeText) === null : false)

  const rangeReady = Boolean(value.from && value.to) && !timeInvalid

  const moveFocus = (delta: number) => {
    const next = addDays(focusDay, delta)
    setFocusDay(next)
    setViewMonth(startOfMonth(next))
  }

  const handlePanelKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    // 焦点在时分输入里时，方向键是光标移动，不能抢
    const target = event.target as HTMLElement
    if (target.tagName === 'INPUT') {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeAndRefocus()
      }
      return
    }
    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault()
        moveFocus(-1)
        break
      case 'ArrowRight':
        event.preventDefault()
        moveFocus(1)
        break
      case 'ArrowUp':
        event.preventDefault()
        moveFocus(-7)
        break
      case 'ArrowDown':
        event.preventDefault()
        moveFocus(7)
        break
      case 'Enter':
      case ' ': {
        const day = target.dataset.day
        if (day) {
          event.preventDefault()
          pickDay(day)
        }
        break
      }
      case 'Escape':
        event.preventDefault()
        closeAndRefocus()
        break
      default:
        break
    }
  }

  const handleTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return
    if (!open && (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown')) {
      event.preventDefault()
      openPanel()
      return
    }
    if (open && event.key === 'Escape') {
      event.preventDefault()
      closeAndRefocus()
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={open ? 'select-trigger select-trigger-open' : 'select-trigger'}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => (open ? closePanel() : openPanel())}
        onKeyDown={handleTriggerKeyDown}
      >
        <span
          className={hasValue ? 'select-value' : 'select-value select-placeholder'}
          title={rangeText(value, placeholder, withTime)}
        >
          {rangeText(value, placeholder, withTime)}
        </span>
        <span className="select-arrow" aria-hidden="true">
          ▾
        </span>
      </button>

      {open &&
        position &&
        createPortal(
          <div
            ref={panelRef}
            className="date-panel"
            role="dialog"
            aria-label={ariaLabel ?? '选择时间范围'}
            style={{ top: position.top, left: position.left, width: position.width }}
            onKeyDown={handlePanelKeyDown}
          >
            <div className="date-body">
              <div className="date-cal">
                <div className="date-head">
                  <button
                    type="button"
                    className="date-nav"
                    aria-label="上个月"
                    onClick={() => setViewMonth((month) => addMonths(month, -1))}
                  >
                    ‹
                  </button>
                  <span className="date-title" aria-live="polite">
                    {viewMonth.getFullYear()} 年 {viewMonth.getMonth() + 1} 月
                  </span>
                  <button
                    type="button"
                    className="date-nav"
                    aria-label="下个月"
                    onClick={() => setViewMonth((month) => addMonths(month, 1))}
                  >
                    ›
                  </button>
                </div>

                <div className="date-weekdays" aria-hidden="true">
                  {WEEKDAYS.map((label) => (
                    <span key={label}>{label}</span>
                  ))}
                </div>

                <div className="date-grid" role="grid" aria-label="日期">
                  {days.map((day) => {
                    const outside = isOutsideMonth(day, viewMonth)
                    const isStart = value.from === day
                    const isEnd = value.to === day
                    const from = value.from
                    const to = value.to
                    const inRange = Boolean(from && to && day > from && day < to)
                    const classes = ['date-day']
                    if (outside) classes.push('date-day-outside')
                    if (day === today) classes.push('date-day-today')
                    if (inRange) classes.push('date-day-in-range')
                    if (isStart) classes.push('date-day-start')
                    if (isEnd) classes.push('date-day-end')
                    // 只选了一端时，那一端两侧都收圆角（没有「另一半」要接）
                    if ((isStart && !to) || (isEnd && !from)) classes.push('date-day-single')
                    return (
                      <button
                        key={day}
                        type="button"
                        role="gridcell"
                        data-day={day}
                        tabIndex={day === focusDay ? 0 : -1}
                        aria-selected={isStart || isEnd || inRange}
                        aria-label={`${day}${isStart || isEnd ? '，已选择' : ''}${outside ? '，非本月' : ''}`}
                        className={classes.join(' ')}
                        onClick={() => pickDay(day)}
                        onFocus={() => setFocusDay(day)}
                      >
                        {dayNumber(day)}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="date-side">
                <button type="button" className="date-side-item" onClick={() => pickRelative(1)}>
                  今天
                </button>
                <button type="button" className="date-side-item" onClick={() => pickRelative(7)}>
                  近 7 天
                </button>
                <button type="button" className="date-side-item" onClick={() => pickRelative(30)}>
                  近 30 天
                </button>
                {withTime && (
                  <button
                    type="button"
                    className="date-side-item"
                    onClick={() => pickRelative(0, 24)}
                  >
                    近 24 小时
                  </button>
                )}
                {hasValue && (
                  <button
                    type="button"
                    className="date-side-item date-side-clear"
                    onClick={clearRange}
                  >
                    清空
                  </button>
                )}
              </div>
            </div>

            <div className="date-foot">
              {withTime ? (
                <>
                  <label className="date-field">
                    <span className="date-field-label">开始</span>
                    <span className="date-field-row">
                      <span className={value.from ? 'date-field-date' : 'date-field-date is-empty'}>
                        {value.from ?? '未选'}
                      </span>
                      <input
                        className="date-time-input"
                        value={fromTimeText}
                        disabled={!value.from}
                        inputMode="numeric"
                        maxLength={5}
                        aria-label="开始时间，时:分"
                        onChange={(event) => {
                          setFromTimeText(event.target.value)
                          commitTime('from', event.target.value)
                        }}
                        onBlur={() => {
                          const normalized = normalizeClock(fromTimeText)
                          setFromTimeText(normalized ?? value.fromTime ?? DAY_START)
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault()
                            if (commitTime('from', fromTimeText)) closeAndRefocus()
                          }
                        }}
                      />
                    </span>
                  </label>
                  <label className="date-field">
                    <span className="date-field-label">结束</span>
                    <span className="date-field-row">
                      <span className={value.to ? 'date-field-date' : 'date-field-date is-empty'}>
                        {value.to ?? '未选'}
                      </span>
                      <input
                        className="date-time-input"
                        value={toTimeText}
                        disabled={!value.to}
                        inputMode="numeric"
                        maxLength={5}
                        aria-label="结束时间，时:分"
                        onChange={(event) => {
                          setToTimeText(event.target.value)
                          commitTime('to', event.target.value)
                        }}
                        onBlur={() => {
                          const normalized = normalizeClock(toTimeText)
                          setToTimeText(normalized ?? value.toTime ?? DAY_END)
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault()
                            if (commitTime('to', toTimeText)) closeAndRefocus()
                          }
                        }}
                      />
                    </span>
                  </label>
                  <button
                    type="button"
                    className="blog-button comment-submit date-apply"
                    disabled={!rangeReady}
                    onClick={closeAndRefocus}
                  >
                    应用
                  </button>
                </>
              ) : (
                <>
                  <span className="date-foot-hint">
                    {value.from && value.to
                      ? `${value.from} ~ ${value.to}`
                      : '点两个日期得到区间，点一个只筛那一天'}
                  </span>
                  <button type="button" className="date-apply-ghost" onClick={closeAndRefocus}>
                    完成
                  </button>
                </>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
