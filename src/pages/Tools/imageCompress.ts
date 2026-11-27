/** 图片压缩的纯逻辑：尺寸收缩、格式选择、体积格式化。 */

export type OutputFormat = 'original' | 'jpeg' | 'png' | 'webp'
export type ResolvedFormat = 'jpeg' | 'png' | 'webp'

/** 文件体积准入与像素安全线分开：1 GB 文件可以进流程，但 Canvas 仍限制 4000 万像素。 */
export const MAX_IMAGE_BYTES = 1024 * 1024 * 1024
export const MAX_IMAGE_LABEL = '1 GB'
export const MAX_IMAGE_PIXELS = 40_000_000

export function isSupportedImage(file: { type: string; name: string }): boolean {
  const type = file.type.toLowerCase()
  if (type === 'image/jpeg' || type === 'image/png' || type === 'image/webp') return true
  return /\.(jpe?g|png|webp)$/i.test(file.name)
}

/** 只缩小、不放大；maxEdge = 0 表示保持原尺寸 */
export function fitWithin(width: number, height: number, maxEdge: number): { width: number; height: number; scale: number } {
  if (width <= 0 || height <= 0) throw new Error('图片尺寸无效')
  if (maxEdge <= 0) return { width, height, scale: 1 }
  const longest = Math.max(width, height)
  if (longest <= maxEdge) return { width, height, scale: 1 }
  const scale = maxEdge / longest
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    scale,
  }
}

export function resolveFormat(format: OutputFormat, originalType: string): ResolvedFormat {
  if (format !== 'original') return format
  const type = originalType.toLowerCase()
  if (type === 'image/jpeg' || type === 'image/jpg') return 'jpeg'
  if (type === 'image/png') return 'png'
  return 'webp'
}

export function mimeType(format: ResolvedFormat): string {
  return format === 'jpeg' ? 'image/jpeg' : format === 'png' ? 'image/png' : 'image/webp'
}

export function fileExtension(format: ResolvedFormat): string {
  return format === 'jpeg' ? 'jpg' : format
}

export function outputFileName(name: string, format: ResolvedFormat): string {
  const base = name.replace(/\.(jpe?g|png|webp)$/i, '') || 'image'
  return `${base}-压缩.${fileExtension(format)}`
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

/** 正数表示缩小了多少百分比，负数表示反而变大 */
export function savedPercent(originalBytes: number, compressedBytes: number): number {
  if (originalBytes <= 0) return 0
  return (1 - compressedBytes / originalBytes) * 100
}

export function percentText(value: number): string {
  const rounded = Math.round(value * 10) / 10
  return `${rounded > 0 ? '−' : rounded < 0 ? '+' : ''}${Math.abs(rounded).toFixed(1)}%`
}
