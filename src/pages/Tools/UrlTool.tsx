/**
 * URL 工具有「解析 URL / 编码解码」两个视图。
 * query 行以本地 id 维持顺序，重复 key 保留；启用勾选只影响生成结果，不会删掉参数。
 */
import { useMemo, useState } from 'react'
import Select from '@/components/Select'
import { useCopy } from '@/hooks/useCopy'
import {
  buildUrl,
  decodeText,
  encodeText,
  parseUrl,
} from './url'
import type { QueryParam, UrlCodecMode } from './url'
import './UrlTool.css'

const CODEC_MODES = [
  { value: 'component', label: 'URL 组件' },
  { value: 'uri', label: '整条 URL' },
] as const

type ViewMode = 'url' | 'codec'

export default function UrlTool() {
  const [view, setView] = useState<ViewMode>('url')
  const [raw, setRaw] = useState('')
  const [base, setBase] = useState('')
  const [hash, setHash] = useState('')
  const [rows, setRows] = useState<QueryParam[]>([])
  const [parseError, setParseError] = useState('')

  const [codecMode, setCodecMode] = useState<UrlCodecMode>('component')
  const [codecInput, setCodecInput] = useState('')
  const [codecDirection, setCodecDirection] = useState<'encode' | 'decode'>('encode')
  const { copy, isCopied } = useCopy()

  const output = useMemo(() => {
    if (parseError) return ''
    return buildUrl({ base, params: rows, hash })
  }, [base, rows, hash, parseError])

  const codecResult = useMemo(() => {
    if (!codecInput) return { value: '', error: '' }
    return codecDirection === 'encode'
      ? encodeText(codecInput, codecMode)
      : decodeText(codecInput, codecMode)
  }, [codecInput, codecDirection, codecMode])

  const applyRaw = (value: string) => {
    setRaw(value)
    const parsed = parseUrl(value)
    setBase(parsed.base)
    setHash(parsed.hash)
    setRows(parsed.params)
    setParseError(parsed.error)
  }

  const updateRow = (index: number, patch: Partial<QueryParam>) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  const removeRow = (index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index))
  }

  const moveRow = (index: number, direction: -1 | 1) => {
    setRows((prev) => {
      const target = index + direction
      if (target < 0 || target >= prev.length) return prev
      const next = [...prev]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  const toggleAll = (enabled: boolean) => {
    setRows((prev) => prev.map((row) => ({ ...row, enabled })))
  }

  return (
    <div className="tool tool-stack">
      <div className="tool-seg is-wide url-view-seg" role="tablist" aria-label="URL 工具视图">
        <button
          type="button"
          role="tab"
          aria-selected={view === 'url'}
          className={view === 'url' ? 'tool-seg-item is-active' : 'tool-seg-item'}
          onClick={() => setView('url')}
        >
          解析 URL
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'codec'}
          className={view === 'codec' ? 'tool-seg-item is-active' : 'tool-seg-item'}
          onClick={() => setView('codec')}
        >
          编码 / 解码
        </button>
      </div>

      {view === 'url' ? (
        <>
          <section className="tool-block">
            <div className="tool-block-head">
              <h2>URL</h2>
              <p>
                粘贴完整 URL、路径或只有 query 的片段。参数表按解码后的值展示，编辑后下面会实时生成编码后的 URL。
              </p>
            </div>

            <div className="url-input-row">
              <input
                className="tool-input"
                value={raw}
                spellCheck={false}
                autoComplete="off"
                aria-label="待解析 URL"
                placeholder="https://example.com/path?name=Linx&tag=backend#top"
                onChange={(event) => applyRaw(event.target.value)}
              />
              <button
                type="button"
                className={isCopied('url-output') ? 'tool-button tool-copy is-copied' : 'tool-button tool-copy'}
                disabled={!output}
                onClick={() => void copy(output, 'url-output')}
              >
                {isCopied('url-output') ? '已复制' : '复制结果'}
              </button>
            </div>

            {parseError && <p className="tool-error">{parseError}</p>}

            {(base || hash) && (
              <dl className="url-meta">
                {base && (
                  <div>
                    <dt>基础地址</dt>
                    <dd>
                      <code>{base}</code>
                    </dd>
                  </div>
                )}
                {hash && (
                  <div>
                    <dt>片段</dt>
                    <dd>
                      <code>#{hash}</code>
                    </dd>
                  </div>
                )}
              </dl>
            )}

            <div className="url-params-head">
              <span className="tool-inline">Query 参数 · {rows.length} 个</span>
              {rows.length > 0 && (
                <div className="url-params-actions">
                  <button type="button" className="tool-mini" onClick={() => toggleAll(true)}>
                    全部启用
                  </button>
                  <button type="button" className="tool-mini" onClick={() => toggleAll(false)}>
                    全部停用
                  </button>
                </div>
              )}
            </div>

            {rows.length === 0 ? (
              <p className="tool-empty">这段 URL 里没有 query 参数，点下面的「添加参数」开始。</p>
            ) : (
              <div className="url-table-wrap">
                <table className="url-table">
                  <thead>
                    <tr>
                      <th className="url-col-on" aria-label="启用" />
                      <th>键</th>
                      <th>值</th>
                      <th className="url-col-act" aria-label="操作" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, index) => (
                      <tr key={index} className={row.enabled ? 'url-row' : 'url-row is-off'}>
                        <td className="url-col-on">
                          <input
                            type="checkbox"
                            checked={row.enabled}
                            aria-label={`启用参数 ${index + 1}`}
                            onChange={(event) => updateRow(index, { enabled: event.target.checked })}
                          />
                        </td>
                        <td>
                          <input
                            className="url-cell"
                            value={row.key}
                            spellCheck={false}
                            aria-label={`参数 ${index + 1} 键`}
                            placeholder="key"
                            onChange={(event) => updateRow(index, { key: event.target.value })}
                          />
                        </td>
                        <td>
                          <input
                            className="url-cell"
                            value={row.value}
                            spellCheck={false}
                            aria-label={`参数 ${index + 1} 值`}
                            placeholder="value"
                            onChange={(event) => updateRow(index, { value: event.target.value })}
                          />
                        </td>
                        <td className="url-col-act">
                          <div className="url-row-actions">
                            <button
                              type="button"
                              className="tool-mini"
                              aria-label={`上移参数 ${index + 1}`}
                              disabled={index === 0}
                              onClick={() => moveRow(index, -1)}
                            >
                              ↑
        </button>
                            <button
                              type="button"
                              className="tool-mini"
                              aria-label={`下移参数 ${index + 1}`}
                              disabled={index === rows.length - 1}
                              onClick={() => moveRow(index, 1)}
                            >
                              ↓
                            </button>
                            <button
                              type="button"
                              className="tool-mini"
                              aria-label={`删除参数 ${index + 1}`}
                              onClick={() => removeRow(index)}
                            >
                              ×
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="tool-bar">
              <button
                type="button"
                className="tool-button"
                onClick={() => setRows((prev) => [...prev, { key: '', value: '', enabled: true }])}
              >
                + 添加参数
              </button>
              <span className="tool-meta">停用的参数不会出现在结果里；↑↓ 可以调整顺序。</span>
            </div>
          </section>

          <section className="tool-block">
            <div className="tool-block-head">
              <h2>编码后的 URL</h2>
              <p>空格按 %20 编码，中文和特殊字符按 UTF-8 百分号编码。</p>
            </div>
            <textarea
              className="tool-editor is-output url-output"
              value={output}
              readOnly
              spellCheck={false}
              aria-label="编码后的 URL"
              placeholder="解析或添加参数后，这里会出现完整 URL"
            />
          </section>
        </>
      ) : (
        <>
          <section className="tool-block">
            <div className="tool-block-head">
              <h2>编码 / 解码</h2>
              <p>
                组件模式对应 encodeURIComponent，会把 /、?、&amp; 也转义；整条 URL 模式对应 encodeURI，保留这些分隔符。
              </p>
            </div>

            <div className="tool-bar">
              <span className="tool-inline">
                范围
                <Select
                  className="tool-select"
                  panelClassName="tool-select-panel"
                  ariaLabel="编码范围"
                  panelMinWidth={132}
                  value={codecMode}
                  options={CODEC_MODES}
                  onChange={(value) => setCodecMode(value === 'uri' ? 'uri' : 'component')}
                />
              </span>
              <div className="tool-seg url-codec-dir" role="group" aria-label="编码方向">
                <button
                  type="button"
                  className={codecDirection === 'encode' ? 'tool-seg-item is-active' : 'tool-seg-item'}
                  onClick={() => setCodecDirection('encode')}
                >
                  编码
                </button>
                <button
                  type="button"
                  className={codecDirection === 'decode' ? 'tool-seg-item is-active' : 'tool-seg-item'}
                  onClick={() => setCodecDirection('decode')}
                >
                  解码
                </button>
              </div>
            </div>

            <textarea
              className="tool-editor url-codec-text"
              value={codecInput}
              spellCheck={false}
              aria-label="编码或解码输入"
              placeholder={
                codecDirection === 'encode'
                  ? '输入要编码的文本，例如 你好 world'
                  : '输入要解码的文本，例如 %E4%BD%A0%E5%A5%BD%20world'
              }
              onChange={(event) => setCodecInput(event.target.value)}
            />
          </section>

          {codecResult.error && <p className="tool-error">{codecResult.error}</p>}

          <section className="tool-block">
            <div className="tool-block-head url-result-head">
              <div>
                <h2>{codecDirection === 'encode' ? '编码结果' : '解码结果'}</h2>
                <p>{codecMode === 'component' ? '按组件规则处理' : '按整条 URL 规则处理'}</p>
              </div>
              <button
                type="button"
                className={isCopied('codec') ? 'tool-button is-copied' : 'tool-button'}
                disabled={!codecResult.value}
                onClick={() => void copy(codecResult.value, 'codec')}
              >
                {isCopied('codec') ? '已复制' : '复制结果'}
              </button>
            </div>
            <textarea
              className="tool-editor is-output url-codec-text"
              value={codecResult.value}
              readOnly
              spellCheck={false}
              aria-label="编码解码结果"
              placeholder="结果会出现在这里"
            />
          </section>
        </>
      )}
    </div>
  )
}
