import { describe, expect, it } from 'vitest'
import { buildUrl, decodeText, encodeText, parseUrl } from './url'

describe('URL 解析', () => {
  it('拆出基础地址、query 和 hash', () => {
    const parsed = parseUrl('https://example.com/a/b?name=%E4%BD%A0+%E5%A5%BD&tag=backend#top')
    expect(parsed.base).toBe('https://example.com/a/b')
    expect(parsed.hash).toBe('top')
    expect(parsed.params).toEqual([
      { key: 'name', value: '你 好', enabled: true },
      { key: 'tag', value: 'backend', enabled: true },
    ])
  })

  it('只粘 query 片段也能解析', () => {
    const parsed = parseUrl('?a=1&b=2')
    expect(parsed.base).toBe('')
    expect(parsed.params).toHaveLength(2)
    expect(parseUrl('a=1&b=2').params).toHaveLength(2)
  })

  it('只有路径时保留为 base', () => {
    expect(parseUrl('/docs/api').base).toBe('/docs/api')
    expect(parseUrl('/docs/api').params).toEqual([])
  })

  it('重复 key 按原顺序保留', () => {
    const parsed = parseUrl('?tag=a&tag=b')
    expect(parsed.params.map((param) => param.value)).toEqual(['a', 'b'])
  })

  it('百分号编码不完整时会给出错误', () => {
    const parsed = parseUrl('?q=%E0%A4%A')
    expect(parsed.error).toMatch(/百分号编码/)
  })
})

describe('URL 生成', () => {
  it('跳过停用参数，按顺序编码', () => {
    const url = buildUrl({
      base: 'https://example.com/search',
      params: [
        { key: 'q', value: '你 好', enabled: true },
        { key: 'page', value: '2', enabled: false },
        { key: 'tag', value: 'a&b', enabled: true },
      ],
      hash: 'top',
    })
    expect(url).toBe('https://example.com/search?q=%E4%BD%A0%20%E5%A5%BD&tag=a%26b#top')
  })

  it('解析后重新生成能还原编码', () => {
    const input = 'https://example.com/path?q=%E4%BD%A0%20%E5%A5%BD&x=1#h'
    const parsed = parseUrl(input)
    expect(buildUrl(parsed)).toBe(input)
  })
})

describe('编码与解码', () => {
  it('组件模式会转义分隔符，整条 URL 模式保留分隔符', () => {
    expect(encodeText('a/b?c=1', 'component').value).toBe('a%2Fb%3Fc%3D1')
    expect(encodeText('a/b?c=1', 'uri').value).toBe('a/b?c=1')
  })

  it('中文往返', () => {
    const encoded = encodeText('你好 world', 'component').value
    expect(decodeText(encoded, 'component').value).toBe('你好 world')
  })

  it('非法编码返回错误而不是抛出', () => {
    const result = decodeText('%E0%A4%A', 'component')
    expect(result.value).toBe('')
    expect(result.error).toMatch(/解码失败/)
  })
})
