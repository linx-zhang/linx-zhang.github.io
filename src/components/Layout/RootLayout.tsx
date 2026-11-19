import { Outlet, NavLink } from 'react-router-dom'
import { ADMIN_AREA_PERMISSIONS } from '@/auth/adminAccess'
import { usePermission } from '@/auth/usePermission'
import AuthMenu from '@/components/AuthMenu'
import './RootLayout.css'

function GlobalNav() {
  const { hasAny } = usePermission()

  return (
    <nav className="nav">
      <NavLink to="/" end className="nav-item">首页</NavLink>
      <NavLink to="/wiki" className="nav-item">知识库</NavLink>
      <NavLink to="/blog" className="nav-item">博客</NavLink>
      <NavLink to="/tools" className="nav-item">工具箱</NavLink>
      {/* 空间未登录也能看日期与说明，所以对所有人开放；简历入口在首页卡片 */}
      <NavLink to="/space" className="nav-item">个人空间</NavLink>
      {hasAny(...ADMIN_AREA_PERMISSIONS) && (
        <NavLink to="/admin" className="nav-item">管理后台</NavLink>
      )}
    </nav>
  )
}

/**
 * 只有视觉外壳：导航 + 内容区 + 页脚。
 * AuthProvider 与活跃上报在 main.tsx 的根上，这样 /profile 这类不套外壳的页面
 * 也有登录态与访问统计，不会再出现「同一站点两套运行时」。
 */
export default function RootLayout() {
  return (
    <div className="root-container">
      <header className="global-header no-print">
        <div className="header-inner">
          {/* 站点名只在窄屏出现：那里导航会换到第二行，第一行空着会显得没头 */}
          <span className="header-brand">Linx Zhang</span>
          <GlobalNav />
          <AuthMenu />
        </div>
      </header>

      <main className="main-content">
        <Outlet />
      </main>

      <footer className="global-footer no-print">&copy; Linx Zhang</footer>
    </div>
  )
}
