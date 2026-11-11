import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { API_BASE, getStoredToken } from '@/api/client'
import { useAuth } from '@/auth/AuthProvider'

export type ActivityType = 'page_view' | 'heartbeat' | 'page_leave'

export interface ActivityEvent {
  type: ActivityType
  path: string
  ts: number
  duration_ms?: number
}

const ACTIVITY_URL = `${API_BASE}/activity`
const MAX_BATCH = 50
const MAX_QUEUED = 200
const HEARTBEAT_INTERVAL_MS = 60_000
const FLUSH_DELAY_MS = 300
const MAX_PATH_LENGTH = 512

// 事件先入内存队列，批量提交；模块级状态保证路由切换不会重建队列。
let queue: ActivityEvent[] = []
let flushTimer: number | null = null
let inFlight = false

function currentPath(): string {
  const { pathname, search } = window.location
  return `${pathname}${search}`.slice(0, MAX_PATH_LENGTH) || '/'
}

function clearFlushTimer(): void {
  if (flushTimer !== null) {
    window.clearTimeout(flushTimer)
    flushTimer = null
  }
}

function scheduleFlush(delay = FLUSH_DELAY_MS): void {
  if (flushTimer !== null) return
  flushTimer = window.setTimeout(() => {
    flushTimer = null
    void flushQueue()
  }, delay)
}

/** 批量提交队列；失败直接丢弃（不重试、不影响 UI）。 */
async function flushQueue(): Promise<void> {
  if (inFlight || queue.length === 0) return
  const token = getStoredToken()
  if (!token) {
    queue = []
    return
  }
  const batch = queue.splice(0, MAX_BATCH)
  inFlight = true
  try {
    await fetch(ACTIVITY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ events: batch }),
    })
  } catch {
    // 静默丢弃：活跃统计不应干扰正常浏览
  } finally {
    inFlight = false
    if (queue.length > 0) scheduleFlush(0)
  }
}

function enqueue(event: ActivityEvent): void {
  queue.push(event)
  if (queue.length > MAX_QUEUED) queue = queue.slice(queue.length - MAX_QUEUED)
  if (queue.length >= MAX_BATCH) {
    clearFlushTimer()
    void flushQueue()
    return
  }
  scheduleFlush()
}

/**
 * 页面隐藏/卸载时发送剩余事件：keepalive 让请求在卸载期间继续，
 * 同时能携带 Authorization 头（sendBeacon 无法附加请求头，后端只认 Bearer）。
 */
function flushWithKeepalive(events: ActivityEvent[]): void {
  if (events.length === 0) return
  const token = getStoredToken()
  if (!token) return
  void fetch(ACTIVITY_URL, {
    method: 'POST',
    keepalive: true,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ events: events.slice(0, MAX_BATCH) }),
  }).catch(() => {
    // 静默丢弃
  })
}

function reportPageLeave(path: string, durationMs: number, ts: number): void {
  clearFlushTimer()
  const pending = queue
  queue = []
  const events = [...pending.slice(0, MAX_BATCH - 1), {
    type: 'page_leave' as ActivityType,
    path,
    ts,
    duration_ms: Math.max(0, Math.round(durationMs)),
  }]
  flushWithKeepalive(events)
}

/** 仅在登录状态下上报活跃事件；未登录完全不上报。 */
export function useActivityTracker(): void {
  const { user } = useAuth()
  const location = useLocation()
  const userId = user?.id ?? null

  const pageStartRef = useRef(0)
  const pathRef = useRef('')
  // 一次隐藏周期内只发一条 page_leave：visibilitychange 与 pagehide 可能先后触发
  const leaveSentRef = useRef(false)

  // 路由变化：上报 page_view，并重置本页停留计时
  useEffect(() => {
    if (userId === null) return
    const path = `${location.pathname}${location.search}`.slice(0, MAX_PATH_LENGTH) || '/'
    pathRef.current = path
    pageStartRef.current = Date.now()
    leaveSentRef.current = false
    enqueue({ type: 'page_view', path, ts: Date.now() })
  }, [userId, location.pathname, location.search])

  // 页面可见时每 60 秒上报一次心跳
  useEffect(() => {
    if (userId === null) return
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      enqueue({ type: 'heartbeat', path: pathRef.current || currentPath(), ts: Date.now() })
    }, HEARTBEAT_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [userId])

  // 隐藏 / 离开：带 duration_ms 上报 page_leave
  useEffect(() => {
    if (userId === null) return
    const reportLeave = () => {
      if (leaveSentRef.current) return
      leaveSentRef.current = true
      const now = Date.now()
      reportPageLeave(pathRef.current || currentPath(), now - pageStartRef.current, now)
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        reportLeave()
      } else {
        leaveSentRef.current = false
        pageStartRef.current = Date.now()
      }
    }
    const onPageHide = () => reportLeave()
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pagehide', onPageHide)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pagehide', onPageHide)
    }
  }, [userId])
}
