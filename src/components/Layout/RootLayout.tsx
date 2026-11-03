import { Outlet, Link } from 'react-router-dom'
import './RootLayout.css'

export default function RootLayout() {
  return (
    <div className="root-container">
      <header className="global-header no-print">
        <nav className="nav">
          <Link to="/">首页</Link>
          <Link to="/wiki">知识库</Link>
          <Link to="/profile">简历</Link>
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
