import { Suspense, lazy, type ReactNode } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'

import RootLayout from '@/components/Layout/RootLayout'
import Home from '@/pages/Home'

const WikiLayout = lazy(() => import('@/components/Layout/WikiLayout'))
const DocsHome = lazy(() => import('@/pages/DocsHome'))
const Docs = lazy(() => import('@/pages/Docs'))
const Profile = lazy(() => import('@/pages/Profile'))

// 懒加载路由的加载态：只替换内容区，避免整页布局闪烁
function RouteBoundary({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div style={{ padding: 24, fontFamily: 'monospace', color: '#4b5563' }}>加载中…</div>}>
      {children}
    </Suspense>
  )
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<RootLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/wiki" element={<RouteBoundary><WikiLayout /></RouteBoundary>}>
            <Route index element={<RouteBoundary><DocsHome /></RouteBoundary>} />
            <Route path="*" element={<RouteBoundary><Docs /></RouteBoundary>} />
          </Route>
        </Route>
        <Route path="/profile" element={<RouteBoundary><Profile /></RouteBoundary>} />
      </Routes>
    </BrowserRouter>
  )
}
