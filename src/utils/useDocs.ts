import { useEffect, useState } from 'react'
import { loadDocList, peekDocList, type DocItem } from './docs'

interface DocListState {
  docs: DocItem[] | null
  error: string | null
}

/** 知识库目录的唯一入口：组件首次挂载时按需拉一次 /wiki/index.json */
export function useDocList(): DocListState {
  const [docs, setDocs] = useState<DocItem[] | null>(peekDocList())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (docs) return
    let cancelled = false
    loadDocList()
      .then((list) => {
        if (!cancelled) setDocs(list)
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : '文档索引加载失败')
      })
    return () => {
      cancelled = true
    }
  }, [docs])

  return { docs, error }
}
