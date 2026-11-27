import { describe, expect, it } from 'vitest'
import {
  MAX_IMAGE_BYTES,
  MAX_IMAGE_LABEL,
  fileExtension,
  fitWithin,
  formatBytes,
  isSupportedImage,
  outputFileName,
  percentText,
  resolveFormat,
  savedPercent,
} from './imageCompress'

describe('图片尺寸', () => {
  it('只按长边缩小，保持比例', () => {
    expect(fitWithin(4000, 3000, 1920)).toEqual({ width: 1920, height: 1440, scale: 1920 / 4000 })
    expect(fitWithin(3000, 4000, 1920)).toEqual({ width: 1440, height: 1920, scale: 1920 / 4000 })
  })

  it('小图不放大，0 表示不限', () => {
    expect(fitWithin(800, 600, 1280)).toEqual({ width: 800, height: 600, scale: 1 })
    expect(fitWithin(800, 600, 0)).toEqual({ width: 800, height: 600, scale: 1 })
  })

  it('极端窄图至少保留 1px', () => {
    expect(fitWithin(10000, 1, 100).height).toBe(1)
  })

  it('非法尺寸报错', () => {
    expect(() => fitWithin(0, 100, 1920)).toThrow()
  })
})

describe('图片格式与文件', () => {
  it('识别常见图片', () => {
    expect(isSupportedImage({ type: 'image/jpeg', name: 'a.jpg' })).toBe(true)
    expect(isSupportedImage({ type: '', name: 'b.webp' })).toBe(true)
    expect(isSupportedImage({ type: 'image/gif', name: 'c.gif' })).toBe(false)
  })

  it('原格式会映射到可输出格式', () => {
    expect(resolveFormat('original', 'image/jpeg')).toBe('jpeg')
    expect(resolveFormat('original', 'image/png')).toBe('png')
    expect(resolveFormat('original', 'image/webp')).toBe('webp')
    expect(resolveFormat('original', 'image/gif')).toBe('webp')
  })

  it('生成下载文件名', () => {
    expect(outputFileName('photo.JPG', 'webp')).toBe('photo-压缩.webp')
    expect(outputFileName('photo', 'jpeg')).toBe('photo-压缩.jpg')
    expect(fileExtension('png')).toBe('png')
  })
})

describe('体积展示', () => {
  it('字节格式化', () => {
    expect(formatBytes(900)).toBe('900 B')
    expect(formatBytes(2048)).toBe('2.0 KB')
    expect(formatBytes(3 * 1024 * 1024)).toBe('3.00 MB')
    expect(formatBytes(1024 * 1024 * 1024)).toBe('1.00 GB')
  })

  it('单张上限是 1 GB', () => {
    expect(MAX_IMAGE_BYTES).toBe(1024 * 1024 * 1024)
    expect(MAX_IMAGE_LABEL).toBe('1 GB')
  })

  it('压缩比例带方向', () => {
    expect(savedPercent(1000, 600)).toBe(40)
    expect(percentText(40)).toBe('−40.0%')
    expect(percentText(-5)).toBe('+5.0%')
    expect(percentText(0)).toBe('0.0%')
  })
})
