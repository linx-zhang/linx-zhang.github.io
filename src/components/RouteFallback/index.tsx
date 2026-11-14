import './RouteFallback.css'

/** 路由级 Suspense 占位：懒加载页面尚未就绪时显示，避免整页闪白 */
export default function RouteFallback() {
  return (
    <div className="route-fallback" role="status" aria-live="polite">
      加载中…
    </div>
  )
}
