import { useEffect, useMemo, useState } from 'react'
import { useCopy } from '@/hooks/useCopy'
import Select from '@/components/Select'
import JsonTree from './JsonTree'
import type { TreeCommand } from './JsonTree'
import { defaultDepth } from './jsonTreeModel'

/** 缩进档位：值和 JSON.stringify 的第三个参数对应（1 走 Tab） */
const INDENTS = [
  { value: '2', label: '2 空格' },
  { value: '4', label: '4 空格' },
  { value: '1', label: 'Tab' },
]

/** 输入超过这个长度就不渲染文本视图：一次性 stringify + 塞进 textarea 会卡死浏览器（树形照常可用） */
const TEXT_VIEW_INPUT_MAX = 2_000_000
/** 输入超过这个长度也不再「复制结果」：拼一份上百 MB 的字符串再写剪贴板，同样会卡 */
const COPY_INPUT_MAX = 10_000_000

/** 把各浏览器那句英文报错翻成「第几行第几列 + 这里缺什么 / 多什么」 */
function locate(input: string, message: string): string {
  if (/Unexpected end of JSON input/i.test(message)) {
    return 'JSON 不完整：可能少了结尾的 } 或 ]'
  }

  const lineColumn = message.match(/line\s+(\d+)\s+column\s+(\d+)/i)
  const posMatch = message.match(/position\s+(\d+)/i)

  let line = -1
  let column = -1
  if (posMatch) {
    const pos = Math.min(Number(posMatch[1]), input.length)
    const before = input.slice(0, pos).split('\n')
    line = before.length
    column = before[before.length - 1].length + 1
  } else if (lineColumn) {
    line = Number(lineColumn[1])
    column = Number(lineColumn[2])
  }

  const reason = /Expected\s+'(.+?)'\s+or\s+'(.+?)'/i.test(message)
    ? `这里缺一个 ${message.match(/Expected\s+'(.+?)'/i)?.[1] ?? ','} 或 ${message.match(/or\s+'(.+?)'/i)?.[1] ?? '}'}`
    : /Unexpected token\s+'?(.+?)'?(?:,|\s+in|$)/i.test(message)
      ? `这里多出或写错了 ${message.match(/Unexpected token\s+'?(.+?)'?(?:,|\s+in|$)/i)?.[1] ?? '符号'}`
      : 'JSON 语法有误'

  const where = line > 0 ? `第 ${line} 行第 ${column} 列：` : ''
  const snippetMatch = message.match(/\.\.\.(.+?) is not valid JSON/s)
  const snippet = snippetMatch
    ? `，附近是 ${snippetMatch[1].trim()}`
    : line > 0
      ? `，该行：${(input.split('\n')[line - 1] ?? '').trim().slice(0, 80) || '（空行）'}`
      : ''

  return `${where}${reason}${snippet}`
}

export default function JsonTool() {
  const [input, setInput] = useState('')
  const [error, setError] = useState('')
  /** 解析结果本身（可能是 null / false / 0，所以另用 parsedFrom 判断有没有解析过） */
  const [parsed, setParsed] = useState<unknown>(null)
  const [parsedFrom, setParsedFrom] = useState<string | null>(null)
  const [mode, setMode] = useState<'pretty' | 'minify'>('pretty')
  const [indent, setIndent] = useState(2)
  const [view, setView] = useState<'tree' | 'text'>('tree')
  const [full, setFull] = useState(false)
  const [hint, setHint] = useState('')
  const [depth, setDepth] = useState(Number.POSITIVE_INFINITY)
  const [command, setCommand] = useState<TreeCommand>({ kind: 'depth', depth: Number.POSITIVE_INFINITY, nonce: 0 })
  const { isCopied, copy } = useCopy()

  const hasParsed = parsedFrom !== null
  /** 文本视图只服务中小 JSON：超大输入留一句人话，把几十上百 MB 的字符串省下来 */
  const textTooBig = input.length > TEXT_VIEW_INPUT_MAX

  /** 输出文本按需生成：树形视图下不 toStringify 一个 50 MB 的字符串 */
  const stringify = () =>
    mode === 'pretty' ? JSON.stringify(parsed, null, indent === 1 ? '\t' : indent) : JSON.stringify(parsed)

  const outputText = useMemo(() => {
    if (!hasParsed || view !== 'text' || textTooBig) return ''
    return mode === 'pretty' ? JSON.stringify(parsed, null, indent === 1 ? '\t' : indent) : JSON.stringify(parsed)
  }, [hasParsed, parsed, mode, indent, view, textTooBig])

  useEffect(() => {
    if (!full) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFull(false)
    }
    window.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [full])

  const run = (next: 'pretty' | 'minify') => {
    setError('')
    setHint('')
    if (!input.trim()) {
      setParsed(null)
      setParsedFrom(null)
      setError('先粘一段 JSON 进来')
      return
    }
    if (parsedFrom !== input) {
      try {
        const value = JSON.parse(input)
        setParsed(value)
        setParsedFrom(input)
        // 大 JSON 默认只开两层，再大也不会一次挂几十万行
        const nextDepth = defaultDepth(input.length)
        setDepth(nextDepth)
        setCommand((prev) => ({ kind: 'depth', depth: nextDepth, nonce: prev.nonce + 1 }))
      } catch (err) {
        setParsed(null)
        setParsedFrom(null)
        setError(locate(input, err instanceof Error ? err.message : String(err)))
        return
      }
    }
    setMode(next)
  }

  const collapseAll = () => setCommand((prev) => ({ kind: 'none', depth, nonce: prev.nonce + 1 }))
  const expandAll = () => setCommand((prev) => ({ kind: 'all', depth, nonce: prev.nonce + 1 }))

  const copyResult = async () => {
    if (!hasParsed) return
    if (input.length > COPY_INPUT_MAX) {
      setHint(
        `输入 ${Math.round(input.length / 1_000_000)} MB，复制要先拼出一份更大的文本，剪贴板放不下；` +
          '请直接在树形视图里逐层看，或缩小到需要的片段再复制',
      )
      return
    }
    setHint('')
    const text = outputText || stringify()
    if (await copy(text)) return
    setError('浏览器不允许写剪贴板，手动选中输出区复制吧')
  }

  const stats = useMemo(() => {
    if (!input.trim()) return ''
    return `${input.split('\n').length} 行 · ${input.length} 字符`
  }, [input])

  return (
    <div className="tool">
      <div className="tool-bar">
        <button type="button" className="tool-button tool-button-primary" onClick={() => run('pretty')}>
          格式化
        </button>
        <button type="button" className="tool-button" onClick={() => run('minify')}>
          压缩成一行
        </button>
        <span className="tool-inline">
          缩进
          <Select
            className="tool-select"
            panelClassName="tool-select-panel"
            ariaLabel="缩进方式"
            panelMinWidth={132}
            value={String(indent)}
            options={INDENTS}
            onChange={(value) => setIndent(Number(value))}
          />
        </span>
        <button
          type="button"
          className={isCopied() ? 'tool-button tool-copy is-copied' : 'tool-button tool-copy'}
          onClick={() => void copyResult()}
          disabled={!hasParsed}
        >
          {isCopied() ? '已复制' : '复制结果'}
        </button>
      </div>

      {error && <p className="tool-error">{error}</p>}
      {!error && hint && <p className="json-notice">{hint}</p>}

      <div className="tool-split">
        <div className="tool-pane">
          <div className="tool-pane-head">
            <span>输入</span>
            <span className="tool-meta">{stats}</span>
          </div>
          <textarea
            className="tool-editor"
            value={input}
            spellCheck={false}
            placeholder={'{"hello": "world"}'}
            onChange={(event) => {
              setInput(event.target.value)
              setError('')
              setHint('')
            }}
          />
        </div>

        <div className={full ? 'tool-pane is-full' : 'tool-pane'}>
          <div className="tool-pane-head">
            <span>输出</span>
            <div className="tool-pane-tools">
              {hasParsed && outputText && <span className="tool-meta">{outputText.length} 字符</span>}
              {hasParsed && (
                <>
                  <div className="tool-seg" role="group" aria-label="输出视图">
                    <button
                      type="button"
                      className={view === 'tree' ? 'tool-seg-item is-active' : 'tool-seg-item'}
                      onClick={() => setView('tree')}
                    >
                      树形
                    </button>
                    <button
                      type="button"
                      className={view === 'text' ? 'tool-seg-item is-active' : 'tool-seg-item'}
                      onClick={() => setView('text')}
                    >
                      文本
                    </button>
                  </div>
                  {view === 'tree' && (
                    <>
                      <button type="button" className="tool-mini" onClick={collapseAll}>
                        全部折叠
                      </button>
                      <button type="button" className="tool-mini" onClick={expandAll}>
                        全部展开
                      </button>
                    </>
                  )}
                  <button type="button" className="tool-mini" onClick={() => setFull((prev) => !prev)}>
                    {full ? '退出全屏' : '全屏'}
                  </button>
                </>
              )}
            </div>
          </div>

          {hasParsed && view === 'tree' ? (
            <JsonTree
              className="tool-code-scroll"
              value={parsed}
              initialDepth={depth}
              command={command}
            />
          ) : view === 'text' && textTooBig ? (
            <div className="tool-code-scroll">
              <p className="json-notice">
                输入 {Math.round(input.length / 1_000_000)} MB，文本视图要一次性拼出更大的字符串会把页面卡住，所以这里不渲染；树形视图照常可用，缩小到需要的片段再复制。
              </p>
            </div>
          ) : (
            <textarea
              className="tool-editor is-output"
              value={outputText}
              spellCheck={false}
              readOnly
              placeholder="格式化结果会出现在这里"
            />
          )}
        </div>
      </div>
    </div>
  )
}
