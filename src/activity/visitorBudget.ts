/**
 * 匿名访客上报的三层规则，抽成不依赖 sessionStorage / 网络 / 时钟的纯函数：
 *
 * 1. 窗口：服务端按 IP 限流（30 秒一批），所以两次提交之间必须隔开一个窗口；
 * 2. 去重：同一路径在去重间隔内只上报一次，刷新和来回切页不再重复；
 * 3. 退避：吃到 429 时按 Retry-After 往后推窗口，并允许重试一次。
 *
 * 逻辑放在这里是为了能被单测直接覆盖——它是全站唯一「看不见、坏了也不报错」的模块。
 */
import { ACTIVITY_VISITOR_DEDUPE_MS, ACTIVITY_VISITOR_WINDOW_MS } from '@/constants'

export const VISITOR_BUDGET_KEY = 'linx.activity.visitor'
/** 去重表最多记这么多条路径，超出后丢最旧的 */
export const VISITOR_SEEN_LIMIT = 50
/** 429 退避时多留的余量：卡在窗口边界上再吃一次 429 是最常见的翻车方式 */
export const VISITOR_THROTTLE_MARGIN_MS = 1000

export interface VisitorBudget {
  /** 下一次允许提交匿名批次的时间点（由「上次被接受」或「429」推出来） */
  nextAllowedAt: number
  /** 路径 → 上次上报时间，用于会话内去重 */
  seen: Record<string, number>
}

export const EMPTY_VISITOR_BUDGET: VisitorBudget = { nextAllowedAt: 0, seen: {} }

/** 把存储里的原始字符串解析成预算；坏数据一律退化成空预算，不让一次脏写永久卡住上报 */
export function parseVisitorBudget(raw: string | null | undefined): VisitorBudget {
  if (!raw) return { nextAllowedAt: 0, seen: {} }
  try {
    const parsed = JSON.parse(raw) as Partial<VisitorBudget> | null
    if (!parsed || typeof parsed !== 'object') return { nextAllowedAt: 0, seen: {} }
    const nextAllowedAt = typeof parsed.nextAllowedAt === 'number' && Number.isFinite(parsed.nextAllowedAt)
      ? parsed.nextAllowedAt
      : 0
    const seen = parsed.seen && typeof parsed.seen === 'object' && !Array.isArray(parsed.seen)
      ? parsed.seen
      : {}
    const clean: Record<string, number> = {}
    for (const [key, value] of Object.entries(seen)) {
      if (typeof value === 'number' && Number.isFinite(value)) clean[key] = value
    }
    return { nextAllowedAt, seen: clean }
  } catch {
    return { nextAllowedAt: 0, seen: {} }
  }
}

export function serializeVisitorBudget(budget: VisitorBudget): string {
  return JSON.stringify(budget)
}

/** 还要等多久才允许提交；0 表示现在就能发 */
export function visitorWaitMs(budget: VisitorBudget, now: number): number {
  return Math.max(0, budget.nextAllowedAt - now)
}

/** 服务端接受了这批事件：窗口从这一刻重新开始算 */
export function acceptVisitorBatch(budget: VisitorBudget, now: number): VisitorBudget {
  return { ...budget, nextAllowedAt: now + ACTIVITY_VISITOR_WINDOW_MS }
}

/**
 * 429：按 Retry-After 退避（秒），拿不到合法值就退回一整个窗口。
 * 余量单独加，避免和限流窗口正好对齐。
 */
export function throttleVisitorBudget(
  budget: VisitorBudget,
  now: number,
  retryAfterSeconds: number | null,
): VisitorBudget {
  const seconds = retryAfterSeconds !== null && Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
    ? Math.min(retryAfterSeconds * 1000, ACTIVITY_VISITOR_WINDOW_MS)
    : ACTIVITY_VISITOR_WINDOW_MS
  return { ...budget, nextAllowedAt: now + seconds + VISITOR_THROTTLE_MARGIN_MS }
}

/** 去掉 query / fragment：同一篇内容带不同参数仍然算「同一页」 */
export function barePath(path: string): string {
  return path.split('?')[0].split('#')[0] || '/'
}

// 匿名只公开内容页：和 pages function 的 allow-list 保持一致，
// 这样后台/个人页的访问不会以匿名身份进表
export const PUBLIC_PATH_ROOTS = ['/blog', '/wiki']

export function isVisitorTrackablePath(path: string): boolean {
  const bare = barePath(path)
  if (bare === '/') return true
  return PUBLIC_PATH_ROOTS.some((root) => bare === root || bare.startsWith(`${root}/`))
}

/**
 * 这条匿名 page_view 该不该上报；该报时顺带把去重表推进一格。
 * 返回新预算而不是原地改，是为了让调用方决定何时落盘。
 */
export function decideVisitorReport(
  budget: VisitorBudget,
  path: string,
  now: number,
): { budget: VisitorBudget; report: boolean } {
  const key = barePath(path)
  const lastAt = budget.seen[key]
  if (lastAt !== undefined && now - lastAt < ACTIVITY_VISITOR_DEDUPE_MS) {
    return { budget, report: false }
  }
  const seen: Record<string, number> = { ...budget.seen, [key]: now }
  const keys = Object.keys(seen)
  if (keys.length > VISITOR_SEEN_LIMIT) {
    const stale = keys
      .sort((a, b) => seen[b] - seen[a])
      .slice(VISITOR_SEEN_LIMIT)
    for (const staleKey of stale) delete seen[staleKey]
  }
  return { budget: { ...budget, seen }, report: true }
}

/**
 * 从队列头切出发送的批次：登录用户按大上限，匿名按小上限。
 * 纯函数是为了能断言「切完之后剩下的顺序不乱、超出上限的那部分留在队列里」。
 */
export function takeBatch<T>(queued: T[], limit: number): { batch: T[]; rest: T[] } {
  if (limit <= 0) return { batch: [], rest: queued }
  return { batch: queued.slice(0, limit), rest: queued.slice(limit) }
}
