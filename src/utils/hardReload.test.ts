import { describe, expect, it } from 'vitest'
import { buildHardReloadUrl } from './hardReload'

describe('buildHardReloadUrl', () => {
  it('带上一次性参数，绕开缓存里的旧 HTML', () => {
    expect(buildHardReloadUrl('https://example.com/space', 12345)).toBe(
      'https://example.com/space?_r=9ix',
    )
  })

  it('保留原有查询参数与 hash，不把页面路由打散', () => {
    expect(buildHardReloadUrl('https://example.com/space?tab=memos#top', 12345)).toBe(
      'https://example.com/space?tab=memos&_r=9ix#top',
    )
  })
})
