import { describe, expect, it } from 'vitest'
import {
  JWT_SAMPLE,
  claimRows,
  claimTimes,
  cleanToken,
  decodeJwt,
  formatClaim,
  remainingText,
} from './jwt'

describe('JWT 解码', () => {
  it('示例令牌能解出 header 和 payload', () => {
    const parts = decodeJwt(JWT_SAMPLE)
    const header = parts.header as Record<string, unknown>
    const payload = parts.payload as Record<string, unknown>
    expect(header.alg).toBe('HS256')
    expect(payload.sub).toBe('demo-user')
    expect(payload.name).toBe('Lin Zhang')
  })

  it('可以去掉 Bearer 前缀和换行', () => {
    expect(cleanToken(`Bearer ${JWT_SAMPLE.slice(0, 20)}\n${JWT_SAMPLE.slice(20)}`)).toBe(JWT_SAMPLE)
  })

  it('段数不对时给出明确错误', () => {
    expect(() => decodeJwt('a.b')).toThrow(/3 段/)
    expect(() => decodeJwt('a.b.c.d.e')).toThrow(/JWE/)
  })

  it('非 JSON 载荷不会被当成对象', () => {
    const header = btoa(JSON.stringify({ alg: 'none' })).replace(/=+/g, '')
    const payload = btoa('not-json').replace(/=+/g, '')
    expect(() => decodeJwt(`${header}.${payload}.`)).toThrow(/Payload/)
  })
})

describe('JWT 时间与标准字段', () => {
  it('exp 过期按当前时间判断', () => {
    const now = 1_700_000_000_000
    const times = claimTimes({ exp: 1_700_000_000 }, now)
    expect(times.expired).toBe(true)
    expect(remainingText(times.remainingMs)).toBe('已过期')
  })

  it('没有 exp 时不按过期处理', () => {
    const times = claimTimes({ sub: 'x' }, 1_700_000_000_000)
    expect(times.expired).toBe(false)
    expect(remainingText(undefined)).toMatch(/没有 exp/)
  })

  it('nbf 未到时间时提示尚未生效', () => {
    const times = claimTimes({ nbf: 1_700_000_001 }, 1_700_000_000_000)
    expect(times.notYetValid).toBe(true)
  })

  it('标准字段按中文标签列出，自定义字段不进表', () => {
    const rows = claimRows({ iss: 'a', sub: 'b', exp: 1_700_000_000, custom: 1 })
    expect(rows.map((row) => row.key)).toEqual(['iss', 'sub', 'exp'])
    expect(formatClaim(['a', 'b'])).toBe('a, b')
    expect(formatClaim({ a: 1 })).toBe('{"a":1}')
  })
})
