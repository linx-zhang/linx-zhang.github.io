import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useFloatingPanel } from '@/components/FloatingPanel/useFloatingPanel'
// 触发按钮与 Select 共用同一套样式，避免两处边框/圆角/高度漂移
import '@/components/Select/Select.css'
import './DateRangePicker.css'

export interface DateRangeValue {
  /** 本地日，YYYY-MM-DD */
  from?: string
  /** 本地日，YYYY-MM-DD */
  to?: string
}

export interface DateRangePickerProps {
  value: DateRangeValue
  onChange: (value: DateRangeValue) => void
  disabled?: boolean
  placeholder?: string
  ariaLabel?: string
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']
const PANEL_MIN_WIDTH = 300
const PANEL_ESTIMATE_HEIGHT = 390

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function toDay(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** 统一取本地中午，避免夏令时切换导致跨日计算偏移 */
function parseDay(day: string): Date {
  const [year, month, date] = day.split('-').map(Number)
  return new Date(year, month - 1, date, 12)
}

function addDays(day: string, delta: number): string {
  const date = parseDay(day)
  date.setDate(date.getDate() + delta)
  return toDay(date)
}

function startOfMonth(day: string): Date {
  const date = parseDay(day)
  return new Date(date.getFullYear(), date.getMonth(), 1, 12)
}

function addMonths(month: Date, delta: number): Date {
  return new Date(month.getFullYear(), month.getMonth() + delta, 1, 12)
}

/** 固定 42 格（6 行），首格为所在周的周日 */
function monthGrid(month: Date): string[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1, 12)
  const start = addDays(toDay(first), -first.getDay())
  return Array.from({ length: 42 }, (_, index) => addDays(start, index))
}

function rangeText(value: DateRangeValue, placeholder: string): string {
  if (value.from && value.to) {
    return value.from === value.to ? value.from : `${value.from} ~ ${value.to}`
  }
  if (value.from) return `${value.from} ~`
  if (value.to) return `~ ${value.to}`
  return placeholder
}

/** 受控日期范围选择：浮层挂 body，单月日历 + 快捷项 */
export default function DateRangePicker({
  value,
  onChange,
  disabled = false,
  placeholder = '全部日期',
  ariaLabel,
}: DateRangePickerProps) {
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(toDay(new Date())))
  const [focusDay, setFocusDay] = useState(() => toDay(new Date()))

  const {
    open,
    position,
    triggerRef,
    panelRef,
    openPanel: openFloating,
    closePanel,
  } = useFloatingPanel({ estimateHeight: PANEL_ESTIMATE_HEIGHT, minWidth: PANEL_MIN_WIDTH })

  const [today] = useState(() => toDay(new Date()))
  const days = monthGrid(viewMonth)
  const hasValue = Boolean(value.from || value.to)

  const openPanel = () => {
    if (disabled) return
    const anchor = value.from ?? today
    setFocusDay(anchor)
    setViewMonth(startOfMonth(anchor))
    openFloating()
  }

  const closeAndRefocus = () => {
    closePanel()
    triggerRef.current?.focus()
  }

  useEffect(() => {
    if (!open) return
    const node = panelRef.current?.querySelector<HTMLButtonElement>(`[data-day="${focusDay}"]`)
    node?.focus()
  }, [open, focusDay, viewMonth, panelRef])

  const pickDay = (day: string) => {
    setFocusDay(day)
    if (!value.from || value.to) {
      // 没有起点，或已有完整范围：重新开始选择
      onChange({ from: day })
      return
    }
    if (day < value.from) {
      onChange({ from: day, to: value.from })
    } else {
      onChange({ from: value.from, to: day })
    }
    closeAndRefocus()
  }

  const pickQuick = (daysBack: number) => {
    onChange({ from: addDays(today, -(daysBack - 1)), to: today })
    closeAndRefocus()
  }

  const clearRange = () => {
    onChange({})
    closeAndRefocus()
  }

  const moveFocus = (delta: number) => {
    const next = addDays(focusDay, delta)
    setFocusDay(next)
    setViewMonth(startOfMonth(next))
  }

  const handlePanelKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
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
        const target = event.target as HTMLElement
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
          title={rangeText(value, placeholder)}
        >
          {rangeText(value, placeholder)}
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
            aria-label={ariaLabel ?? '选择日期范围'}
            style={{ top: position.top, left: position.left, width: position.width }}
            onKeyDown={handlePanelKeyDown}
          >
            <div className="date-quick">
              <button type="button" className="date-quick-item" onClick={() => pickQuick(1)}>
                今天
              </button>
              <button type="button" className="date-quick-item" onClick={() => pickQuick(7)}>
                近 7 天
              </button>
              <button type="button" className="date-quick-item" onClick={() => pickQuick(30)}>
                近 30 天
              </button>
              {hasValue && (
                <button
                  type="button"
                  className="date-quick-item date-quick-clear"
                  onClick={clearRange}
                >
                  清空
                </button>
              )}
            </div>

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
                const outside = parseDay(day).getMonth() !== viewMonth.getMonth()
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
                    {parseDay(day).getDate()}
                  </button>
                )
              })}
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
