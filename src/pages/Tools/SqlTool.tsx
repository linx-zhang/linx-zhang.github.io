import { useMemo, useState } from 'react'
import { useCopy } from '@/hooks/useCopy'
import Select from '@/components/Select'
import { format } from 'sql-formatter'
import { tokenizeSql } from './highlight'

const LANGUAGES = [
  { value: 'sql', label: '通用' },
  { value: 'mysql', label: 'MySQL' },
  { value: 'postgresql', label: 'PostgreSQL' },
  { value: 'sqlite', label: 'SQLite' },
  { value: 'bigquery', label: 'BigQuery' },
] as const

const KEYWORD_CASES = [
  { value: 'upper', label: '大写' },
  { value: 'lower', label: '小写' },
] as const

export default function SqlTool() {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [error, setError] = useState('')
  const [language, setLanguage] = useState<string>('sql')
  const [keywordCase, setKeywordCase] = useState<'upper' | 'lower'>('upper')
  const { isCopied, copy } = useCopy()

  const tokens = useMemo(() => (output ? tokenizeSql(output) : []), [output])

  const run = () => {
    setError('')
    if (!input.trim()) {
      setOutput('')
      setError('先粘一段 SQL 进来')
      return
    }
    try {
      setOutput(
        format(input, {
          language: language as (typeof LANGUAGES)[number]['value'],
          keywordCase,
          tabWidth: 2,
          linesBetweenQueries: 1,
        }),
      )
    } catch (err) {
      setOutput('')
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const copyResult = async () => {
    if (!output) return
    if (await copy(output)) return
    setError('浏览器不允许写剪贴板，手动选中输出区复制吧')
  }

  return (
    <div className="tool">
      <div className="tool-bar">
        <button type="button" className="tool-button tool-button-primary" onClick={run}>
          格式化
        </button>
        <span className="tool-inline">
          方言
          <Select
            className="tool-select"
            panelClassName="tool-select-panel"
            ariaLabel="SQL 方言"
            panelMinWidth={140}
            value={language}
            options={LANGUAGES}
            onChange={setLanguage}
          />
        </span>
        <span className="tool-inline">
          关键字
          <Select
            className="tool-select"
            panelClassName="tool-select-panel"
            ariaLabel="关键字大小写"
            panelMinWidth={112}
            value={keywordCase}
            options={KEYWORD_CASES}
            onChange={(value) => setKeywordCase(value === 'lower' ? 'lower' : 'upper')}
          />
        </span>
        <button
          type="button"
          className={isCopied() ? 'tool-button tool-copy is-copied' : 'tool-button tool-copy'}
          onClick={() => void copyResult()}
          disabled={!output}
        >
          {isCopied() ? '已复制' : '复制结果'}
        </button>
      </div>

      {error && <p className="tool-error">{error}</p>}

      <div className="tool-split">
        <div className="tool-pane">
          <div className="tool-pane-head">
            <span>输入</span>
          </div>
          <textarea
            className="tool-editor"
            value={input}
            spellCheck={false}
            placeholder="select id,name from users u join orders o on o.user_id=u.id where o.amount>100 order by id"
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
          {output ? (
            <div className="tool-code-scroll">
              <pre className="tool-code">
                {tokens.map((token, index) =>
                  token.cls ? (
                    <span key={index} className={token.cls}>
                      {token.text}
                    </span>
                  ) : (
                    token.text
                  ),
                )}
              </pre>
            </div>
          ) : (
            <textarea
              className="tool-editor is-output"
              value=""
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
