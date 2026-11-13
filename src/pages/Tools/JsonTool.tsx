import { useMemo, useState } from 'react'

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
  const [output, setOutput] = useState('')
  const [error, setError] = useState('')
  const [indent, setIndent] = useState(2)

  const stats = useMemo(() => {
    if (!input.trim()) return ''
    return `${input.split('\n').length} 行 · ${input.length} 字符`
  }, [input])

  const run = (mode: 'pretty' | 'minify') => {
    setError('')
    if (!input.trim()) {
      setOutput('')
      setError('先粘一段 JSON 进来')
      return
    }
    try {
      const parsed = JSON.parse(input)
      setOutput(mode === 'pretty' ? JSON.stringify(parsed, null, indent === 1 ? '\t' : indent) : JSON.stringify(parsed))
    } catch (err) {
      setOutput('')
      setError(locate(input, err instanceof Error ? err.message : String(err)))
    }
  }

  const copy = async () => {
    if (!output) return
    try {
      await navigator.clipboard.writeText(output)
    } catch {
      setError('浏览器不允许写剪贴板，手动选中输出区复制吧')
    }
  }

  return (
    <div className="tool">
      <div className="tool-bar">
        <button type="button" className="tool-button tool-button-primary" onClick={() => run('pretty')}>
          格式化
        </button>
        <button type="button" className="tool-button" onClick={() => run('minify')}>
          压缩成一行
        </button>
        <label className="tool-inline">
          缩进
          <select
            className="tool-select"
            value={indent}
            onChange={(event) => setIndent(Number(event.target.value))}
          >
            <option value={2}>2 空格</option>
            <option value={4}>4 空格</option>
            <option value={1}>Tab</option>
          </select>
        </label>
        <button type="button" className="tool-button tool-copy" onClick={copy} disabled={!output}>
          复制结果
        </button>
      </div>

      {error && <p className="tool-error">{error}</p>}

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
            }}
          />
        </div>

        <div className="tool-pane">
          <div className="tool-pane-head">
            <span>输出</span>
            {output && <span className="tool-meta">{output.length} 字符</span>}
          </div>
          <textarea
            className="tool-editor is-output"
            value={output}
            spellCheck={false}
            readOnly
            placeholder="格式化结果会出现在这里"
          />
        </div>
      </div>
    </div>
  )
}
