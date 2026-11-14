import { useEffect, useRef, useState } from 'react'
import { errorMessage } from '@/api/errors'
import { PAGE_SIZE } from '@/constants'
import type { ListStatus, Page } from '@/types'

export interface InfiniteListOptions {
  /** false 时不发请求（例如未登录、参数未就绪）；翻页与刷新之后仍按最新 enabled 生效 */
  enabled?: boolean
}

export interface InfiniteListApi<T> {
  items: T[]
  hasNext: boolean
  /** 已加载到第几页（从 0 开始） */
  pageIndex: number
  status: ListStatus
  error: string
  /** 本地改整份列表：乐观更新 / 就地删除用 */
  setItems: (updater: T[] | ((prev: T[]) => T[])) => void
  /** 追加下一页 */
  loadMore: () => void
  /** 回到第 1 页并清空后重取（新建、切筛选、需要服务端重新排序时用） */
  reload: () => void
  retry: () => void
}

/**
 * 「先看到一页、再按需追加」的无限列表（个人空间）。
 *
 * 语义边界（这正是此前的缺陷来源）：追加与刷新是两条路。
 * - loadMore 只会追加第 N 页（N > 0）；
 * - reload 一定清空并回到第 0 页，绝不会把同一页再追加一遍。
 */
export function useInfiniteList<T>(
  fetcher: (limit: number, offset: number) => Promise<Page<T>>,
  options: InfiniteListOptions = {},
): InfiniteListApi<T> {
  const { enabled = true } = options
  const [items, setItemsState] = useState<T[]>([])
  const [hasNext, setHasNext] = useState(false)
  const [pageIndex, setPageIndex] = useState(0)
  const [status, setStatus] = useState<ListStatus>('loading')
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  const fetcherRef = useRef(fetcher)
  useEffect(() => {
    fetcherRef.current = fetcher
  })

  // 本次请求是「首页替换」还是「追加」：由触发动作决定，而不是由 pageIndex 猜
  const appendRef = useRef(false)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    fetcherRef
      .current(PAGE_SIZE, pageIndex * PAGE_SIZE)
      .then((result) => {
        if (cancelled) return
        if (appendRef.current && pageIndex > 0) {
          setItemsState((prev) => [...prev, ...result.items])
        } else {
          setItemsState(result.items)
        }
        setHasNext(result.has_next)
        setStatus('ready')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(errorMessage(err))
        setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [pageIndex, reloadKey, enabled])

  const setItems: InfiniteListApi<T>['setItems'] = (updater) => {
    setItemsState((prev) =>
      typeof updater === 'function' ? (updater as (value: T[]) => T[])(prev) : updater,
    )
  }

  const loadMore = () => {
    appendRef.current = true
    setStatus('loading')
    setError('')
    setPageIndex((index) => index + 1)
  }

  const reload = () => {
    appendRef.current = false
    setStatus('loading')
    setError('')
    setItemsState([])
    setPageIndex(0)
    setReloadKey((key) => key + 1)
  }

  return {
    items,
    hasNext,
    pageIndex,
    status,
    error,
    setItems,
    loadMore,
    reload,
    retry: reload,
  }
}
