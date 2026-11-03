import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import MainLayout from '@/components/Layout/MainLayout'
import DocsHome from '@/pages/DocsHome'
import Docs from '@/pages/Docs'
import Profile from '@/pages/Profile'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        {/* 知识库一组，共用顶部+侧边布局 */}
        <Route element={<MainLayout />}>
          <Route path="/" element={<DocsHome />} />
          <Route path="/docs/:slug" element={<Docs />} />
        </Route>
        {/* Profile独立页面，不套布局，没有菜单侧边 */}
        <Route path="/profile" element={<Profile />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)
