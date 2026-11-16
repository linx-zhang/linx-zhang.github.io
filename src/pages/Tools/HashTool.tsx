import { useEffect, useRef, useState } from 'react'
import { useCopy } from '@/hooks/useCopy'
import { HASH_ALGORITHMS, formatBytes, formatFileTime, hashFile, normalizeHash, verifyHash } from './hash'
import type { HashAlgorithm, HashResults } from './hash'

interface Entry {
  file: File
  hashes: HashResults
  error?: string
}

const DEFAULT_ALGORITHMS: HashAlgorithm[] = ['sha256', 'md5']

export default function HashTool() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [algorithms, setAlgorithms] = useState<HashAlgorithm[]>(DEFAULT_ALGORITHMS)
  const [progress, setProgress] = useState<{ index: number; ratio: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [verifyText, setVerifyText] = useState('')
  const { copy, isCopied } = useCopy()

  // 异步循环里要读「此刻」的条目，不能靠闭包里的旧 state；所有写入都走这份 ref
  const entriesRef = useRef<Entry[]>([])
  const abortRef = useRef<AbortController | null>(null)
  const applyEntries = (next: Entry[]) => {
    entriesRef.current = next
    setEntries(next)
  }

  useEffect(
    () => () => {
      abortRef.current?.abort()
    },
    [],
  )

  const run = async (list: File[], algs: HashAlgorithm[], onlyMissing: boolean) => {
    abortRef.current?.abort()
    if (!list.length) {
      applyEntries([])
      setProgress(null)
      setBusy(false)
      return
    }
    if (!algs.length) {
      applyEntries(list.map((file) => ({ file, hashes: {} })))
      setProgress(null)
      setBusy(false)
      return
    }

    const controller = new AbortController()
    abortRef.current = controller
    if (!onlyMissing) applyEntries(list.map((file) => ({ file, hashes: {} })))
    setBusy(true)

    for (let index = 0; index < list.length; index += 1) {
      if (controller.signal.aborted) return
      const entry = entriesRef.current[index]
      if (!entry) continue
      const missing = algs.filter((algorithm) => !entry.hashes[algorithm])
      if (!missing.length) continue

      setProgress({ index, ratio: 0 })
      try {
        const hashes = await hashFile(entry.file, missing, {
          signal: controller.signal,
          onProgress: (ratio) => {
            if (!controller.signal.aborted) setProgress({ index, ratio })
          },
        })
        if (controller.signal.aborted) return
        applyEntries(
          entriesRef.current.map((item, i) =>
            i === index ? { ...item, hashes: { ...item.hashes, ...hashes }, error: undefined } : item,
          ),
        )
      } catch (err) {
        if ((err as Error)?.name === 'AbortError' || controller.signal.aborted) return
        applyEntries(
          entriesRef.current.map((item, i) =>
            i === index ? { ...item, error: `读取失败：${(err as Error)?.message ?? '未知错误'}` } : item,
          ),
        )
      }
    }

    if (!controller.signal.aborted) {
      setBusy(false)
      setProgress(null)
    }
  }

  const selectFiles = (list: File[]) => {
    setVerifyText('')
    void run(list, algorithms, false)
  }

  const toggleAlgorithm = (algorithm: HashAlgorithm, checked: boolean) => {
    const next = HASH_ALGORITHMS.map((item) => item.value).filter((value) =>
      value === algorithm ? checked : algorithms.includes(value),
    )
    setAlgorithms(next)
    void run(
      entriesRef.current.map((entry) => entry.file),
      next,
      true,
    )
  }

  const hasResult = entries.some((entry) => Object.keys(entry.hashes).length > 0)
  const current = progress ? entries[progress.index] : undefined
  const currentRatio = progress?.ratio ?? 0

  const verifyState = (() => {
    if (!verifyText.trim() || !hasResult) return null
    if (!normalizeHash(verifyText)) {
      return { ok: false, text: '看起来不是一段哈希：MD5 32 位、SHA-1 40 位、SHA-256 64 位、SHA-512 128 位' }
    }
    for (const entry of entries) {
      const hit = verifyHash(verifyText, entry.hashes)
      if (hit) return { ok: true, text: `与 ${entry.file.name} 的 ${hit.label} 一致` }
    }
    return { ok: false, text: '与已算出的哈希都不一致' }
  })()

  return (
    <div className="tool tool-stack">
      <label
        className={dragOver ? 'tool-drop is-over' : 'tool-drop'}
        onDragOver={(event) => {
          event.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragOver(false)
          const list = Array.from(event.dataTransfer.files)
          if (list.length) selectFiles(list)
        }}
      >
        <input
          type="file"
          multiple
          className="tool-drop-input"
          onChange={(event) => {
            const list = Array.from(event.target.files ?? [])
            if (list.length) selectFiles(list)
            event.target.value = ''
          }}
        />
        <span className="tool-drop-main">把文件拖到这里，或点击选择</span>
        <span className="tool-drop-hint">
          文件在本机读取，不上传、不保存；支持一次选多个，大文件按 8MB 分块算，内存占用不变。
        </span>
      </label>

      <div className="tool-bar">
        <span className="tool-inline">算法</span>
        {HASH_ALGORITHMS.map((item) => (
          <label key={item.value} className="tool-check">
            <input
              type="checkbox"
              checked={algorithms.includes(item.value)}
              onChange={(event) => toggleAlgorithm(item.value, event.target.checked)}
            />
            {item.label}
          </label>
        ))}
      </div>

      {entries.length > 0 && (
        <div className="hash-actions">
          <span className="tool-meta">
            {entries.length} 个文件{progress && current ? ' · 正在计算' : ''}
          </span>
          <button type="button" className="tool-mini" disabled={busy} onClick={() => selectFiles([])}>
            清空
          </button>
        </div>
      )}

      {progress && current && (
        <div className="hash-progress">
          <div className="hash-progress-track">
            <div className="hash-progress-fill" style={{ width: `${Math.round(currentRatio * 100)}%` }} />
          </div>
          <span className="tool-meta">
            {current.file.name} · {Math.round(currentRatio * 100)}% · {formatBytes(Math.round(current.file.size * currentRatio))} /
            {' '}
            {formatBytes(current.file.size)}
          </span>
        </div>
      )}

      {!algorithms.length && <p className="tool-error">至少选一个算法</p>}

      {entries.map((entry, index) => (
        <section className="hash-file" key={`${entry.file.name}-${index}`}>
          <div className="hash-file-head">
            <strong title={entry.file.name}>{entry.file.name}</strong>
            <span className="tool-meta">
              {formatBytes(entry.file.size)} · 修改于 {formatFileTime(entry.file.lastModified)}
            </span>
          </div>

          {entry.error && <p className="tool-error">{entry.error}</p>}

          <ul className="hash-rows">
            {HASH_ALGORITHMS.filter((item) => algorithms.includes(item.value)).map((item) => {
              const value = entry.hashes[item.value]
              const key = `${index}-${item.value}`
              return (
                <li className="hash-row" key={item.value}>
                  <span className="hash-alg">{item.label}</span>
                  <code className="hash-value">{value ?? (busy ? '计算中…' : '—')}</code>
                  <button
                    type="button"
                    className={isCopied(key) ? 'tool-mini is-copied' : 'tool-mini'}
                    disabled={!value}
                    onClick={() => value && void copy(value, key)}
                  >
                    {isCopied(key) ? '已复制' : '复制'}
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}

      {hasResult && (
        <div className="hash-verify">
          <label className="tool-inline" htmlFor="hash-verify-input">
            校验
          </label>
          <input
            id="hash-verify-input"
            className="tool-input"
            value={verifyText}
            spellCheck={false}
            placeholder="粘贴发布方给的哈希…"
            onChange={(event) => setVerifyText(event.target.value)}
          />
          {verifyState ? (
            <p className={verifyState.ok ? 'hash-verdict is-match' : 'hash-verdict is-miss'}>
              {verifyState.ok ? '✓ ' : '✗ '}
              {verifyState.text}
            </p>
          ) : (
            <p className="hash-hint">大小写、空格、文件名都不影响比对</p>
          )}
        </div>
      )}
    </div>
  )
}
