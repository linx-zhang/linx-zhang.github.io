import { useState } from 'react'

interface Converted {
  local: string
  utc: string
  iso: string
  relative: string
  seconds: string
  millis: string
}

const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

const pad = (value: number) => String(value).padStart(2, '0')

function localText(date: Date): string {
  const ymd = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  const hms = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  return `${ymd} ${hms} ${WEEKDAYS[date.getDay()]}`
}

function utcText(date: Date): string {
  return `${date.toISOString().slice(0, 10)} ${date.toISOString().slice(11, 19)} UTC`
}

/** 中文相对时间：刚刚 / 3 分钟前 / 2 天后 */
function relativeText(date: Date): string {
  const diff = date.getTime() - Date.now()
  const abs = Math.abs(diff)
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour
  const suffix = diff >= 0 ? '后' : '前'

  if (abs < minute) return '刚刚'
  if (abs < hour) return `${Math.round(abs / minute)} 分钟${suffix}`
  if (abs < day) return `${Math.round(abs / hour)} 小时${suffix}`
  if (abs < 30 * day) return `${Math.round(abs / day)} 天${suffix}`
  if (abs < 365 * day) return `${Math.round(abs / (30 * day))} 个月${suffix}`
  return `${Math.round(abs / (365 * day))} 年${suffix}`
}

function convert(raw: string): Converted {
  const text = raw.trim()
  if (!text) throw new Error('先输入时间戳或日期')

  let date: Date
  if (/^-?\d+$/.test(text)) {
    const value = Number(text)
    // 10 位按秒，13 位按毫秒；其它长度按数值大小猜
    const ms = Math.abs(value) >= 1e12 || text.replace('-', '').length >= 12 ? value : value * 1000
    date = new Date(ms)
  } else {
    // 兼容 "2026-11-13 10:30" 这类不带时区的本地写法
    date = new Date(text.replace(' ', 'T'))
    if (Number.isNaN(date.getTime())) date = new Date(text)
  }

  if (Number.isNaN(date.getTime())) throw new Error('认不出这串内容，试试 1750000000 或 2026-11-13')

  return {
    local: localText(date),
    utc: utcText(date),
    iso: date.toISOString(),
    relative: relativeText(date),
    seconds: String(Math.floor(date.getTime() / 1000)),
    millis: String(date.getTime()),
  }
}

export default function TimestampTool() {
  const [raw, setRaw] = useState('')
  const [result, setResult] = useState<Converted | null>(null)
  const [error, setError] = useState('')

  const run = (value: string) => {
    try {
      setResult(convert(value))
      setError('')
    } catch (err) {
      setResult(null)
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const fillNow = () => {
    const now = String(Date.now())
    setRaw(now)
    run(now)
  }

  const rows: { label: string; value: string }[] = result
    ? [
        { label: '本地时间', value: result.local },
        { label: 'UTC', value: result.utc },
        { label: 'ISO 8601', value: result.iso },
        { label: '相对', value: result.relative },
        { label: '秒', value: result.seconds },
        { label: '毫秒', value: result.millis },
      ]
    : []

  return (
    <div className="tool">
      <form
        className="tool-bar"
        onSubmit={(event) => {
          event.preventDefault()
          run(raw)
        }}
      >
        <input
          className="tool-input"
          value={raw}
          spellCheck={false}
          placeholder="1750000000、1750000000000 或 2026-11-13 10:30"
          onChange={(event) => {
            setRaw(event.target.value)
            setError('')
            if (!event.target.value.trim()) setResult(null)
          }}
        />
        <button type="submit" className="tool-button tool-button-primary">
          转换
        </button>
        <button type="button" className="tool-button" onClick={fillNow}>
          现在
        </button>
      </form>

      {error && <p className="tool-error">{error}</p>}

      {result && (
        <dl className="tool-rows">
          {rows.map((row) => (
            <div key={row.label} className="tool-row">
              <dt>{row.label}</dt>
              <dd>
                <code>{row.value}</code>
                <button
                  type="button"
                  className="tool-mini"
                  onClick={() => navigator.clipboard.writeText(row.value).catch(() => {})}
                >
                  复制
                </button>
              </dd>
            </div>
          ))}
        </dl>
      )}

      {!result && !error && (
        <p className="tools-state">输入秒级或毫秒级时间戳，或者直接写日期，两边都能换算。</p>
      )}
    </div>
  )
}
