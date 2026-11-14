import { useEffect, useRef, useState } from 'react'
import type { DependencyList } from 'react'
import { errorMessage, isNotFound } from '@/api/errors'
import type { ListStatus } from '@/types'

/** 四态与列表状态机一致，避免同一套语义出现两种拼写 */
export type ResourceStatus = ListStatus

export interface ResourceOptions {
  /** false 时不发请求（例如参数还没准备好），状态保持 ready */
  enabled?: boolean
  /** 404 视为「不存在」而非「出错」（详情页用） */
  treat404AsMissing?: boolean
  /** 失败时静默：可选区块（上一篇/下一篇）不要因为一次失败弹错误 */
  silent?: boolean
}

export interface ResourceApi<T> {
  data: T | null
  status: ResourceStatus
  error: string
  reload: () => void
  /** 本地替换数据（编辑保存、乐观更新后用服务端返回值对齐） */
  setData: (next: T | null) => void
}

/**
 * 单资源取数：自动处理 loading / ready / error / missing 四态、卸载取消、参数变化重取。
 *
 * 与 usePagedList / useInfiniteList 的分工：
 * - 单条或整块数据（文章、分析汇总、评论列表）→ useResource
 * - 分页替换列表（后台各 tab）→ usePagedList
 * - 追加加载（个人空间）→ useInfiniteList
 */
export function useResource<T>(
  loader: () => Promise<T>,
  deps: DependencyList,
  options: ResourceOptions = {},
): ResourceApi<T> {
  const { enabled = true, treat404AsMissing = false, silent = false } = options
  const loaderRef = useRef(loader)
  const [data, setData] = useState<T | null>(null)
  const [status, setStatus] = useState<ResourceStatus>(enabled ? 'loading' : 'ready')
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  // 每次渲染后同步最新 loader，避免它成为 effect 依赖导致无限请求
  useEffect(() => {
    loaderRef.current = loader
  })

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    setStatus('loading')
    setError('')
    loaderRef
      .current()
      .then((value) => {
        if (cancelled) return
        setData(value)
        setStatus('ready')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        if (treat404AsMissing && isNotFound(err)) {
          setData(null)
          setStatus('missing')
          return
        }
        if (silent) {
          setData(null)
          setStatus('ready')
          return
        }
        setError(errorMessage(err))
        setStatus('error')
      })
    return () => {
      cancelled = true
    }
    // deps 由调用方给出：资源身份 + 影响请求的参数
  }, [enabled, treat404AsMissing, silent, reloadKey, ...deps])

  const reload = () => setReloadKey((key) => key + 1)

  return { data, status, error, reload, setData }
}
