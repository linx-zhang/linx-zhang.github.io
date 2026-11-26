import { useMemo, useRef, useState } from 'react'
import Select from '@/components/Select'
import {
  MBTI_DIMENSIONS,
  MBTI_POLE_DETAILS,
  MBTI_QUESTIONS,
  ZODIAC_SIGNS,
  daysInMonth,
  scoreMbti,
  zodiacFor,
} from './personality'
import type { MbtiAnswers, MbtiDimensionKey, MbtiPole } from './personality'
import './PersonalityTool.css'

type Tab = 'mbti' | 'zodiac'
type Phase = 'intro' | 'test' | 'result'

const TOTAL = MBTI_QUESTIONS.length
const MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => ({
  value: String(index + 1),
  label: String(index + 1),
}))

export default function PersonalityTool() {
  const [tab, setTab] = useState<Tab>('mbti')

  const [phase, setPhase] = useState<Phase>('intro')
  const [questionIndex, setQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, MbtiPole>>({})
  // 指向最新答案：连续点击时不能依赖上一轮 render 的闭包，否则会丢掉刚选的题。
  const answersRef = useRef<Record<string, MbtiPole>>({})
  // 最后一题的答案与 phase 在同一次事件里更新；单独留一份最终答案，避免结果页读到旧的 answers。
  const [finalAnswers, setFinalAnswers] = useState<MbtiAnswers | null>(null)
  // 介绍页的四组倾向说明：一组一个按钮，点开在下方左右对照。
  const [detailDimension, setDetailDimension] = useState<MbtiDimensionKey | null>(null)

  const mbtiResult = useMemo(
    () => (finalAnswers ? scoreMbti(finalAnswers) : null),
    [finalAnswers],
  )

  const [month, setMonth] = useState(() => new Date().getMonth() + 1)
  const [day, setDay] = useState(() => new Date().getDate())
  // 点底部星座卡时单独记住查看的星座；改生日就回到生日结果。
  const [selectedZodiacId, setSelectedZodiacId] = useState<string | null>(null)
  const zodiacCardRef = useRef<HTMLDivElement>(null)

  const maxDay = daysInMonth(month)
  const safeDay = Math.min(day, maxDay)
  const dayOptions = useMemo(
    () =>
      Array.from({ length: maxDay }, (_, index) => ({
        value: String(index + 1),
        label: String(index + 1),
      })),
    [maxDay],
  )
  const birthdaySign = zodiacFor(month, safeDay)
  const selectedSign = selectedZodiacId
    ? ZODIAC_SIGNS.find((item) => item.id === selectedZodiacId) ?? null
    : null
  const sign = selectedSign ?? birthdaySign
  const activeDimension = detailDimension
    ? MBTI_DIMENSIONS.find((dimension) => dimension.key === detailDimension) ?? null
    : null
  const activeLeft = activeDimension ? MBTI_POLE_DETAILS[activeDimension.left] : null
  const activeRight = activeDimension ? MBTI_POLE_DETAILS[activeDimension.right] : null

  const startTest = () => {
    setAnswers({})
    answersRef.current = {}
    setFinalAnswers(null)
    setDetailDimension(null)
    setQuestionIndex(0)
    setPhase('test')
  }

  const chooseAnswer = (value: MbtiPole) => {
    const question = MBTI_QUESTIONS[questionIndex]
    const nextAnswers = { ...answersRef.current, [question.id]: value }
    answersRef.current = nextAnswers
    setAnswers(nextAnswers)

    if (questionIndex === TOTAL - 1) {
      setFinalAnswers(nextAnswers)
      setPhase('result')
    } else {
      setQuestionIndex((prev) => prev + 1)
    }
  }

  const goBack = () => {
    if (questionIndex === 0) {
      setPhase('intro')
      return
    }
    setQuestionIndex((prev) => prev - 1)
  }

  const changeMonth = (value: string) => {
    const nextMonth = Number(value)
    setSelectedZodiacId(null)
    setMonth(nextMonth)
    setDay((prev) => Math.min(prev, daysInMonth(nextMonth)))
  }

  const changeDay = (value: string) => {
    setSelectedZodiacId(null)
    setDay(Number(value))
  }

  const showZodiac = (id: string) => {
    setSelectedZodiacId(id)
    const scroll = () => {
      zodiacCardRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
    }
    if (typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(scroll)
    } else {
      scroll()
    }
  }

  const toggleDimension = (key: MbtiDimensionKey) => {
    setDetailDimension((current) => (current === key ? null : key))
  }

  return (
    <div className="persona-wrap">
      <div className="persona-tabs" role="tablist" aria-label="切换 MBTI 与星座">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'mbti'}
          className={tab === 'mbti' ? 'persona-tab is-active' : 'persona-tab'}
          onClick={() => setTab('mbti')}
        >
          MBTI 精简版
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'zodiac'}
          className={tab === 'zodiac' ? 'persona-tab is-active' : 'persona-tab'}
          onClick={() => setTab('zodiac')}
        >
          星座速查
        </button>
      </div>

      {tab === 'mbti' && (
        <section className="persona-card" role="tabpanel" aria-label="MBTI 精简版">
          {phase === 'intro' && (
            <div className="persona-intro">
              <p className="persona-kicker">12 道题 · 约 1 分钟</p>
              <h2>先看清四组倾向，不背题库</h2>
              <p className="persona-lede">
                每题只选更像你的那一句，按第一反应答就好。这里给的是倾向，不是心理诊断，也不拿四个字母给一个人下定义。
              </p>

              <div className="persona-pairs">
                {MBTI_DIMENSIONS.map((dimension) => {
                  const open = detailDimension === dimension.key
                  return (
                    <button
                      key={dimension.key}
                      type="button"
                      className={open ? 'persona-pair-btn is-active' : 'persona-pair-btn'}
                      aria-expanded={open}
                      aria-controls="mbti-dimension-detail"
                      onClick={() => toggleDimension(dimension.key)}
                    >
                      <span className="persona-pair-key">
                        {dimension.left}/{dimension.right}
                      </span>
                      <span className="persona-pair-names">
                        {dimension.leftName} · {dimension.rightName}
                      </span>
                    </button>
                  )
                })}
              </div>
              <p className="persona-pairs-help">点任意一组，左右对照看具体表现和一个场景。</p>

              {activeDimension && activeLeft && activeRight && (
                <div
                  id="mbti-dimension-detail"
                  className="persona-compare-panel"
                  role="region"
                  aria-label={`${activeDimension.left}/${activeDimension.right} ${activeDimension.leftName}与${activeDimension.rightName} 对比解释`}
                >
                  <div className="persona-compare-head">
                    <div className="persona-compare-title">
                      <span className="persona-compare-badge">
                        {activeDimension.left}/{activeDimension.right}
                      </span>
                      <strong>
                        {activeDimension.leftName} ↔ {activeDimension.rightName}
                      </strong>
                    </div>
                    <button type="button" className="persona-link" onClick={() => setDetailDimension(null)}>
                      收起
                    </button>
                  </div>
                  <div className="persona-compare-grid">
                    {[activeLeft, activeRight].map((detail) => (
                      <div key={detail.pole} className="persona-compare-col">
                        <div className="persona-compare-pole">
                          <span>{detail.pole}</span>
                          <strong>{detail.name}</strong>
                        </div>
                        <p className="persona-pole-summary">{detail.oneLine}</p>
                        <ul className="persona-pole-list">
                          {detail.signs.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                        <p className="persona-pole-example">
                          <span>一个场景</span>
                          {detail.example}
                        </p>
                        <p className="persona-pole-watch">{detail.watch}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="persona-actions">
                <button type="button" className="tool-button tool-button-primary" onClick={startTest}>
                  开始 12 道题
                </button>
                <span className="persona-hint">同一维至少 3 题，不会出现 50 比 50</span>
              </div>
            </div>
          )}

          {phase === 'test' && (
            <div className="persona-question">
              <div className="persona-step">
                <button type="button" className="persona-link" onClick={goBack}>
                  ← {questionIndex === 0 ? '返回说明' : '上一题'}
                </button>
                <span className="persona-count">
                  {questionIndex + 1} / {TOTAL}
                </span>
              </div>

              <div className="persona-progress">
                <span style={{ width: `${((questionIndex + 1) / TOTAL) * 100}%` }} />
              </div>

              <p className="persona-qtext" key={MBTI_QUESTIONS[questionIndex].id}>
                {MBTI_QUESTIONS[questionIndex].prompt}
              </p>
              <p className="persona-qhint">选更像你的那一句，不用纠结。</p>

              <div className="persona-choices">
                {(['left', 'right'] as const).map((side) => {
                  const question = MBTI_QUESTIONS[questionIndex]
                  const dimension = MBTI_DIMENSIONS.find((item) => item.key === question.dimension)
                  if (!dimension) throw new Error(`缺少维度 ${question.dimension}`)
                  const value = side === 'left' ? dimension.left : dimension.right
                  const selected = answers[question.id] === value
                  return (
                    <button
                      key={side}
                      type="button"
                      className={selected ? 'persona-choice is-selected' : 'persona-choice'}
                      aria-pressed={selected}
                      onClick={() => chooseAnswer(value)}
                    >
                      <span className="persona-choice-key" aria-hidden="true">
                        {side === 'left' ? 'A' : 'B'}
                      </span>
                      <span>{question[side]}</span>
                    </button>
                  )
                })}
              </div>

              <p className="persona-hint">选完自动进入下一题，想改可以点「上一题」。</p>
            </div>
          )}

          {phase === 'result' && mbtiResult && (
            <div className="persona-result">
              <p className="persona-kicker">你的回答更偏向</p>
              <div className="persona-result-head">
                <span className="persona-code">{mbtiResult.type}</span>
                <span className="persona-type-name">{mbtiResult.name}</span>
              </div>
              <p className="persona-summary">{mbtiResult.summary}</p>

              <div className="persona-dims">
                {mbtiResult.dimensions.map((dimension) => (
                  <div key={dimension.key} className="persona-dim">
                    <div className="persona-dim-head">
                      <span className={dimension.leftPct >= dimension.rightPct ? 'is-strong' : undefined}>
                        {dimension.left} {dimension.leftName} {dimension.leftPct}%
                      </span>
                      <span className={dimension.rightPct > dimension.leftPct ? 'is-strong' : undefined}>
                        {dimension.right} {dimension.rightName} {dimension.rightPct}%
                      </span>
                    </div>
                    <div className="persona-dim-bar" aria-hidden="true">
                      <span style={{ width: `${dimension.leftPct}%` }} />
                    </div>
                    <p className="persona-dim-note">
                      {dimension.left}：{dimension.leftHint} · {dimension.right}：{dimension.rightHint}
                    </p>
                  </div>
                ))}
              </div>

              <p className="persona-disclaimer">
                精简版只覆盖四个维度，适合快速对照，不足以替代完整测评或专业判断。
              </p>

              <div className="persona-actions">
                <button type="button" className="tool-button" onClick={startTest}>
                  再测一次
                </button>
                <button type="button" className="tool-button" onClick={() => setTab('zodiac')}>
                  去看星座速查
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {tab === 'zodiac' && (
        <section className="persona-card" role="tabpanel" aria-label="星座速查">
          <div className="persona-zodiac-intro">
            <p className="persona-kicker">按公历生日 · 只看太阳星座</p>
            <h2>你出生那天，太阳落在哪个星座</h2>
            <p className="persona-lede">
              选月和日就能查。这里不排盘、不看运势，只把常见星座印象整理成一页，当作认识自己或打开话题的轻量参考。
            </p>
          </div>

          <div className="persona-zodiac-controls">
            <div className="persona-birth-fields">
              <span className="persona-birth-label">生日</span>
              <Select
                value={String(month)}
                onChange={changeMonth}
                options={MONTH_OPTIONS}
                ariaLabel="出生月份"
                className="persona-select"
                panelMinWidth={96}
              />
              <span className="persona-birth-unit">月</span>
              <Select
                value={String(safeDay)}
                onChange={changeDay}
                options={dayOptions}
                ariaLabel="出生日期"
                className="persona-select"
                panelMinWidth={96}
              />
              <span className="persona-birth-unit">日</span>
            </div>
            <span className="persona-birth-date">
              公历 {month} 月 {safeDay} 日
            </span>
          </div>

          {selectedSign && (
            <p className="persona-zodiac-source">
              正在看手动选中的星座
              <button type="button" className="persona-zodiac-reset" onClick={() => setSelectedZodiacId(null)}>
                回到生日结果
              </button>
            </p>
          )}
          <div ref={zodiacCardRef} className="persona-zodiac-card">
            <span className="persona-zodiac-symbol" aria-hidden="true">
              {sign.symbol}
            </span>
            <div className="persona-zodiac-body">
              <div className="persona-zodiac-title">
                <strong>{sign.name}</strong>
                <span>{sign.en}</span>
              </div>
              <p className="persona-zodiac-range">
                {sign.dateText} · {sign.element}元素 · {sign.mode}
              </p>
              <div className="persona-tags">
                {sign.keywords.map((keyword) => (
                  <span key={keyword}>{keyword}</span>
                ))}
              </div>
              <p className="persona-zodiac-summary">{sign.summary}</p>
              <p className="persona-zodiac-tip">相处提示：{sign.tip}</p>
            </div>
          </div>

          <div className="persona-zodiac-all">
            <div className="persona-section-head">
              <h3>12 星座速查</h3>
              <span>点任意星座看详细解释</span>
            </div>
            <div className="persona-zodiac-grid">
              {ZODIAC_SIGNS.map((item) => {
                const active = item.id === sign.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={active ? 'persona-zodiac-item is-active' : 'persona-zodiac-item'}
                    aria-pressed={active}
                    onClick={() => showZodiac(item.id)}
                  >
                    <span className="persona-zodiac-mini-symbol" aria-hidden="true">
                      {item.symbol}
                    </span>
                    <span className="persona-zodiac-item-text">
                      <strong>{item.name}</strong>
                      <span>{item.dateText}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <p className="persona-disclaimer">
            星座按公历生日和常见分界计算；不处理出生年份、出生时间和上升星座。它适合当谈资，不适合拿来筛选人。
          </p>
        </section>
      )}
    </div>
  )
}
