import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'

import RootLayout from '@/components/Layout/RootLayout'
import WikiLayout from '@/components/Layout/WikiLayout'
import Home from '@/pages/Home'
import DocsHome from '@/pages/DocsHome'
import Docs from '@/pages/Docs'
import Profile from '@/pages/Profile'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<RootLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/wiki" element={<WikiLayout />}>
            <Route index element={<DocsHome />} />
            <Route path=":slug" element={<Docs />} />
          </Route>
        </Route>
        <Route path="/profile" element={<Profile />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)
