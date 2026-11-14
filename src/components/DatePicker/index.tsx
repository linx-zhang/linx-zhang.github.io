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

const PANEL_MIN_WIDTH = 280
const PANEL_ESTIMATE_HEIGHT = 356

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
  const [today] = useState(() => todayDay())
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
                const outside = isOutsideMonth(day, viewMonth)
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
                    {dayNumber(day)}
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
