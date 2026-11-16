import { describe, expect, it } from 'vitest'
import {
  EMPTY_VISITOR_BUDGET,
  VISITOR_SEEN_LIMIT,
  VISITOR_THROTTLE_MARGIN_MS,
  acceptVisitorBatch,
  barePath,
  decideVisitorReport,
  isVisitorTrackablePath,
  parseVisitorBudget,
  serializeVisitorBudget,
  takeBatch,
  throttleVisitorBudget,
  visitorWaitMs,
} from './visitorBudget'
import { ACTIVITY_VISITOR_DEDUPE_MS, ACTIVITY_VISITOR_WINDOW_MS } from '@/constants'

describe('parseVisitorBudget', () => {
  it('把空值 / 坏 JSON / 错误形状都退化成空预算', () => {
    expect(parseVisitorBudget(null)).toEqual(EMPTY_VISITOR_BUDGET)
    expect(parseVisitorBudget('')).toEqual(EMPTY_VISITOR_BUDGET)
    expect(parseVisitorBudget('{oops')).toEqual(EMPTY_VISITOR_BUDGET)
    expect(parseVisitorBudget('{"nextAllowedAt":"soon","seen":[1,2]}')).toEqual(
      EMPTY_VISITOR_BUDGET,
    )
  })

  it('丢掉非数字的 seen 值，保留合法部分', () => {
    const budget = parseVisitorBudget('{"nextAllowedAt":1760000000000,"seen":{"/blog":1,"/wiki":"x"}}')
    expect(budget.nextAllowedAt).toBe(1760000000000)
    expect(budget.seen).toEqual({ '/blog': 1 })
  })

  it('序列化后能原样读回', () => {
    const budget = { nextAllowedAt: 1760000000000, seen: { '/blog/post/1': 5 } }
    expect(parseVisitorBudget(serializeVisitorBudget(budget))).toEqual(budget)
  })
})

describe('visitorWaitMs / acceptVisitorBatch', () => {
  it('没上报过时可以立刻发，窗口内的等待时间递减到 0', () => {
    expect(visitorWaitMs(EMPTY_VISITOR_BUDGET, 1000)).toBe(0)
    const now = 1_000
    const after = acceptVisitorBatch(EMPTY_VISITOR_BUDGET, now)
    expect(after.nextAllowedAt).toBe(now + ACTIVITY_VISITOR_WINDOW_MS)
    expect(visitorWaitMs(after, now)).toBe(ACTIVITY_VISITOR_WINDOW_MS)
    expect(visitorWaitMs(after, now + ACTIVITY_VISITOR_WINDOW_MS)).toBe(0)
    expect(visitorWaitMs(after, now + ACTIVITY_VISITOR_WINDOW_MS * 2)).toBe(0)
  })
})

describe('throttleVisitorBudget', () => {
  it('按 Retry-After 退避并留下余量', () => {
    const after = throttleVisitorBudget(EMPTY_VISITOR_BUDGET, 1_000, 12)
    expect(after.nextAllowedAt).toBe(1_000 + 12_000 + VISITOR_THROTTLE_MARGIN_MS)
  })

  it('退避不会超过一个完整窗口，缺值 / 非法值退回整窗', () => {
    const huge = throttleVisitorBudget(EMPTY_VISITOR_BUDGET, 1_000, 600)
    expect(huge.nextAllowedAt).toBe(
      1_000 + ACTIVITY_VISITOR_WINDOW_MS + VISITOR_THROTTLE_MARGIN_MS,
    )
    const missing = throttleVisitorBudget(EMPTY_VISITOR_BUDGET, 1_000, null)
    expect(missing.nextAllowedAt).toBe(
      1_000 + ACTIVITY_VISITOR_WINDOW_MS + VISITOR_THROTTLE_MARGIN_MS,
    )
    expect(throttleVisitorBudget(EMPTY_VISITOR_BUDGET, 1_000, -5).nextAllowedAt).toBe(
      1_000 + ACTIVITY_VISITOR_WINDOW_MS + VISITOR_THROTTLE_MARGIN_MS,
    )
  })
})

describe('decideVisitorReport', () => {
  it('首次进入就报，并把去重表推进一格', () => {
    const { budget, report } = decideVisitorReport(EMPTY_VISITOR_BUDGET, '/blog/post/1', 500)
    expect(report).toBe(true)
    expect(budget.seen['/blog/post/1']).toBe(500)
  })

  it('去重间隔内同一路径不再上报，且不动时间戳', () => {
    const first = decideVisitorReport(EMPTY_VISITOR_BUDGET, '/blog', 500)
    const second = decideVisitorReport(first.budget, '/blog', 500 + ACTIVITY_VISITOR_DEDUPE_MS - 1)
    expect(second.report).toBe(false)
    expect(second.budget.seen['/blog']).toBe(500)
  })

  it('过了去重间隔就再次上报', () => {
    const first = decideVisitorReport(EMPTY_VISITOR_BUDGET, '/blog', 500)
    const again = decideVisitorReport(first.budget, '/blog', 500 + ACTIVITY_VISITOR_DEDUPE_MS)
    expect(again.report).toBe(true)
    expect(again.budget.seen['/blog']).toBe(500 + ACTIVITY_VISITOR_DEDUPE_MS)
  })

  it('query / hash 不同仍算同一页，其他路径互不影响', () => {
    const first = decideVisitorReport(EMPTY_VISITOR_BUDGET, '/blog?page=2', 500)
    expect(decideVisitorReport(first.budget, '/blog#top', 600).report).toBe(false)
    expect(decideVisitorReport(first.budget, '/wiki/docs', 600).report).toBe(true)
  })

  it('去重表超过上限时丢最旧的条目', () => {
    let budget = EMPTY_VISITOR_BUDGET
    for (let i = 0; i < VISITOR_SEEN_LIMIT + 5; i += 1) {
      budget = decideVisitorReport(budget, `/wiki/p${i}`, 1_000 + i).budget
    }
    expect(Object.keys(budget.seen)).toHaveLength(VISITOR_SEEN_LIMIT)
    expect(budget.seen['/wiki/p0']).toBeUndefined()
    expect(budget.seen[`/wiki/p${VISITOR_SEEN_LIMIT + 4}`]).toBe(1_000 + VISITOR_SEEN_LIMIT + 4)
  })
})

describe('isVisitorTrackablePath', () => {
  it('只放行首页与公开内容页，后台与个人页不留痕', () => {
    for (const path of ['/', '/blog', '/blog/post/1?x=1', '/wiki', '/wiki/react/intro']) {
      expect(isVisitorTrackablePath(path), path).toBe(true)
    }
    for (const path of ['/space', '/admin', '/profile', '/blogroll']) {
      expect(isVisitorTrackablePath(path), path).toBe(false)
    }
  })
})

describe('takeBatch', () => {
  it('按上限切出批次，剩余保持原顺序', () => {
    const queued = [1, 2, 3, 4, 5]
    expect(takeBatch(queued, 2)).toEqual({ batch: [1, 2], rest: [3, 4, 5] })
    expect(takeBatch(queued, 0)).toEqual({ batch: [], rest: queued })
    expect(takeBatch([], 10)).toEqual({ batch: [], rest: [] })
  })
})

describe('barePath', () => {
  it('剥掉 query 与 fragment，空路径回落成首页', () => {
    expect(barePath('/blog/post/1?page=2#c')).toBe('/blog/post/1')
    expect(barePath('')).toBe('/')
  })
})
