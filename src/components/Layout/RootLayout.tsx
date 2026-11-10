import { Outlet, NavLink } from 'react-router-dom'
import { ActivityTracker } from '@/activity'
import AuthProvider from '@/auth/AuthProvider'
import { usePermission } from '@/auth/usePermission'
import AuthMenu from '@/components/AuthMenu'
import './RootLayout.css'

function GlobalNav() {
  const { has } = usePermission()

  return (
    <nav className="nav">
      <NavLink to="/" end className="nav-item">首页</NavLink>
      <NavLink to="/wiki" className="nav-item">知识库</NavLink>
      <NavLink to="/blog" className="nav-item">博客</NavLink>
      <NavLink to="/profile" className="nav-item">简历</NavLink>
      {has('invite_code:read:any') && (
        <NavLink to="/admin" className="nav-item">管理后台</NavLink>
      )}
    </nav>
  )
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <ActivityTracker />
      <div className="root-container">
        <header className="global-header no-print">
          <div className="header-inner">
            <GlobalNav />
            <AuthMenu />
          </div>
        </header>

        <main className="main-content">
          <Outlet />
        </main>

        <footer className="global-footer no-print">
          &copy; Linx Zhang
        </footer>
      </div>
    </AuthProvider>
  )
}
