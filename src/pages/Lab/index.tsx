import { useCallback, useEffect, useRef, useState } from 'react'
import './Lab.css'

// 远端 Worker 地址：只需改这一处即可切换数据源
const WORKER_URL = 'https://api-proxy.linx-zhang.workers.dev/'
const WORKER_HOST = new URL(WORKER_URL).host

type RequestState = 'loading' | 'success' | 'error'

export default function Lab() {
  const [state, setState] = useState<RequestState>('loading')
  const [count, setCount] = useState('')
  const [error, setError] = useState('')
  const [fetchedAt, setFetchedAt] = useState('')
  const lastRequestAt = useRef(0)
  const requestId = useRef(0)

  const fetchCount = useCallback(async (showLoading = true) => {
    // 1 秒内忽略重复触发，避免连点把计数器刷爆
    const now = Date.now()
    if (now - lastRequestAt.current < 1000) return
    lastRequestAt.current = now

    const id = ++requestId.current
    if (showLoading) {
      setState('loading')
      setError('')
    }

    try {
      const response = await fetch(WORKER_URL, { cache: 'no-store' })
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`.trim())
      }

      // Worker 返回纯文本数字，不按 JSON 处理
      const text = (await response.text()).trim()
      if (!/^[+-]?\d+$/.test(text)) {
        throw new Error(`响应不是整数：${text.slice(0, 32) || '(空响应)'}`)
      }

      if (id !== requestId.current) return
      setCount(text)
      setFetchedAt(new Date().toLocaleTimeString('zh-CN', { hour12: false }))
      setState('success')
    } catch (err) {
      if (id !== requestId.current) return
      const reason =
        err instanceof TypeError
          ? '无法连接 Worker（可能被 CORS 或网络拦截）'
          : err instanceof Error
            ? err.message
            : String(err)
      setError(reason)
      setState('error')
    }
  }, [])

  useEffect(() => {
    // 初始 state 已是 loading，延后一个任务再请求，避免 effect 内同步 setState
    const timer = window.setTimeout(() => void fetchCount(false), 0)
    return () => window.clearTimeout(timer)
  }, [fetchCount])

  return (
    <div className="lab-page">
      <section className="lab-card">
        <h1>远端计数器</h1>
        <p className="lab-subtitle">
          调用 Cloudflare Worker，验证博客到外部 API 的跨域链路。
        </p>

        <div className="lab-body" aria-live="polite">
          {state === 'loading' && (
            <>
              <div className="lab-skeleton" />
              <p className="lab-meta">正在请求…</p>
            </>
          )}

          {state === 'success' && (
            <>
              <div className="lab-count">{count}</div>
              <p className="lab-meta">
                来源 {WORKER_HOST} · 本次获取于 {fetchedAt}
              </p>
            </>
          )}

          {state === 'error' && (
            <>
              <p className="lab-error">请求失败</p>
              <p className="lab-error-reason">{error}</p>
            </>
          )}
        </div>

        <div className="lab-actions">
          <button
            type="button"
            className="lab-button"
            onClick={() => void fetchCount()}
            disabled={state === 'loading'}
          >
            {state === 'loading' ? '取数中…' : '再取一次'}
          </button>
        </div>
      </section>
    </div>
  )
}
