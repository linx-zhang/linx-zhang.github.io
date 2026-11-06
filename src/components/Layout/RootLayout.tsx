import { Outlet, NavLink } from 'react-router-dom'
import AuthProvider from '@/auth/AuthProvider'
import AuthMenu from '@/components/AuthMenu'
import './RootLayout.css'

export default function RootLayout() {
  return (
    <AuthProvider>
      <div className="root-container">
        <header className="global-header no-print">
          <div className="header-inner">
            <nav className="nav">
              <NavLink to="/" end className="nav-item">首页</NavLink>
              <NavLink to="/wiki" className="nav-item">知识库</NavLink>
              <NavLink to="/blog" className="nav-item">博客</NavLink>
              <NavLink to="/profile" className="nav-item">简历</NavLink>
            </nav>
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
