import { useMemo, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useDocList } from '@/utils/useDocs';

import './WikiLayout.css';

type TreeItem = { slug: string; title: string };
type TreeGroup = { category: string; label: string; rank: number; items: TreeItem[] };

/** 把命中片段标出来，方便一眼看到为什么匹配 */
function Highlight({ text, keyword }: { text: string; keyword: string }) {
  const q = keyword.trim();
  if (!q) return <>{text}</>;
  const lower = text.toLowerCase();
  const at = lower.indexOf(q.toLowerCase());
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark className="tree-hit">{text.slice(at, at + q.length)}</mark>
      {text.slice(at + q.length)}
    </>
  );
}

export default function WikiLayout() {
  // 窄屏（≤768px）侧栏是浮层，展开会盖住正文，所以默认收起；宽屏默认展开
  const [sidebarOpen, setSidebarOpen] = useState(
    () => !(typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches),
  );
  const { docs } = useDocList();
  const [keyword, setKeyword] = useState('');

  // 侧栏按分类分组：分类就是 slug 第一段，组内按 index.json 的标题顺序；
  // 组名用展示名（categoryLabel），目录名只做 slug 前缀
  const groups = useMemo(() => {
    const map = new Map<string, TreeGroup>();
    (docs ?? []).forEach((doc) => {
      const group = map.get(doc.category) ?? {
        category: doc.category,
        label: doc.categoryLabel ?? doc.category,
        rank: doc.categoryRank ?? 999,
        items: [],
      };
      group.items.push({ slug: doc.slug, title: doc.title });
      map.set(doc.category, group);
    });
    // 分组位次来自构建期配置（categoryRank），和首页 chip 用同一份次序
    return [...map.values()].sort((a, b) => a.rank - b.rank || a.label.localeCompare(b.label, 'zh-CN'));
  }, [docs]);

  // 搜索只过滤侧栏：按标题匹配，slug 兜底（比如想直接找 /wiki/rbac 下的篇目）
  const query = keyword.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!query) return groups;
    return groups
      .map((group) => ({
        ...group,
        items: group.items.filter(
          (item) => item.title.toLowerCase().includes(query) || item.slug.toLowerCase().includes(query),
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [groups, query]);

  const totalHits = filtered.reduce((sum, group) => sum + group.items.length, 0);

  // 分组可折叠，默认全展开；只影响侧栏，不影响正文。搜索时强制展开，避免命中藏在折叠里
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggleGroup = (category: string) =>
    setCollapsed((current) => ({ ...current, [category]: !current[category] }));

  return (
    <div className={`wiki-layout ${sidebarOpen ? '' : 'is-collapsed'}`}>
      {/* 侧边栏 (打印时隐藏) */}
      <aside className={`wiki-sidebar no-print ${sidebarOpen ? 'open' : 'closed'}`}>
        {/* 标题 + 搜索固定在侧栏顶部，长目录滚动时不会把入口带走 */}
        <div className="sidebar-top">
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
            <div className="sidebar-search">
              <svg className="sidebar-search-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                <circle cx="7" cy="7" r="4.6" />
                <path d="M10.4 10.4L14 14" />
              </svg>
              <input
                type="search"
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') setKeyword('');
                }}
                placeholder="搜索文档标题"
                aria-label="搜索知识库目录"
                autoComplete="off"
                spellCheck={false}
              />
              {keyword && (
                <button
                  type="button"
                  className="sidebar-search-clear"
                  onClick={() => setKeyword('')}
                  aria-label="清空搜索"
                >
                  ×
                </button>
              )}
            </div>
          )}
        </div>

        {sidebarOpen && (
          <nav className={`sidebar-tree ${query ? 'is-searching' : ''}`}>
            {query && (
              <p className="tree-summary">
                {totalHits > 0 ? `匹配 ${totalHits} 篇` : '没有匹配的文档'}
              </p>
            )}
            {filtered.map((group) => {
              const isCollapsed = !query && collapsed[group.category];
              return (
                <div className="tree-group" key={group.category}>
                  <button
                    className="tree-group-head"
                    onClick={() => toggleGroup(group.category)}
                    aria-expanded={!isCollapsed}
                  >
                    <span className={`tree-caret ${isCollapsed ? 'is-collapsed' : ''}`}>▾</span>
                    <span className="tree-group-name">{group.label}</span>
                    <span className="tree-count">{group.items.length}</span>
                  </button>
                  {!isCollapsed && (
                    <ul className="tree-items">
                      {group.items.map((doc) => (
                        <li key={doc.slug}>
                          <NavLink to={`/wiki/${doc.slug}`} title={doc.title}>
                            <Highlight text={doc.title} keyword={keyword} />
                          </NavLink>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </nav>
        )}
      </aside>

      {/* 收起态的浮动按钮：侧栏已经收成 0 宽，按钮得挂在外面才点得到 */}
      {!sidebarOpen && (
        <button
          type="button"
          className="wiki-rail-toggle no-print"
          onClick={() => setSidebarOpen(true)}
          aria-label="展开知识库目录"
          aria-expanded={false}
          title="展开知识库目录"
        >
          ▶
        </button>
      )}

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
