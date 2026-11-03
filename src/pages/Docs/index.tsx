import { useParams, Link } from 'react-router-dom';
import { getDocBySlug, getDocList } from '@/utils/docs';

// --- Markdown 渲染核心依赖 ---
import ReactMarkdown from 'react-markdown';
import remarkFrontmatter from 'remark-frontmatter';
import rehypeRaw from 'rehype-raw';
import rehypePrismPlus from 'rehype-prism-plus';

import 'github-markdown-css/github-markdown.css';
import 'prism-themes/themes/prism-ghcolors.css';

export default function Docs() {
  const params = useParams();
  const slug = params['*']; 
  
  const doc = slug ? getDocBySlug(slug) : undefined;
  const allDocs = getDocList();

  if (!doc) {
    return (
      <div style={{ padding: 24, fontFamily: 'monospace' }}>
        <h2 style={{ color: '#dc2626' }}>❌ 未找到文档: {slug}</h2>
        <p>当前扫描到的 raw-docs 清单 ({allDocs.length} 篇):</p>
        <ul>
          {allDocs.map((item) => (
            <li key={item.slug}>
              <Link to={`/wiki/${item.slug}`}>{item.slug}</Link> ({item.filePath})
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <article style={{ padding: '24px', maxWidth: '800px', margin: '0 auto', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <header className="no-print" style={{ marginBottom: '24px', borderBottom: '1px solid #e5e7eb', paddingBottom: '12px' }}>
        <h1 style={{ color: '#1f2937', margin: '0 0 8px 0' }}>{doc.title}</h1>
        <small style={{ color: '#4b5563' }}>源路径: {doc.filePath}</small>
      </header>

      {doc.type === 'html' ? (
        <iframe
          srcDoc={doc.rawContent}
          title={doc.title}
          style={{
            width: '100%',
            height: '75vh',
            border: 'none',
            flexGrow: 1
          }}
        />
      ) : (
        <div className="markdown-body" style={{ flexGrow: 1, color: '#1f2937', lineHeight: 1.6 }}>
          <ReactMarkdown
            // 过滤掉头部的 yaml 元信息
            remarkPlugins={[remarkFrontmatter]} 
            // 允许渲染 md 文件里手写的 <div> 等 HTML 标签，加入 Prism 语法高亮
            rehypePlugins={[rehypeRaw, [rehypePrismPlus, { ignoreMissing: true }]]} 
          >
            {doc.rawContent}
          </ReactMarkdown>
        </div>
      )}
    </article>
  );
}