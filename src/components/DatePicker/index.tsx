import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useFloatingPanel } from '@/components/FloatingPanel/useFloatingPanel'
// 日历面板沿用 DateRangePicker 的样式，触发器沿用 Select，两处不必各写一套
import '@/components/Select/Select.css'
import '@/components/DateRangePicker/DateRangePicker.css'
import './DatePicker.css'

export interface DatePickerProps {
  /** 本地日，YYYY-MM-DD；空字符串或 null 表示未选 */
  value: string | null
  onChange: (day: string | null) => void
  disabled?: boolean
  placeholder?: string
  ariaLabel?: string
  /** 触发器额外类名（页面按自己的密度调尺寸） */
  triggerClassName?: string
  /** 触发器左侧图标 */
  icon?: React.ReactNode
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']
const PANEL_MIN_WIDTH = 280
const PANEL_ESTIMATE_HEIGHT = 356

const pad = (value: number) => String(value).padStart(2, '0')

function toDay(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** 统一取本地中午，避免夏令时切换导致跨日偏移 */
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

/**
 * 单日选择：全站自绘日历，不走浏览器的原生 date 控件。
 * 原生控件在手机上是系统滚轮、在桌面是浏览器自己的弹窗，两边长得都不一样且很丑。
 */
export default function DatePicker({
  value,
  onChange,
  disabled = false,
  placeholder = '选择日期',
  ariaLabel,
  triggerClassName,
  icon,
}: DatePickerProps) {
  const [today] = useState(() => toDay(new Date()))
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(value ?? today))
  const [focusDay, setFocusDay] = useState(() => value ?? today)

  const { open, position, triggerRef, panelRef, openPanel, closePanel } = useFloatingPanel({
    estimateHeight: PANEL_ESTIMATE_HEIGHT,
    minWidth: PANEL_MIN_WIDTH,
  })

  const days = monthGrid(viewMonth)

  const openCalendar = () => {
    if (disabled) return
    const anchor = value ?? today
    setFocusDay(anchor)
    setViewMonth(startOfMonth(anchor))
    openPanel()
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

  const pick = (day: string | null) => {
    onChange(day)
    closeAndRefocus()
  }

  const moveFocus = (delta: number) => {
    const next = addDays(focusDay, delta)
    setFocusDay(next)
    setViewMonth(startOfMonth(next))
  }

  const onPanelKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
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
        const day = (event.target as HTMLElement).dataset.day
        if (day) {
          event.preventDefault()
          pick(day)
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

  const onTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return
    if (!open && (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown')) {
      event.preventDefault()
      openCalendar()
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
        className={['select-trigger', triggerClassName, 'date-trigger', open ? 'select-trigger-open' : '']
          .filter(Boolean)
          .join(' ')}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => (open ? closePanel() : openCalendar())}
        onKeyDown={onTriggerKeyDown}
      >
        {icon}
        <span className={value ? 'date-trigger-value' : 'date-trigger-value is-empty'}>
          {value ? `${value.slice(5)} 到期` : placeholder}
        </span>
      </button>

      {open &&
        position &&
        createPortal(
          <div
            ref={panelRef}
            className="date-panel"
            role="dialog"
            aria-label={ariaLabel ?? '选择日期'}
            style={{ top: position.top, left: position.left, width: position.width }}
            onKeyDown={onPanelKeyDown}
          >
            <div className="date-quick">
              <button type="button" className="date-quick-item" onClick={() => pick(today)}>
                今天
              </button>
              <button type="button" className="date-quick-item" onClick={() => pick(addDays(today, 1))}>
                明天
              </button>
              <button type="button" className="date-quick-item" onClick={() => pick(addDays(today, 7))}>
                一周后
              </button>
              {value && (
                <button
                  type="button"
                  className="date-quick-item date-quick-clear"
                  onClick={() => pick(null)}
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
                const classes = ['date-day']
                if (outside) classes.push('date-day-outside')
                if (day === today) classes.push('date-day-today')
                if (day === value) classes.push('date-day-start')
                return (
                  <button
                    key={day}
                    type="button"
                    role="gridcell"
                    data-day={day}
                    tabIndex={day === focusDay ? 0 : -1}
                    aria-selected={day === value}
                    aria-label={`${day}${day === value ? '，已选择' : ''}${outside ? '，非本月' : ''}`}
                    className={classes.join(' ')}
                    onClick={() => pick(day)}
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
