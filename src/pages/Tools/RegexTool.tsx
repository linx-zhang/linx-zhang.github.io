/**
 * 正则工具只负责交互与高亮：匹配、替换、分段都在 regex.ts 里完成。
 * 结果限制 2000 条、展示 100 条、高亮文本 10 万字符，避免长文或灾难性回溯把页面卡死。
 */
import { useMemo, useState } from 'react'
import { useCopy } from '@/hooks/useCopy'
import {
  HIGHLIGHT_TEXT_MAX,
  MATCH_DISPLAY_LIMIT,
  REGEX_FLAGS,
  explainRegexError,
  findMatches,
  highlightParts,
  matchesToText,
  replacePreview,
} from './regex'
import type { RegexFlag, RegexResult } from './regex'
import './RegexTool.css'

type FlagState = Record<RegexFlag, boolean>

const DEFAULT_FLAGS: FlagState = { g: true, i: false, m: false, s: false, u: false }

function flagsOf(state: FlagState): string {
  return REGEX_FLAGS.filter((item) => state[item.value]).map((item) => item.value).join('')
}

export default function RegexTool() {
  const [pattern, setPattern] = useState('')
  const [flags, setFlags] = useState<FlagState>(DEFAULT_FLAGS)
  const [text, setText] = useState('')
  const [replacement, setReplacement] = useState('')
  const [showReplace, setShowReplace] = useState(false)
  const { copy, isCopied } = useCopy()

  const flagString = flagsOf(flags)

  const result = useMemo<{ data: RegexResult | null; error: string }>(() => {
    if (!pattern) return { data: null, error: '' }
    try {
      return { data: findMatches(pattern, flagString, text), error: '' }
    } catch (err) {
      return { data: null, error: explainRegexError(err) }
    }
  }, [pattern, flagString, text])

  const replaceState = useMemo<{ value: string; error: string }>(() => {
    if (!pattern || !showReplace) return { value: '', error: '' }
    try {
      return { value: replacePreview(pattern, flagString, text, replacement), error: '' }
    } catch (err) {
      return { value: '', error: explainRegexError(err) }
    }
  }, [pattern, flagString, text, replacement, showReplace])

  const matchCount = result.data?.matches.length ?? 0
  const shown = result.data?.matches.slice(0, MATCH_DISPLAY_LIMIT) ?? []
  const canHighlight = text.length <= HIGHLIGHT_TEXT_MAX && matchCount > 0

  return (
    <div className="tool tool-stack">
      <section className="tool-block">
        <div className="tool-block-head">
          <h2>表达式</h2>
          <p>写法和 JavaScript 的 RegExp 一致。上方是模式，右侧是修饰符；输入和结果都在本机计算。</p>
        </div>

        <div className="regex-pattern-row">
          <span className="regex-slash" aria-hidden="true">
            /
          </span>
          <input
            className="tool-input regex-pattern"
            value={pattern}
            spellCheck={false}
            autoComplete="off"
            aria-label="正则表达式"
            placeholder="例如 (\\w+)@(\\w+\\.\\w+)"
            onChange={(event) => setPattern(event.target.value)}
          />
          <span className="regex-slash" aria-hidden="true">
            /
          </span>
          <div className="regex-flags" role="group" aria-label="正则修饰符">
            {REGEX_FLAGS.map((item) => (
              <button
                key={item.value}
                type="button"
                className={flags[item.value] ? 'regex-flag is-active' : 'regex-flag'}
                title={item.hint}
                aria-pressed={flags[item.value]}
                onClick={() => setFlags((prev) => ({ ...prev, [item.value]: !prev[item.value] }))}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <textarea
          className="tool-editor regex-text"
          value={text}
          spellCheck={false}
          aria-label="测试文本"
          placeholder="把要匹配的文本粘到这里…"
          onChange={(event) => setText(event.target.value)}
        />
        <div className="regex-meta-line">
          <span className="tool-meta">
            {text ? `${text.split('\n').length} 行 · ${text.length} 字符` : '还没有测试文本'}
          </span>
          {result.data && (
            <span className={result.data.truncated ? 'regex-count is-limit' : 'regex-count'}>
              {result.data.truncated ? `已截到前 ${matchCount} 条` : `${matchCount} 个匹配`}
            </span>
          )}
        </div>
      </section>

      {result.error && <p className="tool-error">{result.error}</p>}

      {!result.error && pattern && (
        <section className="tool-block">
          <div className="tool-block-head regex-result-head">
            <div>
              <h2>匹配结果</h2>
              <p>高亮按匹配区间着色；捕获组按出现顺序列出，命名组会带上名字。</p>
            </div>
            {matchCount > 0 && (
              <button
                type="button"
                className={isCopied('matches') ? 'tool-button is-copied' : 'tool-button'}
                onClick={() => void copy(matchesToText(result.data?.matches ?? []), 'matches')}
              >
                {isCopied('matches') ? '已复制' : '复制全部匹配'}
              </button>
            )}
          </div>

          {matchCount === 0 ? (
            <p className="tool-empty">没有匹配。检查一下模式、修饰符，或者确认测试文本里确实有这段内容。</p>
          ) : (
            <>
              {canHighlight && (
                <pre className="regex-preview" aria-label="匹配高亮">
                  {highlightParts(text, result.data?.matches ?? []).map((part, index) =>
                    part.matchIndex === undefined ? (
                      <span key={index}>{part.text}</span>
                    ) : (
                      <mark key={index} className="regex-hit">
                        {part.text}
                      </mark>
                    ),
                  )}
                </pre>
              )}

              <div className="regex-match-list">
                {shown.map((match, index) => (
                  <div className="regex-match" key={`${match.index}-${index}`}>
                    <div className="regex-match-head">
                      <span className="regex-match-no">#{index + 1}</span>
                      <span className="tool-meta">
                        位置 {match.index}–{match.end} · 长度 {match.value.length}
                      </span>
                      <button
                        type="button"
                        className={isCopied(`match-${index}`) ? 'tool-mini is-copied' : 'tool-mini'}
                        onClick={() => void copy(match.value, `match-${index}`)}
                      >
                        {isCopied(`match-${index}`) ? '已复制' : '复制'}
                      </button>
                    </div>
                    <code className="regex-match-value">{match.value || '（空匹配）'}</code>
                    {match.groups.length > 0 && (
                      <ul className="regex-groups">
                        {match.groups.map((group) => (
                          <li key={`${group.index}-${group.name ?? ''}`}>
                            <span className="regex-group-name">
                              {group.name ? `命名组 ${group.name}` : `组 ${group.index}`}
                            </span>
                            <code>{group.value ?? '未参与匹配'}</code>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
              {matchCount > MATCH_DISPLAY_LIMIT && (
                <p className="tool-note">
                  结果较多，列表只显示前 {MATCH_DISPLAY_LIMIT} 条；「复制全部匹配」仍会复制全部
                  {matchCount} 条。
                </p>
              )}
            </>
          )}
        </section>
      )}

      <section className="tool-block">
        <div className="tool-block-head regex-result-head">
          <div>
            <h2>替换预览</h2>
            <p>支持 $1、$&amp; 这类 JavaScript 替换语法；没勾 g 时只替换第一处。</p>
          </div>
          <button
            type="button"
            className={showReplace ? 'tool-seg-item is-active' : 'tool-seg-item'}
            onClick={() => setShowReplace((prev) => !prev)}
          >
            {showReplace ? '收起' : '展开'}
          </button>
        </div>

        {showReplace && (
          <>
            <input
              className="tool-input"
              value={replacement}
              spellCheck={false}
              aria-label="替换内容"
              placeholder="例如 $1 <$2>"
              onChange={(event) => setReplacement(event.target.value)}
            />
            {replaceState.error ? (
              <p className="tool-error">{replaceState.error}</p>
            ) : (
              <textarea
                className="tool-editor is-output regex-text"
                value={replaceState.value}
                readOnly
                spellCheck={false}
                aria-label="替换结果"
                placeholder="替换后的文本会出现在这里"
              />
            )}
          </>
        )}
      </section>
    </div>
  )
}
