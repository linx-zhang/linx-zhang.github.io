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
// 匿名访客走独立端点：不需要登录，服务端按 IP 限流并补 ip/地区
const VISITOR_URL = `${API_BASE}/activity/visitor`
const MAX_BATCH = 50
// 匿名端点单批上限更小（后端 20），少发一次总比被 422 丢掉好
const MAX_VISITOR_BATCH = 20
const MAX_QUEUED = 200
const HEARTBEAT_INTERVAL_MS = 60_000
const FLUSH_DELAY_MS = 300
const MAX_PATH_LENGTH = 512

// 匿名只公开内容页：和 pages function 的 allow-list 保持一致，
// 这样后台/个人页的访问不会以匿名身份进表
const PUBLIC_PATH_ROOTS = ['/blog', '/wiki']

// 匿名端点的服务端限流窗口（与后端 VISITOR_RATE_LIMIT_SECONDS 一致）：
// 客户端自己排开批次，免得多发的 page_view 被 429 丢掉
const VISITOR_WINDOW_MS = 30_000

// 事件先入内存队列，批量提交；模块级状态保证路由切换不会重建队列。
let queue: ActivityEvent[] = []
let flushTimer: number | null = null
let inFlight = false
let lastVisitorPostAt = 0

function currentPath(): string {
  const { pathname, search } = window.location
  return `${pathname}${search}`.slice(0, MAX_PATH_LENGTH) || '/'
}

function isPublicPath(path: string): boolean {
  const bare = path.split('?')[0].split('#')[0]
  if (bare === '/') return true
  return PUBLIC_PATH_ROOTS.some((root) => bare === root || bare.startsWith(`${root}/`))
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
    // 匿名批次要等窗口过期再发：提前发的 page_view 会被服务端 429 丢掉，
    // 攒到下一次 page_leave 一起发就必然会入库（含 leave 的批次总是放行）
    const waited = Date.now() - lastVisitorPostAt
    if (lastVisitorPostAt !== 0 && waited < VISITOR_WINDOW_MS) {
      scheduleFlush(VISITOR_WINDOW_MS - waited)
      return
    }
    lastVisitorPostAt = Date.now()
  }
  const batch = queue.splice(0, token ? MAX_BATCH : MAX_VISITOR_BATCH)
  inFlight = true
  try {
    await fetch(token ? ACTIVITY_URL : VISITOR_URL, {
      method: 'POST',
      headers: token
        ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
        : { 'Content-Type': 'application/json' },
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
  const token = getStoredToken()
  // 未登录时只记公开内容页，且不记心跳：匿名心跳会把表刷爆
  if (!token && (event.type === 'heartbeat' || !isPublicPath(event.path))) return
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
 * 页面隐藏/卸载时发送剩余事件：keepalive 让请求在卸载期间继续。
 * 未登录时走匿名端点，同样只能 keepalive（sendBeacon 无法带 JSON 类型）。
 */
function flushWithKeepalive(events: ActivityEvent[]): void {
  if (events.length === 0) return
  const token = getStoredToken()
  const limit = token ? MAX_BATCH : MAX_VISITOR_BATCH
  if (!token) lastVisitorPostAt = Date.now()
  void fetch(token ? ACTIVITY_URL : VISITOR_URL, {
    method: 'POST',
    keepalive: true,
    headers: token
      ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
      : { 'Content-Type': 'application/json' },
    body: JSON.stringify({ events: events.slice(0, limit) }),
  }).catch(() => {
    // 静默丢弃
  })
}

function reportPageLeave(path: string, durationMs: number, ts: number): void {
  clearFlushTimer()
  const token = getStoredToken()
  if (!token && !isPublicPath(path)) {
    // 匿名访客在非公开页（如个人资料页）不留痕
    queue = []
    return
  }
  const pending = queue
  queue = []
  const limit = token ? MAX_BATCH : MAX_VISITOR_BATCH
  const events = [...pending.slice(0, limit - 1), {
    type: 'page_leave' as ActivityType,
    path,
    ts,
    duration_ms: Math.max(0, Math.round(durationMs)),
  }]
  flushWithKeepalive(events)
}

/**
 * 登录用户上报 page_view / heartbeat / page_leave；
 * 未登录访客只上报公开内容页的 page_view / page_leave（无心跳）。
 */
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
    const path = `${location.pathname}${location.search}`.slice(0, MAX_PATH_LENGTH) || '/'
    pathRef.current = path
    pageStartRef.current = Date.now()
    leaveSentRef.current = false
    enqueue({ type: 'page_view', path, ts: Date.now() })
  }, [userId, location.pathname, location.search])

  // 页面可见时每 60 秒上报一次心跳（仅登录用户）
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
