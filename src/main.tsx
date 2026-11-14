import React, { Suspense, lazy } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './styles/layers.css'

import ErrorBoundary from '@/components/ErrorBoundary'
import RouteFallback from '@/components/RouteFallback'
import AuthProvider from '@/auth/AuthProvider'
import { ActivityTracker } from '@/activity'
import RootLayout from '@/components/Layout/RootLayout'
import WikiLayout from '@/components/Layout/WikiLayout'
import Home from '@/pages/Home'
import DocsHome from '@/pages/DocsHome'
import Profile from '@/pages/Profile'
import Admin from '@/pages/Admin'
import Space from '@/pages/Space'
import Tools from '@/pages/Tools'
import RequirePermission from '@/components/RequirePermission'
import { APP_ROUTES, isKnownDeepLink } from '@/routes'

// 体量最大且只在深层页面用到的三块单独成包（Markdown / Prism / rehype 都在它们里面），
// 不再拖进首屏主包。DocsHome / Home / Space 这类首屏或常用页保持静态，切页不闪占位。
const Docs = lazy(() => import('@/pages/Docs'))
const Blog = lazy(() => import('@/pages/Blog'))
const PostDetail = lazy(() => import('@/pages/Blog/PostDetail'))

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
      {/* 错误边界必须在 Provider 外层：Provider 自己崩了也要能显示降级页 */}
      <ErrorBoundary>
        <AuthProvider>
          <ActivityTracker />
          <Routes>
            <Route element={<RootLayout />}>
              <Route path={APP_ROUTES.home} element={<Home />} />
              <Route path={APP_ROUTES.wiki} element={<WikiLayout />}>
                <Route index element={<DocsHome />} />
                <Route
                  path="*"
                  element={
                    <Suspense fallback={<RouteFallback />}>
                      <Docs />
                    </Suspense>
                  }
                />
              </Route>
              <Route
                path={APP_ROUTES.blog}
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <Blog />
                  </Suspense>
                }
              />
              <Route
                path={`${APP_ROUTES.blog}/:id`}
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <PostDetail />
                  </Suspense>
                }
              />
              <Route path={APP_ROUTES.space} element={<Space />} />
              <Route path={APP_ROUTES.tools} element={<Tools />} />
              {/* 共享剪切板的阅读链接：/tools/clip/<code>，必须排在通用 :slug 之前 */}
              <Route path={`${APP_ROUTES.tools}/clip/:code`} element={<Tools />} />
              <Route path={`${APP_ROUTES.tools}/:slug`} element={<Tools />} />
              <Route
                path={APP_ROUTES.admin}
                element={
                  <RequirePermission permission="invite_code:read:any">
                    <Admin />
                  </RequirePermission>
                }
              />
            </Route>
            {/* 简历保留独立页语义（不套站点导航），但已与全站共用同一套登录态与访问统计 */}
            <Route path={APP_ROUTES.profile} element={<Profile />} />
          </Routes>
        </AuthProvider>
      </ErrorBoundary>
    </BrowserRouter>
  </React.StrictMode>,
)
