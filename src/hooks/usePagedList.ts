import { useEffect, useRef, useState } from 'react'
import type { DependencyList, Dispatch, SetStateAction } from 'react'
import { errorMessage, isNotFound } from '@/api/errors'
import { PAGE_SIZE } from '@/constants'
import type { ListStatus, Page } from '@/types'

export interface PagedListOptions {
  /**
   * 受控页码：页码存在 URL 里的页面（博客列表）传它，组件不再自己维护页码。
   * 不传则由 hook 自己管页码。
   */
  page?: number
  /** 受控模式下换页的回调 */
  onPageChange?: (next: number) => void
  /** 影响这一页内容的筛选参数；变化即重新取当前页（页面负责把页码归零） */
  deps?: DependencyList
  /** 404 视为「接口尚未部署」而不是出错 */
  treat404AsMissing?: boolean
}

export interface PagedListApi<T> {
  items: T[]
  /** 接口返回的 total；列表接口没给时为 null（不要用 items.length 冒充） */
  total: number | null
  hasNext: boolean
  pageIndex: number
  status: ListStatus
  error: string
  /** 本地替换整页数据：批量删除后先移除已删条目，也可以传函数式更新 */
  setItems: Dispatch<SetStateAction<T[]>>
  /** 换页；同页调用等于强制刷新 */
  goToPage: (next: number) => void
  /** 同页强制重取（本地改动后与服务端对齐） */
  reload: () => void
  /** 回到第 1 页并清空（筛选条件变化、新建数据后使用） */
  reset: () => void
  /** 错误重试：与 reload 相同，语义上更明确 */
  retry: () => void
}

/**
 * 「取一页、替换整页」的分页列表。
 *
 * 与 useInfiniteList 的关键区别：本 hook 永远替换当前页，不追加；
 * 因此任何 reload / reset 都不会把数据叠成两遍（个人空间曾因混用两种语义而出现重复条目）。
 */
export function usePagedList<T>(
  fetcher: (limit: number, offset: number) => Promise<Page<T>>,
  options: PagedListOptions = {},
): PagedListApi<T> {
  const { page, onPageChange, deps = [], treat404AsMissing = false } = options

  const [internalPage, setInternalPage] = useState(0)
  const [items, setItems] = useState<T[]>([])
  const [total, setTotal] = useState<number | null>(null)
  const [hasNext, setHasNext] = useState(false)
  const [status, setStatus] = useState<ListStatus>('loading')
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  const pageIndex = page ?? internalPage

  const fetcherRef = useRef(fetcher)
  useEffect(() => {
    fetcherRef.current = fetcher
  })

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    setError('')
    fetcherRef
      .current(PAGE_SIZE, pageIndex * PAGE_SIZE)
      .then((result) => {
        if (cancelled) return
        setItems(result.items)
        setHasNext(result.has_next)
        setTotal(result.total ?? null)
        setStatus('ready')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        if (treat404AsMissing && isNotFound(err)) {
          setItems([])
          setStatus('missing')
          return
        }
        setError(errorMessage(err))
        setStatus('error')
      })
    return () => {
      cancelled = true
    }
    // 页码 / 强制刷新 / 调用方给的筛选参数
  }, [pageIndex, reloadKey, treat404AsMissing, ...deps])

  const beginLoading = () => {
    setStatus('loading')
    setError('')
  }

  const goToPage = (next: number) => {
    const target = Math.max(0, next)
    if (page === undefined) {
      beginLoading()
      setInternalPage(target)
      // 同页时也要能强制刷新：页码不变不会触发上面的 effect，靠 reloadKey 推进
      setReloadKey((key) => key + 1)
      return
    }
    // 受控模式只通知页码变化，由调用方写进 URL；effect 会跟着 page 重取，别在这里再 bump 一次
    onPageChange?.(target)
  }

  const reload = () => {
    beginLoading()
    setReloadKey((key) => key + 1)
  }

  const reset = () => {
    beginLoading()
    setItems([])
    setTotal(null)
    if (page === undefined) setInternalPage(0)
    else onPageChange?.(0)
    setReloadKey((key) => key + 1)
  }

  return {
    items,
    total,
    hasNext,
    pageIndex,
    status,
    error,
    setItems,
    goToPage,
    reload,
    reset,
    retry: reload,
  }
}
