import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useDocList } from '@/utils/useDocs';

import './WikiLayout.css';

export default function WikiLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { docs } = useDocList();

  // 侧栏按分类分组：分类就是 slug 第一段，组内按 index.json 的标题顺序
  const groups = new Map<string, { slug: string; title: string }[]>();
  (docs ?? []).forEach((doc) => {
    const list = groups.get(doc.category) ?? [];
    list.push({ slug: doc.slug, title: doc.title });
    groups.set(doc.category, list);
  });

  // 分组按分类名排序（和目录页的 chip 顺序一致），避免篇数变化时顺序跳动
  const sortedGroups = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  // 分组可折叠，默认全展开；只影响侧栏，不影响正文
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggleGroup = (category: string) =>
    setCollapsed((current) => ({ ...current, [category]: !current[category] }));

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
          <nav className="sidebar-tree">
            {sortedGroups.map(([category, items]) => (
              <div className="tree-group" key={category}>
                <button
                  className="tree-group-head"
                  onClick={() => toggleGroup(category)}
                  aria-expanded={!collapsed[category]}
                >
                  <span className={`tree-caret ${collapsed[category] ? 'is-collapsed' : ''}`}>▾</span>
                  <span className="tree-group-name">{category}</span>
                  <span className="tree-count">{items.length}</span>
                </button>
                {!collapsed[category] && (
                  <ul className="tree-items">
                    {items.map((doc) => (
                      <li key={doc.slug}>
                        <NavLink to={`/wiki/${doc.slug}`} title={doc.title}>
                          {doc.title}
                        </NavLink>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </nav>
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
