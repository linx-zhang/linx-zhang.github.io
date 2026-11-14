import type { ReactNode } from 'react'

interface PagerProps {
  /** 当前页（0 起） */
  pageIndex: number
  hasNext: boolean
  /** 换页回调；页码由调用方的列表状态机负责，组件只管点击 */
  onPage: (next: number) => void
  /** 总页数：接口返回 total 的 tab 传它，没有 total 就只显示当前页 */
  totalPages?: number
  /** 有请求在飞或批量操作进行中时禁用翻页 */
  disabled?: boolean
  /** 容器类名：各 tab 的既有间距样式不同，默认沿用后台通行的 admin-pager */
  className?: string
}

/**
 * 后台各 tab 共用的翻页条。
 * 之前四个 tab 各写一份同样的三段结构，改文案或加「跳页」时要改四处。
 */
export default function Pager({
  pageIndex,
  hasNext,
  onPage,
  totalPages,
  disabled = false,
  className = 'admin-pager',
}: PagerProps): ReactNode {
  const pageLabel = totalPages ? `第 ${pageIndex + 1} / ${totalPages} 页` : `第 ${pageIndex + 1} 页`
  return (
    <div className={className}>
      <button
        type="button"
        className="blog-button"
        disabled={disabled || pageIndex === 0}
        onClick={() => onPage(pageIndex - 1)}
      >
        上一页
      </button>
      <span>{pageLabel}</span>
      <button
        type="button"
        className="blog-button"
        disabled={disabled || !hasNext}
        onClick={() => onPage(pageIndex + 1)}
      >
        下一页
      </button>
    </div>
  )
}
