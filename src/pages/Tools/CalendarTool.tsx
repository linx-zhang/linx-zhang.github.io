import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  addMonths,
  dayNumber,
  isOutsideMonth,
  monthGrid,
  parseDay,
  startOfMonth,
  today,
} from '@/utils/calendar'
import { cellLabel, describeDetail } from '@/utils/lunar'
import './Tools.css'

/** 万年历按周一开头排，与 WEEKDAYS 的默认顺序（周日开头）相反 */
const CAL_WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'] as const

function monthTitle(month: Date): string {
  return `${month.getFullYear()} 年 ${month.getMonth() + 1} 月`
}

export default function CalendarTool() {
  // 支持 ?date=YYYY-MM-DD 带着某一天进来（个人空间页头点日期就跳这里）
  const [params] = useSearchParams()
  const initial = useMemo(() => {
    const raw = params.get('date')
    return raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : today()
  }, [params])

  const [selected, setSelected] = useState(initial)
  const [cursor, setCursor] = useState(() => startOfMonth(initial))

  const cells = useMemo(() => monthGrid(cursor, 1), [cursor])
  const detail = useMemo(() => describeDetail(selected), [selected])
  const todayKey = today()

  const pick = (day: string) => {
    setSelected(day)
    // 点到上/下月的格子时，顺手把视图切到那个月
    const date = parseDay(day)
    if (date.getMonth() !== cursor.getMonth() || date.getFullYear() !== cursor.getFullYear()) {
      setCursor(startOfMonth(day))
    }
  }

  const goToday = () => {
    const key = today()
    setSelected(key)
    setCursor(startOfMonth(key))
  }

  return (
    <div className="cal-wrap">
      <div className="cal-main">
        <header className="cal-bar">
          <div className="cal-month">
            <button type="button" className="cal-nav" onClick={() => setCursor(addMonths(cursor, -1))} aria-label="上个月">
              ‹
            </button>
            <span className="cal-month-text">{monthTitle(cursor)}</span>
            <button type="button" className="cal-nav" onClick={() => setCursor(addMonths(cursor, 1))} aria-label="下个月">
              ›
            </button>
          </div>
          <button type="button" className="tool-button" onClick={goToday}>
            今天
          </button>
        </header>

        <div className="cal-week">
          {CAL_WEEKDAYS.map((label, index) => (
            <span key={label} className={index >= 5 ? 'is-weekend' : undefined}>
              {label}
            </span>
          ))}
        </div>

        <div className="cal-grid">
          {cells.map((day) => {
            const label = cellLabel(day)
            const outside = isOutsideMonth(day, cursor)
            const isToday = day === todayKey
            const isSelected = day === selected
            const classes = [
              'cal-cell',
              outside ? 'is-outside' : '',
              isToday ? 'is-today' : '',
              isSelected ? 'is-selected' : '',
            ]
              .filter(Boolean)
              .join(' ')
            return (
              <button
                key={day}
                type="button"
                className={classes}
                aria-current={isToday ? 'date' : undefined}
                aria-label={`${parseDay(day).getMonth() + 1} 月 ${dayNumber(day)} 日 ${label.text}`}
                onClick={() => pick(day)}
              >
                <span className="cal-cell-day">{dayNumber(day)}</span>
                <span className={`cal-cell-lunar is-${label.kind ?? 'plain'}`}>{label.text}</span>
              </button>
            )
          })}
        </div>
      </div>

      <section className="cal-detail">
        <p className="cal-detail-solar">{detail.solarText}</p>
        <p className="cal-detail-lunar">
          农历 {detail.lunarText} · {detail.yearText}
        </p>
        {detail.special ? (
          <p className="cal-detail-badge">
            {detail.specialKind === 'jieqi' ? '节气' : '节日'} · {detail.special}
          </p>
        ) : (
          detail.next && (
            <p className="cal-detail-next">
              距{detail.next.name}还有 {detail.next.days} 天（{detail.next.day.slice(5).replace('-', ' 月 ')} 日）
            </p>
          )
        )}
      </section>
    </div>
  )
}
