/**
 * Canvas 重编码只缩不放：长边上限为「不限」时保持原尺寸，绝不放大。
 * JPEG 先把透明区域填白；PNG 的质量参数不生效，界面上会明确提示。
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import Select from '@/components/Select'
import {
  MAX_IMAGE_BYTES,
  MAX_IMAGE_LABEL,
  MAX_IMAGE_PIXELS,
  fitWithin,
  formatBytes,
  isSupportedImage,
  mimeType,
  outputFileName,
  percentText,
  resolveFormat,
  savedPercent,
} from './imageCompress'
import type { OutputFormat } from './imageCompress'
import './ImageTool.css'

const FORMATS = [
  { value: 'webp', label: 'WebP（推荐）' },
  { value: 'jpeg', label: 'JPEG' },
  { value: 'png', label: 'PNG（无损）' },
  { value: 'original', label: '保持原格式' },
] as const

const MAX_EDGES = [
  { value: '0', label: '不限尺寸' },
  { value: '2400', label: '长边 2400' },
  { value: '1920', label: '长边 1920' },
  { value: '1280', label: '长边 1280' },
  { value: '800', label: '长边 800' },
] as const

interface Source {
  file: File
  url: string
  image: HTMLImageElement
  width: number
  height: number
}

interface Compressed {
  url: string
  blob: Blob
  width: number
  height: number
  name: string
}

export default function ImageTool() {
  const [file, setFile] = useState<File | null>(null)
  const [source, setSource] = useState<Source | null>(null)
  const [format, setFormat] = useState<OutputFormat>('webp')
  const [quality, setQuality] = useState(82)
  const [maxEdge, setMaxEdge] = useState('1920')
  const [result, setResult] = useState<Compressed | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const targetFormat = source ? resolveFormat(format, source.file.type) : 'webp'
  const edge = Number(maxEdge)

  const acceptFile = (next: File) => {
    setError('')
    if (!isSupportedImage(next)) {
      setError(`「${next.name}」不是支持的图片格式；请选择 JPG、PNG 或 WebP。`)
      return
    }
    if (next.size > MAX_IMAGE_BYTES) {
      setError(`「${next.name}」有 ${formatBytes(next.size)}，超过 ${MAX_IMAGE_LABEL}；请先缩小文件或裁切后再试。`)
      return
    }
    setFile(next)
    setResult(null)
  }

  useEffect(() => {
    if (!file) {
      setSource(null)
      return
    }
    setSource(null)
    let cancelled = false
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      if (cancelled) return
      if (image.naturalWidth * image.naturalHeight > MAX_IMAGE_PIXELS) {
        setError('图片像素太多（超过 4000 万），浏览器可能无法安全处理；请先缩小。')
        return
      }
      setSource({
        file,
        url,
        image,
        width: image.naturalWidth,
        height: image.naturalHeight,
      })
      setError('')
    }
    image.onerror = () => {
      if (!cancelled) setError('这张图片读不出来，可能已经损坏或浏览器不支持。')
    }
    image.src = url
    return () => {
      cancelled = true
      image.src = ''
      URL.revokeObjectURL(url)
    }
  }, [file])

  useEffect(() => {
    if (!source) return
    let cancelled = false
    setBusy(true)
    setError('')
    const timer = window.setTimeout(() => {
      try {
        const size = fitWithin(source.width, source.height, edge)
        const canvas = document.createElement('canvas')
        canvas.width = size.width
        canvas.height = size.height
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('浏览器没有提供 Canvas 2D 上下文')
        if (targetFormat === 'jpeg') {
          ctx.fillStyle = '#ffffff'
          ctx.fillRect(0, 0, size.width, size.height)
        }
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(source.image, 0, 0, size.width, size.height)

        canvas.toBlob(
          (blob) => {
            if (cancelled) return
            if (!blob) {
              setError('压缩失败，浏览器没有生成图片。')
              setBusy(false)
              return
            }
            setResult({
              url: URL.createObjectURL(blob),
              blob,
              width: size.width,
              height: size.height,
              name: outputFileName(source.file.name, targetFormat),
            })
            setBusy(false)
          },
          mimeType(targetFormat),
          targetFormat === 'png' ? undefined : quality / 100,
        )
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : String(err))
        setBusy(false)
      }
    }, 180)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [source, targetFormat, quality, edge])

  useEffect(() => {
    return () => {
      if (result) URL.revokeObjectURL(result.url)
    }
  }, [result])

  const saved = useMemo(
    () => (result && source ? savedPercent(source.file.size, result.blob.size) : 0),
    [result, source],
  )

  const download = () => {
    if (!result) return
    const anchor = document.createElement('a')
    anchor.href = result.url
    anchor.download = result.name
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
  }

  const clear = () => {
    setFile(null)
    setSource(null)
    setResult(null)
    setError('')
    setBusy(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="tool tool-stack">
      <section className="tool-block">
        {!source ? (
          <label
            className={dragging ? 'image-drop is-over' : 'image-drop'}
            onDragOver={(event) => {
              event.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault()
              setDragging(false)
              const next = event.dataTransfer.files[0]
              if (next) acceptFile(next)
            }}
          >
            <input
              ref={inputRef}
              type="file"
              className="tool-drop-input"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => {
                const next = event.target.files?.[0]
                if (next) acceptFile(next)
                event.target.value = ''
              }}
            />
            <span className="image-drop-title">把图片拖进来，或点击选择</span>
            <span className="image-drop-hint">JPG / PNG / WebP · 单张不超过 {MAX_IMAGE_LABEL} · 全程只在本机处理</span>
          </label>
        ) : (
          <div className="image-file-bar">
            <div className="image-file-meta">
              <strong>{source.file.name}</strong>
              <span>
                {source.width} × {source.height} · {formatBytes(source.file.size)}
              </span>
            </div>
            <div className="image-file-actions">
              <button type="button" className="tool-button" onClick={() => inputRef.current?.click()}>
                换一张
              </button>
              <input
                ref={inputRef}
                type="file"
                className="tool-drop-input"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => {
                  const next = event.target.files?.[0]
                  if (next) acceptFile(next)
                  event.target.value = ''
                }}
              />
              <button type="button" className="tool-button" onClick={clear}>
                清空
              </button>
            </div>
          </div>
        )}

        {error && <p className="tool-error">{error}</p>}
      </section>

      {source && (
        <section className="tool-block">
          <div className="tool-block-head">
            <h2>压缩设置</h2>
            <p>优先缩到需要的尺寸，再按质量压；同一张图可以换参数反复比较。</p>
          </div>

          <div className="image-controls">
            <label className="image-control">
              输出格式
              <Select
                className="tool-select"
                panelClassName="tool-select-panel"
                ariaLabel="输出格式"
                panelMinWidth={138}
                value={format}
                options={FORMATS}
                onChange={(value) => setFormat(value as OutputFormat)}
              />
            </label>

            <label className="image-control">
              尺寸上限
              <Select
                className="tool-select"
                panelClassName="tool-select-panel"
                ariaLabel="尺寸上限"
                panelMinWidth={126}
                value={maxEdge}
                options={MAX_EDGES}
                onChange={setMaxEdge}
              />
            </label>

            <label className={targetFormat === 'png' ? 'image-control is-muted' : 'image-control'}>
              质量
              <span className="image-quality-row">
                <input
                  type="range"
                  min={30}
                  max={98}
                  value={quality}
                  disabled={targetFormat === 'png'}
                  aria-label="压缩质量"
                  onChange={(event) => setQuality(Number(event.target.value))}
                />
                <span>{targetFormat === 'png' ? '—' : `${quality}%`}</span>
              </span>
            </label>
          </div>

          {(targetFormat === 'png' || targetFormat === 'jpeg') && (
            <p className="tool-note">
              {targetFormat === 'png'
                ? 'PNG 是无损格式，质量滑块不生效；体积主要靠缩小尺寸。'
                : 'JPEG 不支持透明，透明区域会填成白色。'}
            </p>
          )}
        </section>
      )}

      {source && (
        <section className="tool-block">
          <div className="tool-block-head image-result-head">
            <div>
              <h2>压缩结果</h2>
              <p>
                {busy
                  ? '正在本机重新编码…'
                  : result
                    ? `${formatBytes(result.blob.size)} · ${result.width} × ${result.height} · 比原图${saved >= 0 ? '小' : '大'} ${Math.abs(saved).toFixed(1)}%`
                    : '还没有生成结果'}
              </p>
            </div>
            <div className="image-result-actions">
              {result && (
                <>
                  <span className={saved >= 0 ? 'image-saved' : 'image-grew'}>{percentText(saved)}</span>
                  <button type="button" className="tool-button tool-button-primary" onClick={download}>
                    下载 {result.name}
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="image-preview-grid">
            <figure className="image-preview-card">
              <figcaption>
                原图 <span>{formatBytes(source.file.size)}</span>
              </figcaption>
              <div className="image-canvas image-canvas-checker">
                <img src={source.url} alt={`原图预览：${source.file.name}`} />
              </div>
            </figure>

            <figure className="image-preview-card">
              <figcaption>
                压缩后 <span>{result ? formatBytes(result.blob.size) : '计算中'}</span>
              </figcaption>
              <div className="image-canvas image-canvas-checker">
                {result ? (
                  <img src={result.url} alt={`压缩后预览：${result.name}`} />
                ) : (
                  <span className="image-preview-placeholder">正在生成…</span>
                )}
              </div>
            </figure>
          </div>
        </section>
      )}

      {!source && !error && (
        <p className="tools-state">图片不会上传，压缩在浏览器里完成；换参数后可以对比体积和画质再下载。</p>
      )}
    </div>
  )
}
