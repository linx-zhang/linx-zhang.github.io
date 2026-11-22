import './SpaceSkeleton.css'

interface Props {
  /** 列表容器的类名：备忘录传 space-list，消耗品传 space-item-list */
  className: string
  rows?: number
}

/** 列表加载中的骨架行，和真实卡片同一位置，避免慢网时页面像空数据 */
export default function SpaceSkeleton({ className, rows = 3 }: Props) {
  return (
    <div className={className} role="status" aria-busy="true" aria-label="加载中">
      {Array.from({ length: rows }, (_, row) => (
        <article key={row} className="space-skeleton">
          <span className="space-skeleton-box" />
          <div className="space-skeleton-lines">
            <span className="space-skeleton-line" />
            <span className="space-skeleton-line is-short" />
          </div>
        </article>
      ))}
    </div>
  )
}
