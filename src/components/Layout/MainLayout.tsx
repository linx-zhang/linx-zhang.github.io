import { useState, useRef } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useReactToPrint } from 'react-to-print'
import './MainLayout.css'

export default function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const printRef = useRef<HTMLDivElement>(null)
  const location = useLocation()

  const showExport = location.pathname.startsWith('/docs') || location.pathname === '/'

  // 打印hook
  const handlePrint = useReactToPrint({
    contentRef: printRef,
  })

  return (
    <div className="app-root">
      <header className="top-nav">
        <button onClick={() => setSidebarOpen(!sidebarOpen)}>
          {sidebarOpen ? '收起目录' : '打开目录'}
        </button>
        {showExport && (
          <button onClick={handlePrint}>导出PDF</button>
        )}
        <a href="/profile">关于我</a>
      </header>

      <div className="body-wrap">
        <aside className={`drawer-sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
          <div className="tree-placeholder">目录树占位</div>
        </aside>

        <main ref={printRef} className="print-area content-area">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
