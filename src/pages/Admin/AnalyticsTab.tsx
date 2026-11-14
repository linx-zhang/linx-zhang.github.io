import { useCallback, useMemo, useState } from 'react'
import { adminApi } from '@/api/admin'
import type { AnalyticsActor, AnalyticsSummary } from '@/api/admin'
import ListState from '@/components/ListState'
import { useResource } from '@/hooks/useResource'
import { parseServerTimestamp } from '@/utils/format'

const DAY_OPTIONS = [7, 30] as const

/**
 * IP 只在这里脱敏显示：库里存全量是为了能把同一地址的多次访问串起来，
 * 但页面上没必要把完整地址摆在最显眼的位置。
 */
function maskIp(ip: string | null): string {
  if (!ip) return '—'
  if (ip.includes(':')) {
    const groups = ip.split(':')
    return `${groups.slice(0, 2).join(':')}:…`
  }
  const parts = ip.split('.')
  if (parts.length !== 4) return ip
  return `${parts[0]}.${parts[1]}.*.*`
}

function formatDwell(ms: number): string {
  if (ms <= 0) return '—'
  if (ms < 1000) return `${ms} 毫秒`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} 秒`
  const minutes = Math.floor(ms / 60_000)
  const seconds = Math.round((ms % 60_000) / 1000)
  return `${minutes} 分 ${seconds} 秒`
}

function formatMoment(value: string): string {
  const date = parseServerTimestamp(value)
  if (!date) return value
  const pad = (input: number) => String(input).padStart(2, '0')
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(
    date.getMinutes(),
  )}`
}

function actorLabel(actor: AnalyticsActor): string {
  if (actor.user_email) return actor.user_email
  if (actor.user_id !== null) return `#${actor.user_id}`
  return '匿名访客'
}

function actorPlace(actor: AnalyticsActor): string {
  const pieces = [actor.country, actor.region, actor.city].filter(Boolean)
  return pieces.length > 0 ? pieces.join(' · ') : '未知'
}

/** 每日浏览量柱图：只用 div 高度，不引图表库。 */
function TrendBars({ summary }: { summary: AnalyticsSummary }) {
  const max = Math.max(1, ...summary.series.map((day) => day.page_views))
  return (
    <div className="analytics-chart" role="img" aria-label="每日页面浏览量">
      {summary.series.map((day) => {
        const height = day.page_views === 0 ? 0 : Math.max(6, Math.round((day.page_views / max) * 100))
        return (
          <div key={day.date} className="analytics-bar-slot">
            <span className="analytics-bar-value" title={`${day.page_views} 次浏览`}>
              {day.page_views}
            </span>
            <div className="analytics-bar" style={{ height: `${height}%` }} />
            <span className="analytics-bar-date">{day.date.slice(5)}</span>
          </div>
        )
      })}
    </div>
  )
}

export default function AnalyticsTab() {
  const [days, setDays] = useState<number>(DAY_OPTIONS[0])
  const [expanded, setExpanded] = useState<string | null>(null)

  const summaryQuery = useResource<AnalyticsSummary>(
    () => adminApi.getAnalyticsSummary(days),
    [days],
  )
  const summary = summaryQuery.data

  const toggle = useCallback((key: string) => {
    setExpanded((current) => (current === key ? null : key))
  }, [])

  const totals = useMemo(() => {
    if (!summary) return null
    return summary.series.reduce(
      (acc, day) => ({
        views: acc.views + day.page_views,
        actors: Math.max(acc.actors, day.actors),
      }),
      { views: 0, actors: 0 },
    )
  }, [summary])

  return (
    <section className="activity-section">
      <div className="analytics-toolbar">
        <div className="analytics-range" role="group" aria-label="统计区间">
          {DAY_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              className={
                option === days ? 'analytics-range-btn active' : 'analytics-range-btn'
              }
              aria-pressed={option === days}
              onClick={() => setDays(option)}
            >
              近 {option} 天
            </button>
          ))}
        </div>
        <span className="analytics-hint">
          按北京时间（UTC{summary ? `+${summary.timezone_offset_hours}` : '+8'}）分桶
        </span>
      </div>

      <ListState
        status={summaryQuery.status}
        error={summaryQuery.error}
        onRetry={summaryQuery.reload}
        missingText="统计接口尚未部署，请等待后端上线后重试。"
      />

      {summaryQuery.status === 'ready' && summary && (
        <>
          <div className="analytics-cards">
            <div className="analytics-card">
              <span className="analytics-card-label">今日新增用户</span>
              <strong>{summary.today.new_users}</strong>
            </div>
            <div className="analytics-card">
              <span className="analytics-card-label">今日活跃用户</span>
              <strong>{summary.today.active_users}</strong>
            </div>
            <div className="analytics-card">
              <span className="analytics-card-label">今日匿名访客</span>
              <strong>{summary.today.anonymous_visitors}</strong>
            </div>
            <div className="analytics-card">
              <span className="analytics-card-label">今日页面浏览</span>
              <strong>{summary.today.page_views}</strong>
            </div>
          </div>

          <div className="invite-list-head">
            <h2 className="admin-section-title">每日浏览</h2>
            <span className="invite-total">
              {totals ? `区间 ${totals.views} 次浏览` : ''}
            </span>
          </div>
          {summary.series.length > 0 ? (
            <TrendBars summary={summary} />
          ) : (
            <div className="user-empty">这段时间还没有任何访问记录。</div>
          )}

          <div className="invite-list-head">
            <h2 className="admin-section-title">访问者</h2>
            <span className="invite-total">
              {summary.actors.length} 个身份
              {summary.has_next ? '（已截断，只显示最近 60 个）' : ''}
            </span>
          </div>

          {summary.actors.length === 0 && <div className="user-empty">没有访问者。</div>}

          {summary.actors.length > 0 && (
            <div className="analytics-list">
              <div className="analytics-list-head" aria-hidden="true">
                <span>身份</span>
                <span>IP / 地区</span>
                <span>浏览</span>
                <span>停留</span>
                <span>最近</span>
              </div>
              {summary.actors.map((actor) => {
                const open = expanded === actor.key
                return (
                  <div key={actor.key} className="analytics-item">
                    <button
                      type="button"
                      className={open ? 'analytics-row open' : 'analytics-row'}
                      aria-expanded={open}
                      onClick={() => toggle(actor.key)}
                    >
                      <span className="analytics-identity" data-label="身份">
                        {actorLabel(actor)}
                      </span>
                      <span className="analytics-network" data-label="IP / 地区">
                        <code>{maskIp(actor.ip)}</code>
                        <em>{actorPlace(actor)}</em>
                      </span>
                      <span data-label="浏览">{actor.page_views}</span>
                      <span data-label="停留">{formatDwell(actor.dwell_ms)}</span>
                      <span data-label="最近">{formatMoment(actor.last_seen)}</span>
                    </button>

                    {open && (
                      <div className="analytics-paths">
                        {actor.paths.length === 0 && <p>这个身份没有页面明细。</p>}
                        {actor.paths.map((path) => (
                          <div key={path.path} className="analytics-path-row">
                            <code>{path.path}</code>
                            <span>{path.views} 次</span>
                            <span>{formatDwell(path.dwell_ms)}</span>
                          </div>
                        ))}
                        {actor.paths.length > 0 && (
                          <p className="analytics-paths-note">
                            只列出停留时间最长的前 8 个页面；停留时长来自离开事件（page_leave），
                            直接关掉标签页的那一次不会计入。
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </section>
  )
}
