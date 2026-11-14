import type { ReactNode } from 'react'
import type { ListStatus } from '@/types'

interface ListStateProps {
  status: ListStatus
  error?: string
  onRetry?: () => void
  /** 已有数据的条数：加载中若还留着上一页数据，就不该提示「空空如也」 */
  count?: number
  /** ready 且无数据时的文案；不传则该状态不渲染 */
  emptyText?: string
  /** missing（404）视为「接口尚未部署」时的文案；不传则按空态处理 */
  missingText?: string
  className?: string
  loadingText?: string
}

/**
 * 列表三态占位（加载 / 失败 / 空）的唯一实现。
 *
 * 各列表页此前各写一份同样的 markup，文案与重试按钮的位置全靠自觉；
 * 现在统一成一处，页面只负责「什么时候该渲染列表」。
 */
export default function ListState({
  status,
  error,
  onRetry,
  count = 0,
  emptyText,
  missingText,
  className = 'user-empty',
  loadingText = '加载中…',
}: ListStateProps): ReactNode {
  if (status === 'loading') {
    return (
      <div className={className} aria-busy="true">
        {loadingText}
      </div>
    )
  }

  // 失败与「接口还没上线」是两种事实，但表现一致：一句说明 + 重试
  if (status === 'error' || (status === 'missing' && missingText)) {
    const text = status === 'error' ? error || '加载失败，请稍后重试。' : missingText
    return (
      <div className={className}>
        <p>{text}</p>
        {onRetry && (
          <button type="button" className="blog-button" onClick={onRetry}>
            重试
          </button>
        )}
      </div>
    )
  }

  if (status !== 'ready' || !emptyText || count > 0) return null

  return <div className={className}>{emptyText}</div>
}
