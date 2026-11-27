import { describe, expect, it } from 'vitest'
import {
  explainRegexError,
  findMatches,
  highlightParts,
  matchesToText,
  replacePreview,
} from './regex'

describe('正则匹配', () => {
  it('找出所有匹配并保留捕获组顺序', () => {
    const result = findMatches('(\\w+)@(\\w+\\.\\w+)', 'gi', 'A@b.com\nc@d.org')
    expect(result.matches).toHaveLength(2)
    expect(result.matches[0].value).toBe('A@b.com')
    expect(result.matches[0].groups.map((group) => group.value)).toEqual(['A', 'b.com'])
    expect(result.matches[1].index).toBe(8)
  })

  it('命名组会带上名字', () => {
    const result = findMatches('(?<user>\\w+)@(?<host>\\w+\\.\\w+)', 'g', 'linx@example.com')
    expect(result.matches[0].groups.some((group) => group.name === 'user')).toBe(true)
    expect(result.matches[0].groups.find((group) => group.name === 'host')?.value).toBe('example.com')
  })

  it('零宽匹配不会无限循环', () => {
    const result = findMatches('a*', 'g', 'bbb')
    expect(result.matches).toHaveLength(4)
    expect(result.matches.every((match) => match.value === '')).toBe(true)
  })

  it('没有 g 时只返回第一条', () => {
    expect(findMatches('a', '', 'aaa').matches).toHaveLength(1)
  })

  it('超过上限时标记 truncated', () => {
    const result = findMatches('a', 'g', 'a'.repeat(20), 5)
    expect(result.matches).toHaveLength(5)
    expect(result.truncated).toBe(true)
  })

  it('非法表达式给出中文错误', () => {
    expect(() => findMatches('(', 'g', 'x')).toThrow()
    try {
      findMatches('(', 'g', 'x')
    } catch (err) {
      expect(explainRegexError(err)).toMatch(/正则语法有误/)
      expect(explainRegexError(err)).not.toMatch(/Invalid regular expression/)
    }
  })
})

describe('高亮与替换', () => {
  it('按匹配位置切段，中间保留普通文本', () => {
    const matches = findMatches('cat', 'g', 'a cat and a cat').matches
    const parts = highlightParts('a cat and a cat', matches)
    expect(parts.map((part) => part.text)).toEqual(['a ', 'cat', ' and a ', 'cat'])
  })

  it('零宽匹配用空标记占位', () => {
    const matches = findMatches('^', 'gm', 'a\nb').matches
    expect(highlightParts('a\nb', matches).some((part) => part.text === '∅')).toBe(true)
  })

  it('替换预览遵守 g 修饰符', () => {
    expect(replacePreview('(\\w+)', 'gi', 'one two', '[$1]')).toBe('[one] [two]')
    expect(replacePreview('(\\w+)', 'i', 'one two', '[$1]')).toBe('[one] two')
  })

  it('匹配列表可以拼成制表符文本', () => {
    const matches = findMatches('(\\w+)@(\\w+)', 'g', 'a@b').matches
    expect(matchesToText(matches)).toMatch(/^1\t0\ta@b\ta\tb$/)
  })
})
