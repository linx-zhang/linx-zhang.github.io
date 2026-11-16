import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { API_BASE, getStoredToken } from '@/api/client'
import { useAuth } from '@/auth/AuthProvider'
import { ACTIVITY_MAX_BATCH, ACTIVITY_MAX_VISITOR_BATCH, ACTIVITY_HEARTBEAT_MS, ACTIVITY_VISITOR_DEDUPE_MS, ACTIVITY_VISITOR_WINDOW_MS } from '@/constants'

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
const MAX_QUEUED = 200
const FLUSH_DELAY_MS = 300
const MAX_PATH_LENGTH = 512
/** 匿名批次吃了一次 429 之后最多再试一次，再失败就丢，别把队列卡死 */
const MAX_VISITOR_RETRIES = 1
const VISITOR_STATE_KEY = 'linx.activity.visitor'

// 匿名只公开内容页：和 pages function 的 allow-list 保持一致，
// 这样后台/个人页的访问不会以匿名身份进表
const PUBLIC_PATH_ROOTS = ['/blog', '/wiki']
// 事件先入内存队列，批量提交；模块级状态保证路由切换不会重建队列。
let queue: ActivityEvent[] = []
let flushTimer: number | null = null
let inFlight = false
let visitorRetries = 0

interface VisitorState {
  /** 下一次允许提交匿名批次的时间点：服务端按 IP 限流 30 秒 */
  nextAllowedAt: number
  /** 路径 → 上次上报时间，用于会话内去重 */
  seen: Record<string, number>
}

function loadVisitorState(): VisitorState {
  const empty: VisitorState = { nextAllowedAt: 0, seen: {} }
  try {
    const raw = window.sessionStorage.getItem(VISITOR_STATE_KEY)
    if (!raw) return empty
    const parsed = JSON.parse(raw) as Partial<VisitorState>
    return {
      nextAllowedAt: typeof parsed.nextAllowedAt === 'number' ? parsed.nextAllowedAt : 0,
      seen: parsed.seen && typeof parsed.seen === 'object' ? parsed.seen : {},
    }
  } catch {
    // 隐私模式下 sessionStorage 不可用：退化成纯内存，最坏结果只是多吃一次 429
    return empty
  }
}

function saveVisitorState(): void {
  try {
    window.sessionStorage.setItem(VISITOR_STATE_KEY, JSON.stringify(visitorState))
  } catch {
    // 写不进去就只靠内存里的值
  }
}

// 窗口必须跨刷新保留：页面重载会把模块状态清零，之前正是这样每次进页都立刻发，
// 然后被服务端的 30 秒窗口打回 429。
const visitorState = loadVisitorState()

/** 服务端接受了这批匿名事件：把窗口推到下一个 30 秒 */
function noteVisitorAccepted(): void {
  visitorRetries = 0
  visitorState.nextAllowedAt = Date.now() + ACTIVITY_VISITOR_WINDOW_MS
  saveVisitorState()
}

/** 429：按 Retry-After 退避，多留 1 秒，避免卡在窗口边界上再吃一次 */
function noteVisitorThrottled(retryAfter: string | null): void {
  const seconds = Number(retryAfter)
  const delay = Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : ACTIVITY_VISITOR_WINDOW_MS
  visitorState.nextAllowedAt = Date.now() + delay + 1000
  saveVisitorState()
}

/**
 * 匿名访客同一路径 5 分钟内只上报一次：
 * 重复刷新、来回切页不再产生重复 page_view，这是 429 噪声的主要来源。
 */
function shouldReportVisitorView(path: string): boolean {
  const bare = path.split('?')[0].split('#')[0] || '/'
  const lastAt = visitorState.seen[bare]
  if (lastAt !== undefined && Date.now() - lastAt < ACTIVITY_VISITOR_DEDUPE_MS) return false
  visitorState.seen[bare] = Date.now()
  const keys = Object.keys(visitorState.seen)
  if (keys.length > 50) {
    keys.sort((a, b) => visitorState.seen[b] - visitorState.seen[a])
    for (const key of keys.slice(50)) delete visitorState.seen[key]
  }
  saveVisitorState()
  return true
}

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
    // 匿名窗口没到就等：提前发的批次服务端会以 429 丢掉
    const wait = visitorState.nextAllowedAt - Date.now()
    if (wait > 0) {
      scheduleFlush(wait)
      return
    }
  }
  const batch = queue.splice(0, token ? ACTIVITY_MAX_BATCH : ACTIVITY_MAX_VISITOR_BATCH)
  inFlight = true
  try {
    const response = await fetch(token ? ACTIVITY_URL : VISITOR_URL, {
      method: 'POST',
      headers: token
        ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
        : { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: batch }),
    })
    if (!token) {
      if (response.ok) {
        noteVisitorAccepted()
      } else {
        // 通常是同 IP 的另一台设备 / 另一个标签页刚占用了窗口
        if (response.status === 429) {
          noteVisitorThrottled(response.headers.get('Retry-After'))
          if (visitorRetries < MAX_VISITOR_RETRIES) {
            visitorRetries += 1
            queue.unshift(...batch)
          }
        }
      }
    }
  } catch {
    // 静默丢弃：活跃统计不应干扰正常浏览
  } finally {
    inFlight = false
    if (queue.length > 0) scheduleFlush(0)
  }
}

function enqueue(event: ActivityEvent): void {
  const token = getStoredToken()
  if (!token) {
    // 未登录只记公开内容页的首次进入：心跳会把表刷爆，
    // 重复刷新同一页只会换来一次 429
    if (event.type !== 'page_view' || !isPublicPath(event.path)) return
    if (!shouldReportVisitorView(event.path)) return
  }
  queue.push(event)
  if (queue.length > MAX_QUEUED) queue = queue.slice(queue.length - MAX_QUEUED)
  if (queue.length >= ACTIVITY_MAX_BATCH) {
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
  const limit = token ? ACTIVITY_MAX_BATCH : ACTIVITY_MAX_VISITOR_BATCH
  // 带 page_leave 的批次服务端恒放行，但写入同样会刷新 IP 窗口，所以这里先按已接受处理
  if (!token) noteVisitorAccepted()
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
  const limit = token ? ACTIVITY_MAX_BATCH : ACTIVITY_MAX_VISITOR_BATCH
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
    }, ACTIVITY_HEARTBEAT_MS)
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
