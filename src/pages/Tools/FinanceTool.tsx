/**
 * 年化收益先折成月利率 (1+r)^(1/12)-1，再按月复利；曲线、汇总卡和逐年明细都读同一份 yearly 数据。
 */
import { useMemo, useState } from 'react'
import Select from '@/components/Select'
import { useCopy } from '@/hooks/useCopy'
import {
  compactMoney,
  formatMoney,
  simulate,
} from './compound'
import type { ContributionTiming } from './compound'
import './FinanceTool.css'

const TIMING_OPTIONS = [
  { value: 'end', label: '月末' },
  { value: 'begin', label: '月初' },
] as const

const RATE_PRESETS = [3, 5, 7]

const CHART = {
  width: 760,
  height: 250,
  left: 64,
  right: 18,
  top: 18,
  bottom: 32,
}

function niceMax(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1
  const exponent = Math.floor(Math.log10(value))
  const base = 10 ** exponent
  const norm = value / base
  const nice = norm <= 1 ? 1 : norm <= 1.5 ? 1.5 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10
  return nice * base
}

function signedMoney(value: number): string {
  return `${value < 0 ? '-' : ''}¥${formatMoney(Math.abs(value))}`
}

export default function FinanceTool() {
  const [principal, setPrincipal] = useState('100000')
  const [monthly, setMonthly] = useState('2000')
  const [annualRate, setAnnualRate] = useState('5')
  const [years, setYears] = useState('10')
  const [timing, setTiming] = useState<ContributionTiming>('end')
  const [hover, setHover] = useState<number | null>(null)
  const { copy, isCopied } = useCopy()

  const parsed = useMemo(() => {
    try {
      const result = simulate({
        principal: principal.trim() === '' ? Number.NaN : Number(principal),
        monthly: monthly.trim() === '' ? Number.NaN : Number(monthly),
        annualRate: annualRate.trim() === '' ? Number.NaN : Number(annualRate),
        years: years.trim() === '' ? Number.NaN : Number(years),
        timing,
      })
      return { result, error: '' }
    } catch (err) {
      return { result: null, error: err instanceof Error ? err.message : String(err) }
    }
  }, [principal, monthly, annualRate, years, timing])

  const chart = useMemo(() => {
    if (!parsed.result) return null
    const { points } = parsed.result
    const span = points.length - 1
    const plotW = CHART.width - CHART.left - CHART.right
    const plotH = CHART.height - CHART.top - CHART.bottom
    const top = niceMax(Math.max(...points.map((point) => Math.max(point.balance, point.contributed))) * 1.08)
    const xAt = (index: number) => CHART.left + (index / Math.max(1, span)) * plotW
    const yAt = (value: number) => CHART.top + plotH * (1 - value / top)
    const line = points
      .map((point, index) => `${index === 0 ? 'M' : 'L'}${xAt(index).toFixed(1)},${yAt(point.balance).toFixed(1)}`)
      .join(' ')
    const area = `${line} L${xAt(span).toFixed(1)},${yAt(0).toFixed(1)} L${xAt(0).toFixed(1)},${yAt(0).toFixed(1)} Z`
    const contributionLine = points
      .map((point, index) => `${index === 0 ? 'M' : 'L'}${xAt(index).toFixed(1)},${yAt(point.contributed).toFixed(1)}`)
      .join(' ')
    const grid = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
      value: top * ratio,
      y: yAt(top * ratio),
    }))
    const spanStep = Math.max(1, Math.ceil(span / 6))
    const xLabels = points
      .map((point, index) => ({ index, year: point.year, x: xAt(index) }))
      .filter((item) => item.index === 0 || item.index === span || item.index % spanStep === 0)
    return { points, span, top, xAt, yAt, line, area, contributionLine, grid, xLabels }
  }, [parsed.result])

  const hoverPoint = hover !== null && parsed.result ? parsed.result.points[hover] : null

  const handleMove = (clientX: number, rect: DOMRect) => {
    if (!chart) return
    const x = ((clientX - rect.left) / rect.width) * CHART.width
    const index = Math.round(((x - CHART.left) / (CHART.width - CHART.left - CHART.right)) * chart.span)
    setHover(Math.max(0, Math.min(chart.span, index)))
  }

  const summary = parsed.result
    ? `期末总额 ¥${formatMoney(parsed.result.final)}；累计投入 ¥${formatMoney(parsed.result.contributed)}；收益 ${signedMoney(parsed.result.growth)}；约为投入的 ${parsed.result.multiple.toFixed(2)} 倍`
    : ''

  return (
    <div className="tool tool-stack">
      <section className="tool-block">
        <div className="tool-block-head">
          <h2>投入与假设</h2>
          <p>按年化收益折算成月利率，逐月复利；定投时点会影响当月是否计息。</p>
        </div>

        <div className="finance-form">
          <label className="finance-field">
            <span>初始本金</span>
            <div className="finance-affix">
              <i>¥</i>
              <input
                className="tool-input"
                type="number"
                min={0}
                step={1000}
                value={principal}
                inputMode="decimal"
                onChange={(event) => setPrincipal(event.target.value)}
              />
            </div>
          </label>

          <label className="finance-field">
            <span>每月定投</span>
            <div className="finance-affix">
              <i>¥</i>
              <input
                className="tool-input"
                type="number"
                min={0}
                step={100}
                value={monthly}
                inputMode="decimal"
                onChange={(event) => setMonthly(event.target.value)}
              />
            </div>
          </label>

          <label className="finance-field">
            <span>年化收益</span>
            <div className="finance-affix finance-affix-end">
              <input
                className="tool-input"
                type="number"
                min={-99}
                max={100}
                step={0.1}
                value={annualRate}
                inputMode="decimal"
                onChange={(event) => setAnnualRate(event.target.value)}
              />
              <i>%</i>
            </div>
            <div className="finance-rate-chips">
              {RATE_PRESETS.map((rate) => (
                <button
                  key={rate}
                  type="button"
                  className={annualRate === String(rate) ? 'finance-rate-chip is-active' : 'finance-rate-chip'}
                  onClick={() => setAnnualRate(String(rate))}
                >
                  {rate}%
                </button>
              ))}
            </div>
          </label>

          <label className="finance-field">
            <span>定投年限</span>
            <div className="finance-affix finance-affix-end">
              <input
                className="tool-input"
                type="number"
                min={1}
                max={60}
                step={1}
                value={years}
                inputMode="numeric"
                onChange={(event) => setYears(event.target.value)}
              />
              <i>年</i>
            </div>
          </label>

          <label className="finance-field">
            <span>每月定投时点</span>
            <Select
              className="tool-select"
              panelClassName="tool-select-panel"
              ariaLabel="每月定投时点"
              panelMinWidth={96}
              value={timing}
              options={TIMING_OPTIONS}
              onChange={(value) => setTiming(value === 'begin' ? 'begin' : 'end')}
            />
          </label>
        </div>

        {parsed.error && <p className="tool-error">{parsed.error}</p>}
      </section>

      {parsed.result && (
        <>
          <section className="tool-block">
            <div className="tool-block-head finance-result-head">
              <div>
                <h2>计算结果</h2>
                <p>{annualRate}% 年化 · {years} 年 · {timing === 'begin' ? '月初' : '月末'}定投</p>
              </div>
              <button
                type="button"
                className={isCopied('finance-summary') ? 'tool-button is-copied' : 'tool-button'}
                onClick={() => void copy(summary, 'finance-summary')}
              >
                {isCopied('finance-summary') ? '已复制' : '复制结果'}
              </button>
            </div>

            <div className="finance-summary">
              <div className="finance-summary-main">
                <span>期末总额</span>
                <strong>¥{formatMoney(parsed.result.final)}</strong>
              </div>
              <div>
                <span>累计投入</span>
                <strong>¥{formatMoney(parsed.result.contributed)}</strong>
              </div>
              <div>
                <span>复利收益</span>
                <strong className={parsed.result.growth < 0 ? 'finance-negative' : ''}>
                  {signedMoney(parsed.result.growth)}
                </strong>
              </div>
              <div>
                <span>收益倍数</span>
                <strong>{parsed.result.multiple.toFixed(2)}×</strong>
              </div>
            </div>
          </section>

          {chart && (
            <section className="tool-block">
              <div className="tool-block-head">
                <h2>逐年曲线</h2>
                <p>浅色虚线是累计投入，实线是账户余额；鼠标移到图上可看某一年的数值。</p>
              </div>

              <div className="finance-chart-wrap">
                <svg
                  className="finance-chart"
                  viewBox={`0 0 ${CHART.width} ${CHART.height}`}
                  role="img"
                  aria-label="复利定投逐年余额曲线"
                  onMouseMove={(event) => handleMove(event.clientX, event.currentTarget.getBoundingClientRect())}
                  onMouseLeave={() => setHover(null)}
                >
                  <defs>
                    <linearGradient id="finance-area" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2563eb" stopOpacity="0.16" />
                      <stop offset="100%" stopColor="#2563eb" stopOpacity="0.02" />
                    </linearGradient>
                  </defs>

                  {chart.grid.map((grid) => (
                    <g key={grid.value}>
                      <line
                        x1={CHART.left}
                        x2={CHART.width - CHART.right}
                        y1={grid.y}
                        y2={grid.y}
                        stroke="#eef0f3"
                        strokeWidth={1}
                      />
                      <text x={CHART.left - 10} y={grid.y + 4} textAnchor="end" className="finance-axis-text">
                        {compactMoney(grid.value)}
                      </text>
                    </g>
                  ))}

                  <path d={chart.area} fill="url(#finance-area)" />
                  <path d={chart.contributionLine} fill="none" stroke="#9ca3af" strokeWidth={1.4} strokeDasharray="5 4" />
                  <path d={chart.line} fill="none" stroke="#2563eb" strokeWidth={2.2} />

                  {chart.xLabels.map((label) => (
                    <text
                      key={label.year}
                      x={label.x}
                      y={CHART.height - 8}
                      textAnchor={label.index === 0 ? 'start' : label.index === chart.span ? 'end' : 'middle'}
                      className="finance-axis-text"
                    >
                      {label.year === 0 ? '现在' : `${label.year} 年`}
                    </text>
                  ))}

                  {hoverPoint && chart && (
                    <>
                      <line
                        x1={chart.xAt(hover!)}
                        x2={chart.xAt(hover!)}
                        y1={CHART.top}
                        y2={CHART.height - CHART.bottom}
                        stroke="#d1d5db"
                        strokeWidth={1}
                      />
                      <circle cx={chart.xAt(hover!)} cy={chart.yAt(hoverPoint.balance)} r={4} fill="#2563eb" />
                      <circle cx={chart.xAt(hover!)} cy={chart.yAt(hoverPoint.contributed)} r={3} fill="#9ca3af" />
                    </>
                  )}
                </svg>

                {hoverPoint && chart && (
                  <div
                    className="finance-chart-tip"
                    style={{
                      left: `${(chart.xAt(hover!) / CHART.width) * 100}%`,
                      transform:
                        (chart.xAt(hover!) / CHART.width) * 100 > 72
                          ? 'translateX(-100%)'
                          : (chart.xAt(hover!) / CHART.width) * 100 < 28
                            ? 'translateX(0)'
                            : 'translateX(-50%)',
                    }}
                  >
                    <strong>{hoverPoint.year === 0 ? '现在' : `第 ${hoverPoint.year} 年`}</strong>
                    <span>余额 ¥{formatMoney(hoverPoint.balance)}</span>
                    <span>投入 ¥{formatMoney(hoverPoint.contributed)}</span>
                  </div>
                )}
              </div>
            </section>
          )}

          <section className="tool-block">
            <div className="tool-block-head">
              <h2>逐年明细</h2>
              <p>每年年末的余额、累计投入和当年累计收益。</p>
            </div>

            <div className="finance-table-wrap">
              <table className="finance-table">
                <thead>
                  <tr>
                    <th>年份</th>
                    <th>累计投入</th>
                    <th>年末余额</th>
                    <th>累计收益</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.result.points.slice(1).map((point) => (
                    <tr key={point.year}>
                      <td>第 {point.year} 年</td>
                      <td>¥{formatMoney(point.contributed)}</td>
                      <td>¥{formatMoney(point.balance)}</td>
                      <td className={point.growth < 0 ? 'finance-negative' : ''}>{signedMoney(point.growth)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="tool-meta">
              这是理想化测算：假设收益每年稳定为 {annualRate}%、按月复利，不含税费和申赎费用。实际收益会波动，结果不代表未来表现。
            </p>
          </section>
        </>
      )}
    </div>
  )
}
