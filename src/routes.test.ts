import { describe, expect, it } from 'vitest'
import { isKnownDeepLink } from './routes'

describe('isKnownDeepLink', () => {
  it('个人空间的板块子路径刷新不会被 404 兜底吃掉', () => {
    expect(isKnownDeepLink('/space/memos')).toBe(true)
    expect(isKnownDeepLink('/space/consumables?view=calendar')).toBe(true)
    expect(isKnownDeepLink('/space')).toBe(true)
  })

  it('非应用路径仍交给 404', () => {
    expect(isKnownDeepLink('/spaceship')).toBe(false)
  })
})
