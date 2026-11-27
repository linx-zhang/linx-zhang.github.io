/**
 * 解析与生成共享 cron.ts：生成结果会再 parse 一次，保证「生成的表达式」和「解析结果」
 * 走同一套校验与下次执行时间计算，不会出现两套口径。
 */
import { useMemo, useState } from 'react'
import Select from '@/components/Select'
import { useCopy } from '@/hooks/useCopy'
import {
  buildCron,
  describeCron,
  formatRunTime,
  nextRuns,
  parseCron,
} from './cron'
import type { CronFrequency } from './cron'
import './CronTool.css'

const FREQUENCIES = [
  { value: 'minutes', label: '每 N 分钟' },
  { value: 'hours', label: '每 N 小时' },
  { value: 'daily', label: '每天' },
  { value: 'weekly', label: '每周' },
  { value: 'monthly', label: '每月' },
] as const

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'].map((label, value) => ({
  value: String(value),
  label,
}))

const NUMBERS_60 = Array.from({ length: 60 }, (_, value) => ({
  value: String(value),
  label: String(value).padStart(2, '0'),
}))

const HOURS = Array.from({ length: 24 }, (_, value) => ({
  value: String(value),
  label: String(value).padStart(2, '0'),
}))

const DAYS = Array.from({ length: 31 }, (_, index) => ({
  value: String(index + 1),
  label: `${index + 1} 日`,
}))

const EXAMPLES = ['*/5 * * * *', '0 9 * * *', '0 9 * * 1-5', '0 0 1 * *']

const TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone

export default function CronTool() {
  const [tab, setTab] = useState<'parse' | 'build'>('parse')
  const [expression, setExpression] = useState('0 9 * * *')
  const [frequency, setFrequency] = useState<CronFrequency>('daily')
  const [interval, setIntervalValue] = useState(5)
  const [minute, setMinute] = useState(0)
  const [hour, setHour] = useState(9)
  const [weekday, setWeekday] = useState(1)
  const [dayOfMonth, setDayOfMonth] = useState(1)
  const { copy, isCopied } = useCopy()

  const parsed = useMemo(() => {
    try {
      const spec = parseCron(expression)
      return { spec, error: '' }
    } catch (err) {
      return { spec: null, error: err instanceof Error ? err.message : String(err) }
    }
  }, [expression])

  const runs = useMemo(() => (parsed.spec ? nextRuns(parsed.spec) : []), [parsed.spec])

  const built = useMemo(() => {
    try {
      const exp = buildCron({ frequency, interval, minute, hour, weekday, dayOfMonth })
      const spec = parseCron(exp)
      return { expression: exp, spec, error: '' }
    } catch (err) {
      return { expression: '', spec: null, error: err instanceof Error ? err.message : String(err) }
    }
  }, [frequency, interval, minute, hour, weekday, dayOfMonth])

  const builtRuns = useMemo(() => (built.spec ? nextRuns(built.spec) : []), [built.spec])

  const fieldLabels = ['分钟', '小时', '日期', '月份', '星期']
  const fieldChips: Array<[string, string]> = parsed.spec
    ? parsed.spec.fields.map((field, index) => [fieldLabels[index], field])
    : []

  return (
    <div className="tool tool-stack">
      <div className="tool-seg is-wide cron-view-seg" role="tablist" aria-label="Cron 工具视图">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'parse'}
          className={tab === 'parse' ? 'tool-seg-item is-active' : 'tool-seg-item'}
          onClick={() => setTab('parse')}
        >
          解析表达式
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'build'}
          className={tab === 'build' ? 'tool-seg-item is-active' : 'tool-seg-item'}
          onClick={() => setTab('build')}
        >
          按规则生成
        </button>
      </div>

      {tab === 'parse' ? (
        <>
          <section className="tool-block">
            <div className="tool-block-head">
              <h2>表达式</h2>
              <p>标准 5 段：分 时 日 月 周。支持 *、?、列表、区间、步进，以及 JAN / MON 这类月份、星期英文缩写。</p>
            </div>

            <input
              className="tool-input cron-input"
              value={expression}
              spellCheck={false}
              autoComplete="off"
              aria-label="cron 表达式"
              placeholder="0 9 * * *"
              onChange={(event) => setExpression(event.target.value)}
            />

            <div className="cron-examples">
              {EXAMPLES.map((item) => (
                <button key={item} type="button" className="tool-mini" onClick={() => setExpression(item)}>
                  {item}
                </button>
              ))}
            </div>
          </section>

          {parsed.error && <p className="tool-error">{parsed.error}</p>}

          {parsed.spec && (
            <section className="tool-block">
              <div className="tool-block-head cron-result-head">
                <div>
                  <h2>解析结果</h2>
                  <p>{describeCron(parsed.spec)}</p>
                </div>
                <button
                  type="button"
                  className={isCopied('cron-expression') ? 'tool-button is-copied' : 'tool-button'}
                  onClick={() => void copy(expression, 'cron-expression')}
                >
                  {isCopied('cron-expression') ? '已复制' : '复制表达式'}
                </button>
              </div>

              <dl className="cron-fields">
                {fieldChips.map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>
                      <span className={value === '*' ? 'cron-chip is-all' : 'cron-chip'}>{value}</span>
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {parsed.spec && (
            <section className="tool-block">
              <div className="tool-block-head">
                <h2>接下来 5 次</h2>
                <p>按本机时区（{TIMEZONE}）计算；服务端 cron 通常按服务器时区或 UTC 运行，部署时要对齐。</p>
              </div>
              {runs.length > 0 ? (
                <ol className="cron-runs">
                  {runs.map((run, index) => (
                    <li key={run.toISOString()}>
                      <span className="cron-run-no">{index + 1}</span>
                      <code>{formatRunTime(run)}</code>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="tool-empty">未来 3 年内没有找到执行时间，检查日期、月份和星期是否互相冲突。</p>
              )}
            </section>
          )}
        </>
      ) : (
        <>
          <section className="tool-block">
            <div className="tool-block-head">
              <h2>生成规则</h2>
              <p>选频率和参数，下面会实时生成表达式；生成结果仍按 5 段时间解释。</p>
            </div>

            <div className="cron-build-grid">
              <label className="tool-inline">
                频率
                <Select
                  className="tool-select"
                  panelClassName="tool-select-panel"
                  ariaLabel="执行频率"
                  panelMinWidth={142}
                  value={frequency}
                  options={FREQUENCIES}
                  onChange={(value) => setFrequency(value as CronFrequency)}
                />
              </label>

              {(frequency === 'minutes' || frequency === 'hours') && (
                <label className="tool-inline">
                  间隔
                  <input
                    className="tool-number"
                    type="number"
                    min={1}
                    max={frequency === 'minutes' ? 59 : 23}
                    value={interval}
                    aria-label="间隔"
                    onChange={(event) => {
                      const value = Number(event.target.value)
                      if (Number.isFinite(value)) {
                        setIntervalValue(Math.max(1, Math.min(frequency === 'minutes' ? 59 : 23, value)))
                      }
                    }}
                  />
                  {frequency === 'minutes' ? '分钟' : '小时'}
                </label>
              )}

              {frequency !== 'minutes' && (
                <label className="tool-inline">
                  分钟
                  <Select
                    className="tool-select"
                    panelClassName="tool-select-panel"
                    ariaLabel="执行分钟"
                    panelMinWidth={92}
                    value={String(minute)}
                    options={NUMBERS_60}
                    onChange={(value) => setMinute(Number(value))}
                  />
                </label>
              )}

              {(frequency === 'daily' || frequency === 'weekly' || frequency === 'monthly') && (
                <label className="tool-inline">
                  小时
                  <Select
                    className="tool-select"
                    panelClassName="tool-select-panel"
                    ariaLabel="执行小时"
                    panelMinWidth={92}
                    value={String(hour)}
                    options={HOURS}
                    onChange={(value) => setHour(Number(value))}
                  />
                </label>
              )}

              {frequency === 'weekly' && (
                <label className="tool-inline">
                  星期
                  <Select
                    className="tool-select"
                    panelClassName="tool-select-panel"
                    ariaLabel="执行星期"
                    panelMinWidth={104}
                    value={String(weekday)}
                    options={WEEKDAYS}
                    onChange={(value) => setWeekday(Number(value))}
                  />
                </label>
              )}

              {frequency === 'monthly' && (
                <label className="tool-inline">
                  日期
                  <Select
                    className="tool-select"
                    panelClassName="tool-select-panel"
                    ariaLabel="执行日期"
                    panelMinWidth={96}
                    value={String(dayOfMonth)}
                    options={DAYS}
                    onChange={(value) => setDayOfMonth(Number(value))}
                  />
                </label>
              )}
            </div>

            {(frequency === 'hours' || frequency === 'daily' || frequency === 'weekly' || frequency === 'monthly') && (
              <p className="tool-note">
                {frequency === 'hours'
                  ? `从 0 点起算每 ${interval} 小时，在每小时的第 ${minute} 分执行。`
                  : `具体执行时刻 ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}。`}
              </p>
            )}
          </section>

          {built.error && <p className="tool-error">{built.error}</p>}

          {built.spec && (
            <section className="tool-block">
              <div className="tool-block-head cron-result-head">
                <div>
                  <h2>生成的表达式</h2>
                  <p>{describeCron(built.spec)}</p>
                </div>
                <button
                  type="button"
                  className={isCopied('built-cron') ? 'tool-button is-copied' : 'tool-button'}
                  onClick={() => void copy(built.expression, 'built-cron')}
                >
                  {isCopied('built-cron') ? '已复制' : '复制'}
                </button>
              </div>
              <code className="cron-expression-view">{built.expression}</code>
            </section>
          )}

          {built.spec && (
            <section className="tool-block">
              <div className="tool-block-head">
                <h2>接下来 5 次</h2>
                <p>按本机时区（{TIMEZONE}）计算。</p>
              </div>
              {builtRuns.length > 0 ? (
                <ol className="cron-runs">
                  {builtRuns.map((run, index) => (
                    <li key={run.toISOString()}>
                      <span className="cron-run-no">{index + 1}</span>
                      <code>{formatRunTime(run)}</code>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="tool-empty">这个组合在未来 3 年内没有执行时间。</p>
              )}
            </section>
          )}
        </>
      )}
    </div>
  )
}
