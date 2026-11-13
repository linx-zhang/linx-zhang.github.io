import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './styles/layers.css'

import RootLayout from '@/components/Layout/RootLayout'
import WikiLayout from '@/components/Layout/WikiLayout'
import Home from '@/pages/Home'
import DocsHome from '@/pages/DocsHome'
import Docs from '@/pages/Docs'
import Profile from '@/pages/Profile'
import Blog from '@/pages/Blog'
import PostDetail from '@/pages/Blog/PostDetail'
import Admin from '@/pages/Admin'
import Space from '@/pages/Space'
import RequirePermission from '@/components/RequirePermission'
import { APP_ROUTES, isKnownDeepLink } from '@/routes'

// GitHub Pages 深链兜底：public/404.html 会把原始路径写入 sessionStorage 并重定向到根路径。
// 必须在 BrowserRouter 初始化前恢复 URL，路由才能直接命中目标页面。
const FALLBACK_KEY = 'spa-fallback-path'
try {
  const fallbackPath = sessionStorage.getItem(FALLBACK_KEY)
  if (fallbackPath) {
    sessionStorage.removeItem(FALLBACK_KEY)
    if (isKnownDeepLink(fallbackPath)) {
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
          <Route path={APP_ROUTES.home} element={<Home />} />
          <Route path={APP_ROUTES.wiki} element={<WikiLayout />}>
            <Route index element={<DocsHome />} />
            <Route path="*" element={<Docs />} />
          </Route>
          <Route path={APP_ROUTES.blog} element={<Blog />} />
          <Route path={`${APP_ROUTES.blog}/:id`} element={<PostDetail />} />
          <Route path={APP_ROUTES.space} element={<Space />} />
          <Route
            path={APP_ROUTES.admin}
            element={
              <RequirePermission permission="invite_code:read:any">
                <Admin />
              </RequirePermission>
            }
          />
        </Route>
        <Route path={APP_ROUTES.profile} element={<Profile />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)
