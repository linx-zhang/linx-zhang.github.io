import { describe, expect, it } from 'vitest'
import {
  contrastRatio,
  formatHsl,
  formatRatio,
  formatRgb,
  hsvToRgb,
  parseColor,
  readableTextColor,
  rgbToHex,
  rgbToHsl,
  rgbToHsv,
} from './color'

describe('颜色解析', () => {
  it('短 HEX 会展开', () => {
    expect(parseColor('#abc')).toEqual({ r: 170, g: 187, b: 204, a: 1 })
  })

  it('长 HEX 和 alpha', () => {
    expect(parseColor('#11223344')).toEqual({ r: 17, g: 34, b: 51, a: 68 / 255 })
  })

  it('rgb / rgba / 百分比', () => {
    expect(parseColor('rgb(37, 99, 235)')).toEqual({ r: 37, g: 99, b: 235, a: 1 })
    expect(parseColor('rgba(37 99 235 / 50%)')?.a).toBe(0.5)
    expect(parseColor('rgb(100%, 0%, 0%)')).toEqual({ r: 255, g: 0, b: 0, a: 1 })
  })

  it('hsl', () => {
    expect(parseColor('hsl(0, 100%, 50%)')).toEqual({ r: 255, g: 0, b: 0, a: 1 })
    expect(parseColor('hsla(221, 83%, 53%, 0.4)')?.a).toBe(0.4)
  })

  it('非法输入返回 null', () => {
    expect(parseColor('#12')).toBeNull()
    expect(parseColor('nope')).toBeNull()
  })
})

describe('颜色转换', () => {
  it('HEX 与 RGB 往返', () => {
    const color = parseColor('#2563eb')!
    expect(rgbToHex(color)).toBe('#2563eb')
    expect(formatRgb(color)).toBe('rgb(37, 99, 235)')
  })

  it('RGB 与 HSL 往返', () => {
    const color = parseColor('#ff0000')!
    expect(rgbToHsl(color)).toEqual({ h: 0, s: 100, l: 50 })
    expect(formatHsl(color)).toBe('hsl(0, 100%, 50%)')
  })

  it('带 alpha 时输出 8 位 HEX', () => {
    const color = parseColor('#11223344')!
    expect(rgbToHex(color)).toBe('#11223344')
    expect(formatRgb(color)).toContain('rgba')
  })

  it('RGB 与 HSV 往返', () => {
    expect(rgbToHsv({ r: 255, g: 0, b: 0 })).toEqual({ h: 0, s: 100, v: 100 })
    expect(hsvToRgb(0, 100, 100)).toEqual({ r: 255, g: 0, b: 0 })
    expect(rgbToHsv({ r: 128, g: 128, b: 128 })).toEqual({ h: 0, s: 0, v: 50 })
    expect(rgbToHsv({ r: 0, g: 0, b: 0 })).toEqual({ h: 0, s: 0, v: 0 })
  })
})

describe('对比度', () => {
  it('黑白对比度是 21:1', () => {
    expect(contrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 })).toBe(21)
    expect(formatRatio(4.5)).toBe('4.50 : 1')
  })

  it('浅底用深色字，深底用白字', () => {
    expect(readableTextColor({ r: 255, g: 255, b: 255 })).toBe('#111827')
    expect(readableTextColor({ r: 0, g: 0, b: 0 })).toBe('#ffffff')
  })
})
