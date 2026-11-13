import { lazy, Suspense } from 'react'
import { Link, useParams } from 'react-router-dom'
import './Tools.css'

const TOOLS = [
  { slug: 'json', label: 'JSON 格式化', hint: '格式化、压缩、定位报错' },
  { slug: 'sql', label: 'SQL 格式化', hint: '关键字大写、按子句换行' },
  { slug: 'timestamp', label: '时间戳转换', hint: '秒 / 毫秒 ↔ 本地时间' },
] as const

type ToolSlug = (typeof TOOLS)[number]['slug']

const JsonTool = lazy(() => import('./JsonTool'))
const SqlTool = lazy(() => import('./SqlTool'))
const TimestampTool = lazy(() => import('./TimestampTool'))

function isToolSlug(value: string | undefined): value is ToolSlug {
  return TOOLS.some((tool) => tool.slug === value)
}

export default function Tools() {
  const { slug } = useParams()
  const active: ToolSlug = isToolSlug(slug) ? slug : 'json'

  return (
    <div className="tools-page">
      <header className="tools-head">
        <h1>工具箱</h1>
        <p>都是本地计算，不发请求、不保存内容。</p>
      </header>

      <nav className="tools-tabs" aria-label="工具">
        {TOOLS.map((tool) => (
          <Link
            key={tool.slug}
            to={`/tools/${tool.slug}`}
            className={tool.slug === active ? 'tools-tab is-active' : 'tools-tab'}
            aria-current={tool.slug === active ? 'page' : undefined}
          >
            {tool.label}
            <span>{tool.hint}</span>
          </Link>
        ))}
      </nav>

      <Suspense fallback={<div className="tools-state">加载中…</div>}>
        {active === 'json' && <JsonTool />}
        {active === 'sql' && <SqlTool />}
        {active === 'timestamp' && <TimestampTool />}
      </Suspense>
    </div>
  )
}
