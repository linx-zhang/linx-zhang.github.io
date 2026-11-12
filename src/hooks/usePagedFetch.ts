import { useEffect, useRef, useState } from 'react'
import { errorMessage } from '@/api/client'
import { PAGE_SIZE } from '@/utils/format'

export type PagedStatus = 'loading' | 'ready' | 'error'

export interface PagedFetch<T> {
  items: T[]
  /** 直接替换当前页数据，用于批量删除后先本地移除已删条目 */
  setItems: (next: T[]) => void
  pageIndex: number
  hasNext: boolean
  status: PagedStatus
  error: string
  goToPage: (next: number) => void
  retry: () => void
}

/**
 * 「取一页」的通用分页加载：多取一条判断是否还有下一页，
 * 统一 loading / ready / error 三态与重试。
 */
export function usePagedFetch<T>(
  fetcher: (limit: number, offset: number) => Promise<T[]>,
): PagedFetch<T> {
  const [pageIndex, setPageIndex] = useState(0)
  const [items, setItems] = useState<T[]>([])
  const [hasNext, setHasNext] = useState(false)
  const [status, setStatus] = useState<PagedStatus>('loading')
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  const fetcherRef = useRef(fetcher)

  // 每次渲染后同步最新的 fetcher，避免它成为 effect 依赖导致循环请求
  useEffect(() => {
    fetcherRef.current = fetcher
  })

  useEffect(() => {
    let cancelled = false
    fetcherRef
      .current(PAGE_SIZE + 1, pageIndex * PAGE_SIZE)
      .then((rows) => {
        if (cancelled) return
        setItems(rows.slice(0, PAGE_SIZE))
        setHasNext(rows.length > PAGE_SIZE)
        setStatus('ready')
      })
      .catch((err) => {
        if (cancelled) return
        setError(errorMessage(err))
        setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [pageIndex, reloadKey])

  const goToPage = (next: number) => {
    setStatus('loading')
    setError('')
    setPageIndex(Math.max(0, next))
  }

  const retry = () => {
    setStatus('loading')
    setError('')
    setReloadKey((key) => key + 1)
  }

  return { items, setItems, pageIndex, hasNext, status, error, goToPage, retry }
}
