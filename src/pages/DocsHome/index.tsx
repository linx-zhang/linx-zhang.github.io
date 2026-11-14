import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useDocList } from '@/utils/useDocs';
import './DocsHome.css';

export default function DocsHome() {
  const { docs, error } = useDocList();
  const [activeCategory, setActiveCategory] = useState<string>('全部');

  const docList = useMemo(() => docs ?? [], [docs]);

  // 分类来自构建期生成的 index.json，slug 第一层即分类。
  // 排序按「篇数降序、同数按名字」：内容多的分类先出现，新加的分类不会因为字母序被塞到最后。
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    docList.forEach((doc) => counts.set(doc.category, (counts.get(doc.category) ?? 0) + 1));
    const sortedCats = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-CN'))
      .map(([name]) => name);
    return ['全部', ...sortedCats];
  }, [docList]);

  const filteredDocs = useMemo(() => {
    if (activeCategory === '全部') return docList;
    return docList.filter((doc) => doc.category === activeCategory);
  }, [docList, activeCategory]);

  return (
    <div className="docs-home">
      <header className="docs-home-header">
        <h1>Wiki 知识库</h1>
        <p>
          {docs
            ? `${docList.length} 篇文档 · ${categories.length - 1} 个分类`
            : error
              ? error
              : '正在加载文档索引…'}
        </p>
      </header>

      {error && (
        <div className="empty-tip">
          文档索引没能加载出来，请确认 /wiki/index.json 已随构建产出。
        </div>
      )}

      {!error && (
        <>
          {/* 分类改成顶部一行 chip，不再单独占一列导航 */}
          <div className="docs-filter-bar">
            {categories.map((cat) => (
              <button
                key={cat}
                className={`docs-chip ${activeCategory === cat ? 'active' : ''}`}
                onClick={() => setActiveCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          <main className="doc-list">
            {filteredDocs.map((doc) => (
              <div key={doc.slug} className="doc-item">
                {/* 第一行：标题 + 右侧操作；置顶文档带一个角标 */}
                <div className="doc-item-head">
                  {doc.pin ? <span className="doc-pin">置顶</span> : null}
                  <Link to={`/wiki/${doc.slug}`} className="doc-title">
                    {doc.title}
                  </Link>
                  <div className="doc-actions">
                    <a
                      className="doc-source"
                      href={`https://github.com/linx-zhang/linx-zhang.github.io/blob/main${doc.filePath}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      源文件
                    </a>
                    {/* md 与 html 都进站内全屏阅读，不再往外跳；要原文件就点左侧"源文件" */}
                    <Link className="doc-standalone" to={`/wiki/${doc.slug}?full=1`}>
                      全屏 ⤢
                    </Link>
                  </div>
                </div>
                {/* 第二行：分类 · 主题 · 类型 */}
                <div className="doc-meta">
                  {doc.category}
                  {doc.topic ? (
                    <>
                      <span className="doc-meta-dot">·</span>
                      {doc.topic}
                    </>
                  ) : null}
                  <span className="doc-meta-dot">·</span>
                  {doc.type.toUpperCase()}
                </div>
              </div>
            ))}

            {docs && filteredDocs.length === 0 && (
              <div className="empty-tip">该分类下暂无文档</div>
            )}
          </main>
        </>
      )}
    </div>
  );
}
