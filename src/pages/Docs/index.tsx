import { Link, useParams } from 'react-router-dom'
import { getDocBySlug } from '@/utils/docs'
import MarkdownView from '@/components/MarkdownView'
import './Docs.css'

export default function Docs() {
  const params = useParams()
  const slug = params['*']

  const doc = slug ? getDocBySlug(slug) : undefined

  if (!doc) {
    return (
      <div className="doc-missing">
        <h1>没有找到这篇文档</h1>
        <p>链接可能已失效，或者这篇笔记还在整理中。</p>
        <Link to="/wiki">返回知识库目录</Link>
      </div>
    )
  }

  return (
    <article className="doc-page">
      <header className="doc-page-header no-print">
        <h1>{doc.title}</h1>
      </header>

      <div className="doc-page-body">
        {doc.type === 'html' ? (
          <iframe className="doc-iframe" srcDoc={doc.rawContent} title={doc.title} />
        ) : (
          <MarkdownView className="docs-markdown" content={doc.rawContent} />
        )}
      </div>
    </article>
  )
}
