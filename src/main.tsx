import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'

import RootLayout from '@/components/Layout/RootLayout'
import WikiLayout from '@/components/Layout/WikiLayout'
import Home from '@/pages/Home'
import DocsHome from '@/pages/DocsHome'
import Docs from '@/pages/Docs'
import Profile from '@/pages/Profile'

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
    <BrowserRouter>
      <Routes>
        <Route element={<RootLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/wiki" element={<WikiLayout />}>
            <Route index element={<DocsHome />} />
            <Route path="*" element={<Docs />} />
          </Route>
        </Route>
        <Route path="/profile" element={<Profile />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)
