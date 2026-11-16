import { describe, expect, it } from 'vitest'
import { formatBytes, formatFileTime, normalizeHash, verifyHash } from './hash'

describe('formatBytes', () => {
  it('小文件按字节显示，不四舍五入成 0 KB', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(1023)).toBe('1023 B')
  })

  it('KB 以上保留一位小数，过百取整', () => {
    expect(formatBytes(1024)).toBe('1.0 KB')
    expect(formatBytes(1024 * 1024)).toBe('1.0 MB')
    expect(formatBytes(Math.round(118.4 * 1024 * 1024))).toBe('118 MB')
    expect(formatBytes(1024 * 300)).toBe('300 KB')
  })

  it('GB 与 TB 不会串档', () => {
    expect(formatBytes(1024 ** 3 * 2)).toBe('2.0 GB')
    expect(formatBytes(1024 ** 4 * 3)).toBe('3.0 TB')
  })
})

describe('formatFileTime', () => {
  it('输出与站内其它时间一致的 YYYY-MM-DD HH:mm 形态', () => {
    expect(formatFileTime(1700000000000)).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)
  })

  it('缺时间戳的文件（0 / NaN）显示未知，不显示 1970', () => {
    expect(formatFileTime(0)).toBe('未知')
    expect(formatFileTime(Number.NaN)).toBe('未知')
  })
})

describe('normalizeHash', () => {
  const sha256 = 'BA7816BF8F01CFEA414140DE5DAE2223B00361A396177A9CB410FF61F20015AD'

  it('大写、前后空格都能洗成小写纯十六进制', () => {
    expect(normalizeHash(`  ${sha256}  `)).toBe(sha256.toLowerCase())
  })

  it('认 sha256sum 输出里的 hash + 文件名与 * 标记', () => {
    expect(normalizeHash(`${sha256}  node-v22.zip`)).toBe(sha256.toLowerCase())
    expect(normalizeHash(`${sha256} *node-v22.zip`)).toBe(sha256.toLowerCase())
  })

  it('认 certutil 那种每两位一个空格的输出', () => {
    const spaced = sha256.replace(/(..)/g, '$1 ').trim()
    expect(normalizeHash(spaced)).toBe(sha256.toLowerCase())
  })

  it('认 SHA256: 这种带算法前缀的写法', () => {
    expect(normalizeHash(`SHA256: ${sha256}`)).toBe(sha256.toLowerCase())
  })

  it('长度不对或不是十六进制的一律返回空串，交给界面报错', () => {
    expect(normalizeHash('hello')).toBe('')
    expect(normalizeHash('')).toBe('')
    expect(normalizeHash('zzzz')).toBe('')
  })
})

describe('verifyHash', () => {
  const results = {
    md5: '900150983cd24fb0d6963f7d28e17f72',
    sha256: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  }

  it('命中时回报是哪个算法', () => {
    expect(verifyHash('BA7816BF8F01CFEA414140DE5DAE2223B00361A396177A9CB410FF61F20015AD', results)).toEqual({
      algorithm: 'sha256',
      label: 'SHA-256',
    })
  })

  it('带文件名的粘贴内容也能命中', () => {
    expect(verifyHash('900150983cd24fb0d6963f7d28e17f72  setup.exe', results)?.algorithm).toBe('md5')
  })

  it('不一致或空输入返回 null', () => {
    expect(verifyHash('11111111111111111111111111111111', results)).toBeNull()
    expect(verifyHash('   ', results)).toBeNull()
  })
})
