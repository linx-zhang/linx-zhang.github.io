import { useState, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Link, Outlet } from 'react-router-dom';
import { getDocList } from '@/utils/docs';

import './WikiLayout.css';
// import '@/components/Layout/markdown.css'; // 如果有全局markdown样式

export default function WikiLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const printRef = useRef<HTMLDivElement>(null);

  // 获取所有文档列表供侧边栏渲染
  const docList = getDocList();

  // 修复 TS2353 报错：新版 react-to-print 使用 contentRef 代替 content
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: '知识库文档导出'
  });

  return (
    <div className="wiki-layout">
      {/* 侧边栏 (打印时隐藏) */}
      <aside className={`wiki-sidebar no-print ${sidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-head">
          <span className="sidebar-title">知识库目录</span>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="toggle-btn">
            {sidebarOpen ? '<<' : '>>'}
          </button>
        </div>
        
        {sidebarOpen && (
          <ul className="sidebar-list">
            {docList.map((doc) => (
              <li key={doc.slug}>
                <Link to={`/wiki/${doc.slug}`}>{doc.title}</Link>
              </li>
            ))}
          </ul>
        )}
      </aside>

      {/* 主内容区 */}
      <main className="wiki-main">
        {/* 工具栏 (打印时隐藏) */}
        <div className="wiki-toolbar no-print">
          <Link to="/wiki" className="back-link">← 返回目录首页</Link>
          <button onClick={handlePrint} className="print-btn">打印 / 导出PDF</button>
        </div>

        {/* 动态注入区: DocsHome 或 Docs 将在这里渲染，并可被整体打印 */}
        <div ref={printRef} className="wiki-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}