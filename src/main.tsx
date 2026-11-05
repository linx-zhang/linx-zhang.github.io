import React from 'react'
import ReactDOM from 'react-dom/client'
import AppRouter from '@/Router'

// GitHub Pages 深链兜底：public/404.html 会把原始路径写入 sessionStorage 并重定向到根路径。
// 必须在 BrowserRouter 初始化前恢复 URL，路由才能直接命中目标页面。
const FALLBACK_KEY = 'spa-fallback-path'
try {
  const fallbackPath = sessionStorage.getItem(FALLBACK_KEY)
  if (fallbackPath) {
    sessionStorage.removeItem(FALLBACK_KEY)
    const isAppPath =
      fallbackPath === '/wiki' ||
      fallbackPath.startsWith('/wiki/') ||
      fallbackPath === '/profile'
    if (isAppPath) {
      window.history.replaceState(null, '', fallbackPath)
    }
  }
} catch {
  // 隐私模式下 sessionStorage 不可用时忽略，按根路径渲染
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppRouter />
  </React.StrictMode>,
)
