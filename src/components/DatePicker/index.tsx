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

/** 快捷选择：相对「今天」的天数偏移 */
const QUICK_ITEMS = [
  { label: '今天', offset: 0 },
  { label: '明天', offset: 1 },
  { label: '一周后', offset: 7 },
] as const

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
  /**
   * 「今天」每次渲染现算，不再在挂载时捕一次。
   * 之前用 useState 捕获：页面从昨晚一直开着，第二天点「今天 / 明天 / 一周后」
   * 拿到的仍是昨天的日期，看上去就像自己跳了一天。
   */
  const today = todayDay()
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(value ?? today))
  const [focusDay, setFocusDay] = useState(() => value ?? today)

  const { open, position, triggerRef, panelRef, openPanel, closePanel } = useFloatingPanel({
    estimateHeight: PANEL_ESTIMATE_HEIGHT,
    minWidth: PANEL_MIN_WIDTH,
  })

  const days = monthGrid(viewMonth)

  const openCalendar = () => {
    if (disabled) return
    // 锚点同样现算：正在编辑的条目有值时从它出发，没值时从「真的今天」出发
    const anchor = value ?? todayDay()
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
    // preventScroll：面板本来就贴着触发器算出位置，聚焦不应再带着页面跳一下
    node?.focus({ preventScroll: true })
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
              {/* 快捷项直接标出落到哪一天：只写「明天」时用户看不出月份，
                  跨月就容易被读成「下个月的那一天」 */}
              {QUICK_ITEMS.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  className="date-quick-item date-quick-stacked"
                  onClick={() => pick(addDays(today, item.offset))}
                >
                  <span>{item.label}</span>
                  <span className="date-quick-day">{addDays(today, item.offset).slice(5)}</span>
                </button>
              ))}
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
