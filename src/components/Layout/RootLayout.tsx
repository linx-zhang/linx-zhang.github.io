import { Outlet, NavLink } from 'react-router-dom'
import './RootLayout.css'

export default function RootLayout() {
  return (
    <div className="root-container">
      <header className="global-header no-print">
        <nav className="nav">
          <NavLink to="/" end className="nav-item">首页</NavLink>
          <NavLink to="/wiki" className="nav-item">知识库</NavLink>
          <NavLink to="/lab" className="nav-item">实验台</NavLink>
          <NavLink to="/profile" className="nav-item">简历</NavLink>
        </nav>
      </header>

      <main className="main-content">
        <Outlet />
      </main>

      <footer className="global-footer no-print">
        &copy; Linx Zhang
      </footer>
    </div>
  )
}
