/**
 * 二维码由 qrcode 画到 Canvas，中心 logo 再叠加：先铺白边，再按圆形 / 圆角裁剪。
 * 导出尺寸固定为 480 / 640 / 960，logo 占比夹在 12–30%，避免遮住定位点。
 */
import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import Select from '@/components/Select'
import { byteLength, clampPercent, isSupportedLogo, logoGeometry, qrFileName } from './qr'
import type { LogoShape } from './qr'
import './QrTool.css'

type ErrorLevel = 'L' | 'M' | 'Q' | 'H'

const ERROR_LEVELS = [
  { value: 'H', label: 'H · 最强（适合加 logo）' },
  { value: 'Q', label: 'Q · 较强' },
  { value: 'M', label: 'M · 标准' },
  { value: 'L', label: 'L · 最密' },
] as const

const SIZES = [
  { value: '480', label: '480 px' },
  { value: '640', label: '640 px' },
  { value: '960', label: '960 px' },
] as const

const SHAPES = [
  { value: 'square', label: '方形' },
  { value: 'rounded', label: '圆角' },
  { value: 'circle', label: '圆形' },
] as const

interface Logo {
  file: File
  url: string
  image: HTMLImageElement
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2))
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + width, y, x + width, y + height, r)
  ctx.arcTo(x + width, y + height, x, y + height, r)
  ctx.arcTo(x, y + height, x, y, r)
  ctx.arcTo(x, y, x + width, y, r)
  ctx.closePath()
}

function drawLogo(
  ctx: CanvasRenderingContext2D,
  logo: Logo,
  size: number,
  percent: number,
  shape: LogoShape,
) {
  const geometry = logoGeometry(size, percent)
  const { side, pad, x, y, radius } = geometry
  const center = size / 2

  ctx.save()
  ctx.fillStyle = '#ffffff'
  if (shape === 'circle') {
    ctx.beginPath()
    ctx.arc(center, center, side / 2 + pad, 0, Math.PI * 2)
    ctx.fill()
  } else if (shape === 'rounded') {
    roundRectPath(ctx, x - pad, y - pad, side + pad * 2, side + pad * 2, radius + pad)
    ctx.fill()
  } else {
    ctx.fillRect(x - pad, y - pad, side + pad * 2, side + pad * 2)
  }

  ctx.beginPath()
  if (shape === 'circle') {
    ctx.arc(center, center, side / 2, 0, Math.PI * 2)
  } else if (shape === 'rounded') {
    roundRectPath(ctx, x, y, side, side, radius)
  } else {
    ctx.rect(x, y, side, side)
  }
  ctx.clip()

  const imageWidth = logo.image.naturalWidth
  const imageHeight = logo.image.naturalHeight
  const scale = Math.max(side / imageWidth, side / imageHeight)
  const drawWidth = imageWidth * scale
  const drawHeight = imageHeight * scale
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(
    logo.image,
    x - (drawWidth - side) / 2,
    y - (drawHeight - side) / 2,
    drawWidth,
    drawHeight,
  )
  ctx.restore()
}

export default function QrTool() {
  const [text, setText] = useState('https://linx-zhang.github.io')
  const [level, setLevel] = useState<ErrorLevel>('H')
  const [size, setSize] = useState('640')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logo, setLogo] = useState<Logo | null>(null)
  const [shape, setShape] = useState<LogoShape>('rounded')
  const [logoPercent, setLogoPercent] = useState(18)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [draggingLogo, setDraggingLogo] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const logoInputRef = useRef<HTMLInputElement | null>(null)

  const canvasSize = Number(size)
  const hasText = text.trim().length > 0
  const bytes = byteLength(text)

  useEffect(() => {
    if (!logoFile) {
      setLogo(null)
      return
    }
    let cancelled = false
    const url = URL.createObjectURL(logoFile)
    const image = new Image()
    image.onload = () => {
      if (cancelled) return
      setLogo({ file: logoFile, url, image })
      setError('')
    }
    image.onerror = () => {
      if (!cancelled) setError('Logo 读不出来，换一张 PNG / JPG / WebP 试试。')
    }
    image.src = url
    return () => {
      cancelled = true
      image.src = ''
      URL.revokeObjectURL(url)
    }
  }, [logoFile])

  const acceptLogo = (next: File) => {
    setError('')
    if (!isSupportedLogo(next)) {
      setError('Logo 需要是 PNG、JPG 或 WebP。')
      return
    }
    if (next.size > 5 * 1024 * 1024) {
      setError('Logo 超过 5 MB，换一张小一点的图片吧。')
      return
    }
    setLogoFile(next)
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    canvas.width = canvasSize
    canvas.height = canvasSize
    ctx.clearRect(0, 0, canvasSize, canvasSize)

    if (!hasText) {
      setError('')
      setBusy(false)
      return
    }

    let cancelled = false
    setBusy(true)
    setError('')
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          await QRCode.toCanvas(canvas, text.trim(), {
            errorCorrectionLevel: level,
            margin: 2,
            width: canvasSize,
            color: { dark: '#111827', light: '#ffffff' },
          })
          if (cancelled) return
          if (logo) drawLogo(ctx, logo, canvasSize, logoPercent, shape)
          setBusy(false)
        } catch {
          if (cancelled) return
          setError('内容太长，这个纠错等级装不下；减少文字，或把纠错等级降到 M / L。')
          setBusy(false)
        }
      })()
    }, 160)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [text, level, canvasSize, logo, shape, logoPercent, hasText])

  const download = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.toBlob((blob) => {
      if (!blob) {
        setError('导出 PNG 失败，请换一个浏览器再试。')
        return
      }
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = qrFileName()
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    }, 'image/png')
  }

  const clearLogo = () => {
    setLogoFile(null)
    setLogo(null)
    if (logoInputRef.current) logoInputRef.current.value = ''
  }

  const canDownload = hasText && !busy && !error

  return (
    <div className="tool">
      <div className="qr-workbench">
        <div className="qr-controls">
          <section className="tool-block">
            <div className="tool-block-head">
              <h2>二维码内容</h2>
              <p>网址、纯文本、Wi-Fi 配置都可以；内容越长，点阵越密。</p>
            </div>

            <textarea
              className="qr-textarea"
              value={text}
              spellCheck={false}
              rows={4}
              placeholder="输入网址或任意文本…"
              aria-label="二维码内容"
              onChange={(event) => setText(event.target.value)}
            />

            <div className="qr-text-meta">
              <span>{bytes} 字节</span>
              <div>
                <button type="button" className="tool-mini" onClick={() => setText('https://linx-zhang.github.io')}>
                  填入站点
                </button>
                <button type="button" className="tool-mini" onClick={() => setText('')}>
                  清空
                </button>
              </div>
            </div>

            <div className="qr-options">
              <label className="qr-option">
                纠错等级
                <Select
                  className="tool-select"
                  panelClassName="tool-select-panel"
                  ariaLabel="纠错等级"
                  panelMinWidth={164}
                  value={level}
                  options={ERROR_LEVELS}
                  onChange={(value) => setLevel(value as ErrorLevel)}
                />
              </label>

              <label className="qr-option">
                导出尺寸
                <Select
                  className="tool-select"
                  panelClassName="tool-select-panel"
                  ariaLabel="导出尺寸"
                  panelMinWidth={98}
                  value={size}
                  options={SIZES}
                  onChange={setSize}
                />
              </label>
            </div>
          </section>

          <section className="tool-block">
            <div className="tool-block-head">
              <h2>中心 Logo</h2>
              <p>可选。加了 logo 会自动留白；纠错等级 H 最稳，遮挡不超过 30%。</p>
            </div>

            {!logo ? (
              <label
                className={draggingLogo ? 'qr-logo-drop is-over' : 'qr-logo-drop'}
                onDragOver={(event) => {
                  event.preventDefault()
                  setDraggingLogo(true)
                }}
                onDragLeave={() => setDraggingLogo(false)}
                onDrop={(event) => {
                  event.preventDefault()
                  setDraggingLogo(false)
                  const next = event.dataTransfer.files[0]
                  if (next) acceptLogo(next)
                }}
              >
                <input
                  ref={logoInputRef}
                  type="file"
                  className="tool-drop-input"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => {
                    const next = event.target.files?.[0]
                    if (next) acceptLogo(next)
                    event.target.value = ''
                  }}
                />
                <span>拖入或点击上传 logo</span>
                <small>PNG / JPG / WebP · 不超过 5 MB</small>
              </label>
            ) : (
              <>
                <div className="qr-logo-row">
                  <span className="qr-logo-thumb">
                    <img src={logo.url} alt="Logo 预览" />
                  </span>
                  <div className="qr-logo-meta">
                    <strong>{logo.file.name}</strong>
                    <span>{logo.image.naturalWidth} × {logo.image.naturalHeight}</span>
                  </div>
                  <div className="qr-logo-actions">
                    <button type="button" className="tool-mini" onClick={() => logoInputRef.current?.click()}>
                      换一张
                    </button>
                    <button type="button" className="tool-mini" onClick={clearLogo}>
                      移除
                    </button>
                  </div>
                  <input
                    ref={logoInputRef}
                    type="file"
                    className="tool-drop-input"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(event) => {
                      const next = event.target.files?.[0]
                      if (next) acceptLogo(next)
                      event.target.value = ''
                    }}
                  />
                </div>

                <div className="qr-logo-shape">
                  <label className="qr-option">
                    Logo 形状
                    <Select
                      className="tool-select"
                      panelClassName="tool-select-panel"
                      ariaLabel="Logo 形状"
                      panelMinWidth={92}
                      value={shape}
                      options={SHAPES}
                      onChange={(value) => setShape(value === 'square' ? 'square' : value === 'circle' ? 'circle' : 'rounded')}
                    />
                  </label>

                  <label className="qr-option qr-logo-size">
                    Logo 占比
                    <span className="qr-logo-range">
                      <input
                        type="range"
                        min={12}
                        max={30}
                        value={logoPercent}
                        aria-label="Logo 占比"
                        onChange={(event) => setLogoPercent(clampPercent(Number(event.target.value)))}
                      />
                      <span>{logoPercent}%</span>
                    </span>
                  </label>
                </div>
              </>
            )}
          </section>

          {error && <p className="tool-error">{error}</p>}
        </div>

        <aside className="qr-preview">
          <div className="qr-canvas-wrap">
            <canvas ref={canvasRef} className={hasText ? 'qr-canvas' : 'qr-canvas is-empty'} />
            {!hasText && <span className="qr-placeholder">输入内容后生成</span>}
          </div>

          <div className="qr-preview-meta">
            <span>{canvasSize} px</span>
            <span>纠错 {level}</span>
            <span>{logo ? `${SHAPES.find((item) => item.value === shape)?.label} logo` : '无 logo'}</span>
          </div>

          <button
            type="button"
            className="tool-button tool-button-primary qr-download"
            disabled={!canDownload}
            onClick={download}
          >
            {busy ? '生成中…' : '下载 PNG'}
          </button>

          <p className="qr-preview-note">二维码在本地生成，不上传内容；下载后可自行打印或贴到海报上。</p>
        </aside>
      </div>
    </div>
  )
}
