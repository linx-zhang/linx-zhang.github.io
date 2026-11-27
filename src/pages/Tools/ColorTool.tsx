/**
 * HSV 色卡用 Pointer Events + setPointerCapture，按住拖动时指针移出元素也能继续选色。
 * 饱和度为 0 时保留已有 hue，避免灰色选完再调饱和度时色相跳回红色。
 */
import { useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { useCopy } from '@/hooks/useCopy'
import {
  contrastReport,
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
import type { Rgba } from './color'
import './ColorTool.css'

const DEFAULT_COLOR: Rgba = { r: 37, g: 99, b: 235, a: 1 }
const DEFAULT_HSV = rgbToHsv(DEFAULT_COLOR)

const PRESETS = [
  { hex: '#1f2937', name: '墨色' },
  { hex: '#2563eb', name: '蓝' },
  { hex: '#15803d', name: '绿' },
  { hex: '#b45309', name: '琥珀' },
  { hex: '#b91c1c', name: '红' },
]

const WHITE = { r: 255, g: 255, b: 255 }
const INK = { r: 17, g: 24, b: 39 }

function clampChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)))
}

function alphaPercent(alpha: number): number {
  return Math.round(alpha * 100)
}

export default function ColorTool() {
  const [color, setColor] = useState<Rgba>(DEFAULT_COLOR)
  const [hue, setHue] = useState(DEFAULT_HSV.h)
  const [hexText, setHexText] = useState(rgbToHex(DEFAULT_COLOR))
  const [error, setError] = useState('')
  const { copy, isCopied } = useCopy()
  const areaRef = useRef<HTMLDivElement | null>(null)
  const hueRef = useRef<HTMLDivElement | null>(null)
  const draggingRef = useRef<'area' | 'hue' | null>(null)

  const hex = rgbToHex(color)
  const hsv = rgbToHsv(color)
  const hsl = rgbToHsl(color)
  const whiteReport = contrastReport(color, WHITE)
  const inkReport = contrastReport(color, INK)
  const onWhite = contrastReport(WHITE, color)
  const asBackground = readableTextColor(color)
  const backgroundReport = contrastReport(color, asBackground === '#ffffff' ? WHITE : INK)

  const apply = (next: Rgba, keepHue = false) => {
    if (!keepHue) {
      const nextHsv = rgbToHsv(next)
      if (nextHsv.s > 0) setHue(nextHsv.h)
    }
    setColor(next)
    setHexText(rgbToHex(next))
    setError('')
  }

  const updateChannel = (key: 'r' | 'g' | 'b', value: number) => {
    apply({ ...color, [key]: clampChannel(value) })
  }

  const updateHex = (value: string) => {
    setHexText(value)
    const parsed = parseColor(value)
    if (parsed) {
      apply(parsed)
    } else {
      setError('认不出这个颜色，试试 #2563eb、rgb(37, 99, 235) 或 hsl(221, 83%, 53%)')
    }
  }

  const pointerFraction = (element: HTMLElement, clientX: number, clientY: number) => {
    const rect = element.getBoundingClientRect()
    return {
      x: Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, rect.width))),
      y: Math.max(0, Math.min(1, (clientY - rect.top) / Math.max(1, rect.height))),
    }
  }

  const pickArea = (clientX: number, clientY: number) => {
    if (!areaRef.current) return
    const point = pointerFraction(areaRef.current, clientX, clientY)
    apply(
      {
        ...hsvToRgb(hue, Math.round(point.x * 100), Math.round((1 - point.y) * 100)),
        a: color.a,
      },
      true,
    )
  }

  const pickHue = (clientX: number, clientY: number) => {
    if (!hueRef.current) return
    const point = pointerFraction(hueRef.current, clientX, clientY)
    const nextHue = Math.min(359, Math.round(point.x * 360))
    setHue(nextHue)
    apply({ ...hsvToRgb(nextHue, hsv.s, hsv.v), a: color.a }, true)
  }

  const startDrag = (
    target: 'area' | 'hue',
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    draggingRef.current = target
    if (target === 'area') pickArea(event.clientX, event.clientY)
    else pickHue(event.clientX, event.clientY)
  }

  const moveDrag = (
    target: 'area' | 'hue',
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (draggingRef.current !== target) return
    event.preventDefault()
    if (target === 'area') pickArea(event.clientX, event.clientY)
    else pickHue(event.clientX, event.clientY)
  }

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    draggingRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  return (
    <div className="tool tool-stack">
      <section className="tool-block">
        <div className="tool-block-head">
          <h2>选色</h2>
          <p>
            在色卡上按住鼠标拖动，圆点会跟着指针选颜色；也可以直接输入 HEX，或用下面的 RGB / 透明度精确微调。
          </p>
        </div>

        <div className="color-workbench">
          <div className="color-picker-panel">
            <div
              ref={areaRef}
              className="color-area"
              style={{ backgroundColor: `hsl(${hue}, 100%, 50%)` }}
              aria-label="颜色色卡，按住并拖动选色"
              title="按住并拖动选色"
              onPointerDown={(event) => startDrag('area', event)}
              onPointerMove={(event) => moveDrag('area', event)}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onLostPointerCapture={() => {
                if (draggingRef.current === 'area') draggingRef.current = null
              }}
            >
              <span
                className="color-area-thumb"
                style={{
                  left: `${hsv.s}%`,
                  top: `${100 - hsv.v}%`,
                  backgroundColor: `rgb(${color.r}, ${color.g}, ${color.b})`,
                }}
              />
            </div>

            <div
              ref={hueRef}
              className="color-hue"
              aria-label="色相条，按住并拖动选色相"
              title="按住并拖动选色相"
              onPointerDown={(event) => startDrag('hue', event)}
              onPointerMove={(event) => moveDrag('hue', event)}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onLostPointerCapture={() => {
                if (draggingRef.current === 'hue') draggingRef.current = null
              }}
            >
              <span
                className="color-hue-thumb"
                style={{
                  left: `${(hue / 360) * 100}%`,
                  backgroundColor: `hsl(${hue}, 100%, 50%)`,
                }}
              />
            </div>

            <p className="color-picker-readout">
              <span>
                H <strong>{hue}°</strong>
              </span>
              <span>
                S <strong>{hsv.s}%</strong>
              </span>
              <span>
                V <strong>{hsv.v}%</strong>
              </span>
            </p>
          </div>

          <div className="color-head">
            <div className="color-swatch" aria-label={`当前颜色 ${hex}`}>
              <span
                className="color-swatch-fill"
                style={{ background: `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})` }}
              />
            </div>
            <div className="color-head-main">
              <label className="color-hex-label">
                HEX
                <input
                  className="tool-input color-hex"
                  value={hexText}
                  spellCheck={false}
                  autoComplete="off"
                  aria-label="HEX 颜色"
                  placeholder="#2563eb"
                  onChange={(event) => updateHex(event.target.value)}
                />
              </label>
              <div className="color-presets">
                {PRESETS.map((preset) => (
                  <button
                    key={preset.hex}
                    type="button"
                    className="color-preset"
                    title={`${preset.name} ${preset.hex}`}
                    onClick={() => apply({ ...parseColor(preset.hex)!, a: 1 })}
                  >
                    <span style={{ background: preset.hex }} />
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {error && <p className="tool-error">{error}</p>}

        <div className="color-sliders">
          {(
            [
              ['r', 'R', '红'],
              ['g', 'G', '绿'],
              ['b', 'B', '蓝'],
            ] as const
          ).map(([key, short, label]) => (
            <label key={key} className="color-slider-row">
              <span className="color-slider-name">
                {short}
                <small>{label}</small>
              </span>
              <input
                type="range"
                min={0}
                max={255}
                value={color[key]}
                aria-label={`${label}通道`}
                onChange={(event) => updateChannel(key, Number(event.target.value))}
              />
              <input
                type="number"
                min={0}
                max={255}
                className="tool-number color-number"
                value={color[key]}
                aria-label={`${label}数值`}
                onChange={(event) => updateChannel(key, Number(event.target.value))}
              />
            </label>
          ))}
          <label className="color-slider-row">
            <span className="color-slider-name">
              A
              <small>透明度</small>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={alphaPercent(color.a)}
              aria-label="透明度"
              onChange={(event) => apply({ ...color, a: Number(event.target.value) / 100 })}
            />
            <span className="color-alpha-value">{alphaPercent(color.a)}%</span>
          </label>
        </div>
      </section>

      <section className="tool-block">
        <div className="tool-block-head">
          <h2>等价值</h2>
          <p>同一个颜色的三种写法；带透明度时 HEX 是 8 位，RGB / HSL 用 alpha 值。</p>
        </div>

        <div className="color-outputs">
          {[
            ['HEX', hex, 'hex'],
            ['RGB', formatRgb(color), 'rgb'],
            [
              'HSL',
              formatHsl(color),
              'hsl',
            ],
          ].map(([label, value, key]) => (
            <div className="color-output" key={key}>
              <span className="color-output-label">{label}</span>
              <code>{value}</code>
              <button
                type="button"
                className={isCopied(`color-${key}`) ? 'tool-mini is-copied' : 'tool-mini'}
                onClick={() => void copy(value, `color-${key}`)}
              >
                {isCopied(`color-${key}`) ? '已复制' : '复制'}
              </button>
            </div>
          ))}
        </div>

        <p className="tool-meta">
          色相 {hsl.h}° · 饱和度 {hsl.s}% · 亮度 {hsl.l}% · 透明度 {alphaPercent(color.a)}%
        </p>
      </section>

      <section className="tool-block">
        <div className="tool-block-head">
          <h2>对比度</h2>
          <p>按 WCAG 计算。正文一般要求 4.5:1，大号文字 3:1；7:1 是更严格的 AAA。</p>
        </div>

        <div className="color-contrast-grid">
          <div className="color-contrast-card">
            <div className="color-sample" style={{ background: '#fff', color: `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})` }}>
              这个颜色作为文字
            </div>
            <div className="color-ratio-line">
              <strong>{formatRatio(onWhite.ratio)}</strong>
              <span>白底</span>
            </div>
            <div className="color-badges">
              <span className={onWhite.aaNormal ? 'color-pass' : 'color-fail'}>AA 正文 {onWhite.aaNormal ? '通过' : '未过'}</span>
              <span className={onWhite.aaLarge ? 'color-pass' : 'color-fail'}>AA 大字 {onWhite.aaLarge ? '通过' : '未过'}</span>
              <span className={onWhite.aaaNormal ? 'color-pass' : 'color-fail'}>AAA {onWhite.aaaNormal ? '通过' : '未过'}</span>
            </div>
          </div>

          <div className="color-contrast-card">
            <div
              className="color-sample"
              style={{ background: `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`, color: asBackground }}
            >
              这个颜色作为背景
            </div>
            <div className="color-ratio-line">
              <strong>{formatRatio(backgroundReport.ratio)}</strong>
              <span>配 {asBackground === '#ffffff' ? '白字' : '深色字'}</span>
            </div>
            <div className="color-badges">
              <span className={backgroundReport.aaNormal ? 'color-pass' : 'color-fail'}>
                AA 正文 {backgroundReport.aaNormal ? '通过' : '未过'}
              </span>
              <span className={backgroundReport.aaLarge ? 'color-pass' : 'color-fail'}>
                AA 大字 {backgroundReport.aaLarge ? '通过' : '未过'}
              </span>
            </div>
          </div>
        </div>

        <p className="tool-meta">
          该色对白底 {formatRatio(whiteReport.ratio)}，对深色底 {formatRatio(inkReport.ratio)}。
          {color.a < 1 && ' 半透明色的对比度按不透明 RGB 估算，实际会受背景色影响。'}
        </p>
      </section>
    </div>
  )
}
