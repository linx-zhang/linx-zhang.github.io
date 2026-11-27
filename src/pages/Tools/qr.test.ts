import { describe, expect, it } from 'vitest'
import { byteLength, clampPercent, isSupportedLogo, logoGeometry, qrFileName } from './qr'

describe('二维码 logo 几何', () => {
  it('居中并带白边', () => {
    const geometry = logoGeometry(640, 20)
    expect(geometry.side).toBe(128)
    expect(geometry.pad).toBe(12)
    expect(geometry.x).toBe(256)
    expect(geometry.y).toBe(256)
    expect(geometry.radius).toBe(20)
  })

  it('比例会夹在 12–30 之间', () => {
    expect(clampPercent(5)).toBe(12)
    expect(clampPercent(60)).toBe(30)
    expect(clampPercent(18)).toBe(18)
    expect(logoGeometry(640, 5).side).toBe(77)
  })

  it('非法画布尺寸报错', () => {
    expect(() => logoGeometry(0, 18)).toThrow()
  })
})

describe('二维码输入', () => {
  it('识别 logo 图片', () => {
    expect(isSupportedLogo({ type: 'image/png', name: 'logo.png' })).toBe(true)
    expect(isSupportedLogo({ type: '', name: 'logo.webp' })).toBe(true)
    expect(isSupportedLogo({ type: 'image/gif', name: 'logo.gif' })).toBe(false)
  })

  it('统计 UTF-8 字节数', () => {
    expect(byteLength('abc')).toBe(3)
    expect(byteLength('二维码')).toBe(9)
  })

  it('下载文件名固定', () => {
    expect(qrFileName()).toBe('二维码.png')
  })
})
