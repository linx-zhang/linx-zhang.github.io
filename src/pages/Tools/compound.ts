/** 复利定投的纯计算：本金 + 每月定投，按年化收益折算成月利率。 */

export type ContributionTiming = 'begin' | 'end'

export interface CompoundInput {
  /** 初始本金（元） */
  principal: number
  /** 每月定投（元） */
  monthly: number
  /** 年化收益率（百分数，例如 5 表示 5%） */
  annualRate: number
  /** 定投年数 */
  years: number
  /** 每月定投发生在月初还是月末 */
  timing: ContributionTiming
}

export interface CompoundPoint {
  year: number
  /** 到这一年末累计投入（含初始本金） */
  contributed: number
  /** 这一年末的账户余额 */
  balance: number
  /** 余额减去累计投入 */
  growth: number
}

export interface CompoundResult {
  points: CompoundPoint[]
  final: number
  contributed: number
  growth: number
  /** 期末余额 / 累计投入 */
  multiple: number
  /** 折算后的月利率，小数 */
  monthlyRate: number
}

function finite(value: number, label: string, min: number, max: number): number {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${label}要在 ${min}–${max} 之间`)
  }
  return value
}

/** 年化收益率转月利率：按「年有效收益」折算，而不是简单除以 12 */
export function monthlyRate(annualRate: number): number {
  finite(annualRate, '年化收益', -99, 100)
  return (1 + annualRate / 100) ** (1 / 12) - 1
}

export function simulate(input: CompoundInput): CompoundResult {
  const principal = finite(input.principal, '初始本金', 0, 1_000_000_000)
  const monthly = finite(input.monthly, '每月定投', 0, 1_000_000_000)
  const years = finite(Math.round(input.years), '定投年限', 1, 60)
  if (Math.abs(input.years - years) > 1e-9) throw new Error('定投年限需要是整数')
  const rate = monthlyRate(input.annualRate)

  let balance = principal
  let contributed = principal
  const points: CompoundPoint[] = [{ year: 0, contributed, balance, growth: 0 }]

  for (let year = 1; year <= years; year += 1) {
    for (let month = 0; month < 12; month += 1) {
      if (input.timing === 'begin') {
        balance += monthly
        contributed += monthly
      }
      balance *= 1 + rate
      if (input.timing === 'end') {
        balance += monthly
        contributed += monthly
      }
    }
    points.push({
      year,
      contributed,
      balance,
      growth: balance - contributed,
    })
  }

  return {
    points,
    final: balance,
    contributed,
    growth: balance - contributed,
    multiple: contributed > 0 ? balance / contributed : 1,
    monthlyRate: rate,
  }
}

/** 金额加千分位，保留整数；给结果和表格用 */
export function formatMoney(value: number): string {
  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 }).format(value)
}

/** 坐标轴上的短金额：万 / 亿 */
export function compactMoney(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 100_000_000) return `${(value / 100_000_000).toFixed(abs >= 1_000_000_000 ? 0 : 1)} 亿`
  if (abs >= 10_000) return `${(value / 10_000).toFixed(abs >= 100_000 ? 0 : 1)} 万`
  return String(Math.round(value))
}
