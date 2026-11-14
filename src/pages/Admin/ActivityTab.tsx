import { useState } from 'react'
import { errorMessage } from '@/api/errors'
import { adminApi } from '@/api/admin'
import type { ActivityItem, ActivityType } from '@/api/admin'
import Select from '@/components/Select'
import DateRangePicker from '@/components/DateRangePicker'
import type { DateRangeValue } from '@/components/DateRangePicker'
import { usePagedList } from '@/hooks/usePagedList'
import { parseServerTimestamp } from '@/utils/format'
import ListState from '@/components/ListState'
import Pager from './Pager'

const TYPE_OPTIONS = [
  { value: '', label: '全部类型' },
  { value: 'page_view', label: '页面浏览' },
  { value: 'heartbeat', label: '心跳' },
  { value: 'page_leave', label: '离开' },
]

interface AppliedFilters {
  userId?: number
  type?: ActivityType
  from?: string
  to?: string
}

function typeLabel(type: string): string {
  return TYPE_OPTIONS.find((option) => option.value === type)?.label ?? type
}

function formatTime(value: string): string {
  const date = parseServerTimestamp(value)
  if (!date) return value
  const pad = (input: number) => String(input).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function formatDuration(value: number | null): string {
  if (value === null || value === undefined) return '—'
  if (value < 1000) return `${value} 毫秒`
  if (value < 60_000) return `${(value / 1000).toFixed(1)} 秒`
  const minutes = Math.floor(value / 60_000)
  const seconds = Math.round((value % 60_000) / 1000)
  return `${minutes} 分 ${seconds} 秒`
}

function startOfDayIso(value: string): string {
  return new Date(`${value}T00:00:00`).toISOString()
}

function endOfDayIso(value: string): string {
  return new Date(`${value}T23:59:59.999`).toISOString()
}

export default function ActivityTab() {
  const [userInput, setUserInput] = useState('')
  const [typeFilter, setTypeFilter] = useState<'' | ActivityType>('')
  const [dateRange, setDateRange] = useState<DateRangeValue>({})
  const [filterError, setFilterError] = useState('')
  const [resolving, setResolving] = useState(false)

  const [applied, setApplied] = useState<AppliedFilters>({})

  // 只有点「查询 / 重置」才换 applied，因此翻页不会把未提交的输入带进请求
  const list = usePagedList<ActivityItem>(
    (limit, offset) =>
      adminApi.listActivity({
        user_id: applied.userId,
        type: applied.type,
        from: applied.from,
        to: applied.to,
        limit,
        offset,
      }),
    { deps: [applied], treat404AsMissing: true },
  )
  const { items, hasNext, pageIndex, status, error: listError } = list

  const applyFilters = async () => {
    const raw = userInput.trim()
    let userId: number | undefined
    setFilterError('')

    if (raw.length > 0) {
      if (/^\d+$/.test(raw)) {
        const parsed = Number(raw)
        if (parsed < 1) {
          setFilterError('用户 ID 必须为正整数')
          return
        }
        userId = parsed
      } else if (raw.includes('@')) {
        setResolving(true)
        try {
          const page = await adminApi.listUsers({ q: raw, limit: 10 })
          const match = page.items.find(
            (item) => item.email.toLowerCase() === raw.toLowerCase(),
          )
          if (!match) {
            setFilterError('未找到该邮箱对应的用户')
            return
          }
          userId = match.id
        } catch (err) {
          setFilterError(errorMessage(err))
          return
        } finally {
          setResolving(false)
        }
      } else {
        setFilterError('请输入用户 ID 或完整邮箱')
        return
      }
    }

    const { from: fromDate, to: toDate } = dateRange
    if (fromDate && toDate && fromDate > toDate) {
      setFilterError('开始日期不能晚于结束日期')
      return
    }

    // 条件变了就回第 1 页：deps 变化会触发重取，reset 负责把页码归零
    list.reset()
    setApplied({
      userId,
      type: typeFilter || undefined,
      from: fromDate ? startOfDayIso(fromDate) : undefined,
      to: toDate ? endOfDayIso(toDate) : undefined,
    })
  }

  const resetFilters = () => {
    setUserInput('')
    setTypeFilter('')
    setDateRange({})
    setFilterError('')
    list.reset()
    setApplied({})
  }

  return (
    <section className="activity-section">
      <div className="activity-toolbar">
        <label className="activity-field activity-field-user">
          <span className="user-search-label">用户</span>
          <input
            type="text"
            value={userInput}
            placeholder="用户 ID 或邮箱"
            onChange={(event) => {
              setUserInput(event.target.value)
              setFilterError('')
            }}
          />
        </label>
        <div className="activity-field activity-field-type">
          <span className="user-search-label">类型</span>
          <Select
            value={typeFilter}
            onChange={(next) => setTypeFilter(next as '' | ActivityType)}
            options={TYPE_OPTIONS}
            ariaLabel="按事件类型筛选"
          />
        </div>
        <div className="activity-field activity-field-range">
          <span className="user-search-label">日期范围</span>
          <DateRangePicker
            value={dateRange}
            onChange={(next) => {
              setDateRange(next)
              setFilterError('')
            }}
            ariaLabel="按日期范围筛选"
          />
        </div>
        <div className="activity-actions">
          <button
            type="button"
            className="blog-button"
            disabled={resolving}
            onClick={resetFilters}
          >
            重置
          </button>
          <button
            type="button"
            className="blog-button comment-submit"
            disabled={resolving}
            onClick={() => void applyFilters()}
          >
            {resolving ? '查询中…' : '查询'}
          </button>
        </div>
      </div>

      {filterError && <p className="comment-error">{filterError}</p>}

      <div className="invite-list-head">
        <h2 className="admin-section-title">活跃日志</h2>
        <span className="invite-total">
          {status === 'ready' ? `第 ${pageIndex + 1} 页 · ${items.length} 条` : ''}
        </span>
      </div>

      <ListState
        status={status}
        error={listError}
        onRetry={list.retry}
        count={items.length}
        emptyText="没有匹配的日志。"
        missingText="日志接口尚未部署，请等待后端上线后重试。"
      />

      {status === 'ready' && items.length > 0 && (
        <div className="activity-list">
          <div className="activity-list-head" aria-hidden="true">
            <span>时间</span>
            <span>用户邮箱</span>
            <span>类型</span>
            <span>路径</span>
            <span>停留时长</span>
          </div>
          {items.map((item) => (
            <div key={item.id} className="activity-row">
              <div className="activity-cell" data-label="时间">
                {formatTime(item.created_at)}
              </div>
              <div className="activity-cell activity-email" data-label="用户">
                {item.user_email
                  ? item.user_email
                  : item.user_id === null
                    ? `匿名${item.ip ? ` · ${item.ip}` : ''}`
                    : `#${item.user_id}`}
              </div>
              <div className="activity-cell" data-label="类型">
                <span className="invite-badge">{typeLabel(item.type)}</span>
              </div>
              <div className="activity-cell activity-path" data-label="路径">
                {item.path}
              </div>
              <div className="activity-cell" data-label="停留时长">
                {formatDuration(item.duration_ms)}
              </div>
            </div>
          ))}
        </div>
      )}

      {status === 'ready' && (pageIndex > 0 || hasNext) && (
        <Pager pageIndex={pageIndex} hasNext={hasNext} onPage={list.goToPage} />
      )}
    </section>
  )
}
