import { Outlet } from 'react-router-dom'
import { useRef } from 'react'
import { useReactToPrint } from 'react-to-print'
import './WikiLayout.css'

export default function WikiLayout() {
  const printRef = useRef<HTMLDivElement>(null)

  const handleWikiPrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: 'wiki-doc',
  })

  return (
    <div className="wiki-container">
      <aside className="wiki-sidebar no-print">
        <div className="sidebar-inner">
          <p>目录</p>
          <button onClick={handleWikiPrint} className="print-btn">打印本文档</button>
        </div>
      </aside>
      <div ref={printRef} className="wiki-body">
        <Outlet />
      </div>
    </div>
  )
}
