import { describe, expect, it } from 'vitest'
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, passwordIssue } from './passwordPolicy'

describe('passwordIssue', () => {
  it('requires at least 8 characters', () => {
    expect(passwordIssue('a'.repeat(PASSWORD_MIN_LENGTH - 1))).toContain('至少')
  })

  it('caps length at 128 characters', () => {
    expect(passwordIssue('a'.repeat(PASSWORD_MAX_LENGTH + 1))).toContain('最多')
  })

  it('rejects whitespace-only values', () => {
    expect(passwordIssue('        ')).toBe('密码不能全是空白')
  })

  it('rejects repeated and sequential values', () => {
    expect(passwordIssue('aaaaaaaa')).toBe('密码不能是重复字符')
    expect(passwordIssue('abcdefgh')).toBe('密码不能是连续字符')
    expect(passwordIssue('87654321')).toBe('密码不能是连续字符')
  })

  it('accepts a unique passphrase', () => {
    expect(passwordIssue('Mango-Orbit-7421')).toBeUndefined()
  })
})
