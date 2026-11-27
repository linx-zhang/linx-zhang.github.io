/**
 * 大文件用 useDeferredValue 延后重算，连续输入时不会每敲一个字都整份 diff。
 * 结果行加 content-visibility，10 万行时只布局视口附近的行。
 */
import { useDeferredValue, useMemo, useRef, useState } from 'react'
import { useCopy } from '@/hooks/useCopy'
import {
  MAX_DIFF_LINES,
  MAX_FILE_BYTES,
  diffStats,
  diffText,
  diffToText,
  filterDiffRows,
  isTextLikeFile,
  splitLines,
} from './diff'
import './DiffTool.css'

type Side = 'old' | 'new'

interface FileMeta {
  name: string
  size: number
}

function fileSizeText(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export default function DiffTool() {
  const [oldText, setOldText] = useState('')
  const [newText, setNewText] = useState('')
  const [oldFile, setOldFile] = useState<FileMeta | null>(null)
  const [newFile, setNewFile] = useState<FileMeta | null>(null)
  const [ignoreTrailingWhitespace, setIgnoreTrailingWhitespace] = useState(false)
  const [onlyDiff, setOnlyDiff] = useState(false)
  const [fileError, setFileError] = useState('')
  const [dragging, setDragging] = useState<Side | null>(null)
  const { copy, isCopied } = useCopy()
  const oldInputRef = useRef<HTMLInputElement | null>(null)
  const newInputRef = useRef<HTMLInputElement | null>(null)

  const deferredOldText = useDeferredValue(oldText)
  const deferredNewText = useDeferredValue(newText)
  const rows = useMemo(
    () =>
      deferredOldText || deferredNewText
        ? diffText(deferredOldText, deferredNewText, { ignoreTrailingWhitespace })
        : [],
    [deferredOldText, deferredNewText, ignoreTrailingWhitespace],
  )
  const stats = diffStats(rows)
  const visibleRows = filterDiffRows(rows, onlyDiff)

  const loadFile = async (side: Side, file: File) => {
    setFileError('')
    if (!isTextLikeFile(file)) {
      setFileError(`「${file.name}」看起来不是文本文件；这里只读 txt、log、json、sql、md、代码等文本内容。`)
      return
    }
    if (file.size > MAX_FILE_BYTES) {
      setFileError(`「${file.name}」有 ${fileSizeText(file.size)}，超过单边 1 GB 上限；请先截取需要比较的片段。`)
      return
    }
    try {
      const text = await file.text()
      const lines = splitLines(text)
      if (lines.length > MAX_DIFF_LINES) {
        setFileError(
          `「${file.name}」有 ${lines.length.toLocaleString('zh-CN')} 行，超过 ${MAX_DIFF_LINES.toLocaleString('zh-CN')} 行上限；请先截取片段。`,
        )
        return
      }
      const meta = { name: file.name, size: file.size }
      if (side === 'old') {
        setOldText(text)
        setOldFile(meta)
      } else {
        setNewText(text)
        setNewFile(meta)
      }
    } catch (err) {
      setFileError(`读取「${file.name}」失败：${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const clearSide = (side: Side) => {
    if (side === 'old') {
      setOldText('')
      setOldFile(null)
      if (oldInputRef.current) oldInputRef.current.value = ''
    } else {
      setNewText('')
      setNewFile(null)
      if (newInputRef.current) newInputRef.current.value = ''
    }
  }

  const swap = () => {
    setOldText(newText)
    setNewText(oldText)
    setOldFile(newFile)
    setNewFile(oldFile)
  }

  const fileBox = (side: Side, meta: FileMeta | null) => (
    <label
      className={dragging === side ? 'diff-file-box is-over' : 'diff-file-box'}
      onDragOver={(event) => {
        event.preventDefault()
        setDragging(side)
      }}
      onDragLeave={() => setDragging(null)}
      onDrop={(event) => {
        event.preventDefault()
        setDragging(null)
        const file = event.dataTransfer.files[0]
        if (file) void loadFile(side, file)
      }}
    >
      <input
        ref={side === 'old' ? oldInputRef : newInputRef}
        type="file"
        className="tool-drop-input"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void loadFile(side, file)
          event.target.value = ''
        }}
      />
      <span className="diff-file-title">{side === 'old' ? '原文本' : '新文本'}</span>
      <span className="diff-file-hint">
        {meta ? `${meta.name} · ${fileSizeText(meta.size)}` : '点击选择，或把文本文件拖进来'}
      </span>
    </label>
  )

  return (
    <div className="tool tool-stack">
      <section className="tool-block">
        <div className="tool-block-head">
          <h2>两份文本</h2>
          <p>按行比较，支持直接从文件读取；文件只在本机读，不上传。文件单边上限 1 GB / 10 万行。</p>
        </div>

        <div className="diff-file-grid">
          {fileBox('old', oldFile)}
          {fileBox('new', newFile)}
        </div>

        {fileError && <p className="tool-error">{fileError}</p>}

        <div className="diff-editor-grid">
          <div className="tool-pane">
            <div className="tool-pane-head">
              <span>原文本</span>
              {oldText && <span className="tool-meta">{splitLines(oldText).length} 行</span>}
            </div>
            <textarea
              className="tool-editor diff-editor"
              value={oldText}
              spellCheck={false}
              aria-label="原文本"
              placeholder="粘贴旧内容，或从上面的文件读取"
              onChange={(event) => {
                setOldText(event.target.value)
                setOldFile(null)
                setFileError('')
              }}
            />
          </div>
          <div className="tool-pane">
            <div className="tool-pane-head">
              <span>新文本</span>
              {newText && <span className="tool-meta">{splitLines(newText).length} 行</span>}
            </div>
            <textarea
              className="tool-editor diff-editor"
              value={newText}
              spellCheck={false}
              aria-label="新文本"
              placeholder="粘贴新内容，或从上面的文件读取"
              onChange={(event) => {
                setNewText(event.target.value)
                setNewFile(null)
                setFileError('')
              }}
            />
          </div>
        </div>

        <div className="tool-bar">
          <label className="tool-check">
            <input
              type="checkbox"
              checked={ignoreTrailingWhitespace}
              onChange={(event) => setIgnoreTrailingWhitespace(event.target.checked)}
            />
            忽略行尾空白
          </label>
          <label className="tool-check">
            <input
              type="checkbox"
              checked={onlyDiff}
              onChange={(event) => setOnlyDiff(event.target.checked)}
            />
            只看差异
          </label>
          <button type="button" className="tool-button" onClick={swap}>
            交换两边
          </button>
          <button
            type="button"
            className="tool-button tool-bar-end"
            onClick={() => {
              clearSide('old')
              clearSide('new')
              setFileError('')
            }}
          >
            清空
          </button>
        </div>
      </section>

      {(oldText || newText) && (
        <section className="tool-block">
          <div className="tool-block-head diff-result-head">
            <div>
              <h2>差异结果</h2>
              <p>
                新增 {stats.added} 行，删除 {stats.removed} 行，未变 {stats.unchanged} 行。
              </p>
            </div>
            {stats.added + stats.removed > 0 && (
              <button
                type="button"
                className={isCopied('diff') ? 'tool-button is-copied' : 'tool-button'}
                onClick={() => void copy(diffToText(rows), 'diff')}
              >
                {isCopied('diff') ? '已复制' : '复制差异'}
              </button>
            )}
          </div>

          {visibleRows.length === 0 ? (
            <p className="tool-empty">
              {stats.added + stats.removed === 0
                ? '两边内容完全一致。'
                : '当前只显示差异，但没有可显示的差异行。'}
            </p>
          ) : (
            <div className="diff-view">
              {visibleRows.map((row, index) => (
                <div className={`diff-row diff-${row.kind}`} key={`${row.oldLine ?? 0}-${row.newLine ?? 0}-${index}`}>
                  <span className="diff-line-no">{row.oldLine ?? ''}</span>
                  <span className="diff-line-no">{row.newLine ?? ''}</span>
                  <span className="diff-sign">{row.kind === 'add' ? '+' : row.kind === 'del' ? '−' : ' '}</span>
                  <code className="diff-text">{row.text || ' '}</code>
                </div>
              ))}
            </div>
          )}
          {rows.length > 0 && (
            <p className="tool-note">
              左列是原文本行号，右列是新文本行号；只对行做比较，不展开行内字符差异。
            </p>
          )}
        </section>
      )}
    </div>
  )
}
