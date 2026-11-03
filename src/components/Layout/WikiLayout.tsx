import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { getDocList } from '@/utils/docs';

import './WikiLayout.css';

export default function WikiLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // 获取所有文档列表供侧边栏渲染
  const docList = getDocList();

  return (
    <div className="wiki-layout">
      {/* 侧边栏 (打印时隐藏) */}
      <aside className={`wiki-sidebar no-print ${sidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-head">
          {/* 左上角标题：使用 NavLink 并加上 end 属性，只有在准确访问 /wiki 时才高亮。也可兼作返回首页按钮 */}
          <NavLink to="/wiki" end className="sidebar-title">
            知识库目录
          </NavLink>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="toggle-btn">
            {sidebarOpen ? '◀' : '▶'}
          </button>
        </div>
        
        {sidebarOpen && (
          <ul className="sidebar-list">
            {docList.map((doc) => (
              <li key={doc.slug}>
                {/* 列表项：使用 NavLink，匹配路由时会自动附加 .active 样式类 */}
                <NavLink to={`/wiki/${doc.slug}`}>
                  {doc.title}
                </NavLink>
              </li>
            ))}
          </ul>
        )}
      </aside>

      {/* 主内容区 */}
      <main className="wiki-main">
        {/* 动态注入区: DocsHome 或 Docs 将在这里渲染 */}
        <div className="wiki-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}