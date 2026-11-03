import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getDocList } from '@/utils/docs';
import './DocsHome.css';

export default function DocsHome() {
  const docList = getDocList();
  const [activeCategory, setActiveCategory] = useState<string>('全部');

  // 根据 slug 的第一层路径自动提取分类 (例如 "golang/abc" -> "golang")
  const categories = useMemo(() => {
    const cats = new Set<string>();
    docList.forEach(doc => {
      const parts = doc.slug.split('/');
      if (parts.length > 1) {
        cats.add(parts[0]);
      } else {
        cats.add('综合'); // 没有子目录的放在综合里
      }
    });
    const sortedCats = Array.from(cats).sort((a, b) => a.localeCompare(b, 'zh-CN'));
    return ['全部', ...sortedCats];
  }, [docList]);

  // 根据当前选中分类过滤文档
  const filteredDocs = useMemo(() => {
    if (activeCategory === '全部') return docList;
    return docList.filter(doc => {
      const parts = doc.slug.split('/');
      const cat = parts.length > 1 ? parts[0] : '综合';
      return cat === activeCategory;
    });
  }, [docList, activeCategory]);

  return (
    <div className="docs-home">
      <header className="docs-home-header">
        <h1>Wiki 知识库</h1>
        <p>共收录 {docList.length} 篇文档 / 笔记</p>
      </header>

      <div className="docs-home-layout">
        {/* 左侧：分类导航 */}
        <aside className="docs-categories">
          {categories.map(cat => (
            <div
              key={cat}
              className={`category-item ${activeCategory === cat ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </div>
          ))}
        </aside>

        {/* 右侧：文档列表 */}
        <main className="doc-list">
          {filteredDocs.map((doc) => {
            const parts = doc.slug.split('/');
            const cat = parts.length > 1 ? parts[0] : '综合';
            
            return (
              <div key={doc.slug} className="doc-item">
                <Link to={`/wiki/${doc.slug}`} className="doc-title">
                  {doc.title}
                </Link>
                <div className="doc-date">{doc.filePath}</div>
                <div className="doc-tags">
                  <span className="tag">{cat}</span>
                  <span className="tag">{doc.type.toUpperCase()}</span>
                </div>
              </div>
            );
          })}

          {filteredDocs.length === 0 && (
            <div className="empty-tip">该分类下暂无文档</div>
          )}
        </main>
      </div>
    </div>
  );
}
