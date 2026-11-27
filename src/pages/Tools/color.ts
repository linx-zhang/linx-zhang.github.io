/** 颜色转换与对比度计算，全部纯函数。 */

export interface Rgba {
  r: number
  g: number
  b: number
  /** 0–1 */
  a: number
}

const HEX = '0123456789abcdef'

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)))
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function byteHex(value: number): string {
  const v = clampByte(value)
  return HEX[v >> 4] + HEX[v & 0x0f]
}

function parseAlpha(raw: string | undefined): number {
  if (raw === undefined) return 1
  const text = raw.trim()
  if (text.endsWith('%')) return clamp01(Number(text.slice(0, -1)) / 100)
  return clamp01(Number(text))
}

function splitComponents(inner: string): string[] {
  return inner
    .replace(/,/g, ' ')
    .replace(/\//g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
}

/** 支持 #rgb / #rgba / #rrggbb / #rrggbbaa、rgb()/rgba()、hsl()/hsla() */
export function parseColor(input: string): Rgba | null {
  const text = input.trim()
  if (!text) return null
  if (text.startsWith('#')) {
    const hex = text.slice(1)
    if (!/^[0-9a-fA-F]+$/.test(hex)) return null
    if (hex.length === 3 || hex.length === 4) {
      const [r, g, b, a] = hex.split('')
      return {
        r: parseInt(r + r, 16),
        g: parseInt(g + g, 16),
        b: parseInt(b + b, 16),
        a: a === undefined ? 1 : parseInt(a + a, 16) / 255,
      }
    }
    if (hex.length === 6 || hex.length === 8) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
        a: hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1,
      }
    }
    return null
  }

  const rgbMatch = text.match(/^rgba?\((.*)\)$/i)
  if (rgbMatch) {
    const parts = splitComponents(rgbMatch[1])
    if (parts.length < 3 || parts.length > 4) return null
    const channel = (raw: string) =>
      raw.endsWith('%') ? (Number(raw.slice(0, -1)) / 100) * 255 : Number(raw)
    const r = channel(parts[0])
    const g = channel(parts[1])
    const b = channel(parts[2])
    const a = parseAlpha(parts[3])
    if (![r, g, b, a].every(Number.isFinite)) return null
    return { r: clampByte(r), g: clampByte(g), b: clampByte(b), a }
  }

  const hslMatch = text.match(/^hsla?\((.*)\)$/i)
  if (hslMatch) {
    const parts = splitComponents(hslMatch[1])
    if (parts.length < 3 || parts.length > 4) return null
    const h = Number(parts[0].replace(/deg$/i, ''))
    const s = Number(parts[1].replace(/%$/, ''))
    const l = Number(parts[2].replace(/%$/, ''))
    const a = parseAlpha(parts[3])
    if (![h, s, l, a].every(Number.isFinite)) return null
    const rgb = hslToRgb((h % 360 + 360) % 360, Math.max(0, Math.min(100, s)), Math.max(0, Math.min(100, l)))
    return { ...rgb, a }
  }

  return null
}

export function rgbToHex(color: Rgba): string {
  const base = `#${byteHex(color.r)}${byteHex(color.g)}${byteHex(color.b)}`
  return color.a >= 1 ? base : `${base}${byteHex(color.a * 255)}`
}

export function rgbToHsl(color: Rgba): { h: number; s: number; l: number } {
  const r = color.r / 255
  const g = color.g / 255
  const b = color.b / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min
  const l = (max + min) / 2
  let h = 0
  let s = 0
  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1))
    if (max === r) h = ((g - b) / delta) % 6
    else if (max === g) h = (b - r) / delta + 2
    else h = (r - g) / delta + 4
    h *= 60
    if (h < 0) h += 360
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) }
}

/** HSV 供选色卡定位：H 0–360，S / V 0–100 */
export function rgbToHsv(color: Pick<Rgba, 'r' | 'g' | 'b'>): { h: number; s: number; v: number } {
  const r = color.r / 255
  const g = color.g / 255
  const b = color.b / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min
  let h = 0
  if (delta !== 0) {
    if (max === r) h = ((g - b) / delta) % 6
    else if (max === g) h = (b - r) / delta + 2
    else h = (r - g) / delta + 4
    h *= 60
    if (h < 0) h += 360
  }
  return {
    h: Math.round(h),
    s: max === 0 ? 0 : Math.round((delta / max) * 100),
    v: Math.round(max * 100),
  }
}

export function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  const hue = ((h % 360) + 360) % 360
  const sat = Math.max(0, Math.min(100, s)) / 100
  const val = Math.max(0, Math.min(100, v)) / 100
  const c = val * sat
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1))
  const m = val - c
  let rp = 0
  let gp = 0
  let bp = 0
  if (hue < 60) [rp, gp, bp] = [c, x, 0]
  else if (hue < 120) [rp, gp, bp] = [x, c, 0]
  else if (hue < 180) [rp, gp, bp] = [0, c, x]
  else if (hue < 240) [rp, gp, bp] = [0, x, c]
  else if (hue < 300) [rp, gp, bp] = [x, 0, c]
  else [rp, gp, bp] = [c, 0, x]
  return {
    r: clampByte((rp + m) * 255),
    g: clampByte((gp + m) * 255),
    b: clampByte((bp + m) * 255),
  }
}

export function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const sat = s / 100
  const light = l / 100
  const c = (1 - Math.abs(2 * light - 1)) * sat
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = light - c / 2
  let rp = 0
  let gp = 0
  let bp = 0
  if (h < 60) [rp, gp, bp] = [c, x, 0]
  else if (h < 120) [rp, gp, bp] = [x, c, 0]
  else if (h < 180) [rp, gp, bp] = [0, c, x]
  else if (h < 240) [rp, gp, bp] = [0, x, c]
  else if (h < 300) [rp, gp, bp] = [x, 0, c]
  else [rp, gp, bp] = [c, 0, x]
  return { r: clampByte((rp + m) * 255), g: clampByte((gp + m) * 255), b: clampByte((bp + m) * 255) }
}

export function formatRgb(color: Rgba): string {
  if (color.a >= 1) return `rgb(${color.r}, ${color.g}, ${color.b})`
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${roundAlpha(color.a)})`
}

export function formatHsl(color: Rgba): string {
  const hsl = rgbToHsl(color)
  if (color.a >= 1) return `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`
  return `hsla(${hsl.h}, ${hsl.s}%, ${hsl.l}%, ${roundAlpha(color.a)})`
}

function roundAlpha(alpha: number): number {
  return Math.round(clamp01(alpha) * 100) / 100
}

export function relativeLuminance(color: Pick<Rgba, 'r' | 'g' | 'b'>): number {
  const channel = (value: number) => {
    const v = value / 255
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b)
}

/** WCAG 对比度：1 到 21，白底黑字最高 21:1 */
export function contrastRatio(a: Pick<Rgba, 'r' | 'g' | 'b'>, b: Pick<Rgba, 'r' | 'g' | 'b'>): number {
  const l1 = relativeLuminance(a)
  const l2 = relativeLuminance(b)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

export interface ContrastReport {
  ratio: number
  aaNormal: boolean
  aaaNormal: boolean
  aaLarge: boolean
}

export function contrastReport(a: Pick<Rgba, 'r' | 'g' | 'b'>, b: Pick<Rgba, 'r' | 'g' | 'b'>): ContrastReport {
  const ratio = contrastRatio(a, b)
  return {
    ratio,
    aaNormal: ratio >= 4.5,
    aaaNormal: ratio >= 7,
    aaLarge: ratio >= 3,
  }
}

export function readableTextColor(background: Pick<Rgba, 'r' | 'g' | 'b'>): '#111827' | '#ffffff' {
  return contrastRatio(background, { r: 255, g: 255, b: 255 }) >=
    contrastRatio(background, { r: 17, g: 24, b: 39 })
    ? '#ffffff'
    : '#111827'
}

export function formatRatio(ratio: number): string {
  return `${ratio.toFixed(2)} : 1`
}
