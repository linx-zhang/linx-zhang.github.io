/** 二维码的图形参数与文案小工具，画布绘制留在组件里。 */

export type LogoShape = 'square' | 'rounded' | 'circle'

export interface LogoGeometry {
  side: number
  pad: number
  x: number
  y: number
  radius: number
}

export function clampPercent(percent: number, min = 12, max = 30): number {
  if (!Number.isFinite(percent)) return min
  return Math.max(min, Math.min(max, percent))
}

/** 以画布中心为基准，算出 logo 的边长、白边和圆角 */
export function logoGeometry(canvasSize: number, percent: number): LogoGeometry {
  if (canvasSize <= 0) throw new Error('画布尺寸无效')
  const side = Math.round((canvasSize * clampPercent(percent)) / 100)
  const pad = Math.max(6, Math.round(side * 0.09))
  return {
    side,
    pad,
    x: Math.round((canvasSize - side) / 2),
    y: Math.round((canvasSize - side) / 2),
    radius: Math.round(side * 0.16),
  }
}

export function isSupportedLogo(file: { type: string; name: string }): boolean {
  const type = file.type.toLowerCase()
  if (type === 'image/jpeg' || type === 'image/png' || type === 'image/webp') return true
  return /\.(jpe?g|png|webp)$/i.test(file.name)
}

export function byteLength(text: string): number {
  return new TextEncoder().encode(text).length
}

/** 二维码 PNG 的默认文件名；不用内容命名，避免奇怪字符 */
export function qrFileName(): string {
  return '二维码.png'
}
