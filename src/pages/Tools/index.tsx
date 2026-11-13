import { lazy, Suspense } from 'react'
import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import './Tools.css'

interface ToolMeta {
  slug: string
  label: string
  hint: string
  detail: string
  icon: ReactNode
}

const untilIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
    <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />
    <path d="M12 7v5l3 2" />
  </svg>
)

const TOOLS: ToolMeta[] = [
  {
    slug: 'json',
    label: 'JSON 格式化',
    hint: '格式化 / 压缩 / 报错定位',
    detail: '粘贴一段 JSON，整理成缩进结构；格式错了会指出多出或少了哪个符号。',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <path d="M9 3c-2 0-3 1-3 3v3c0 1.5-1 2-2 2 1 0 2 .5 2 2v4c0 2 1 3 3 3" />
        <path d="M15 3c2 0 3 1 3 3v3c0 1.5 1 2 2 2-1 0-2 .5-2 2v4c0 2-1 3-3 3" />
      </svg>
    ),
  },
  {
    slug: 'sql',
    label: 'SQL 格式化',
    hint: '按子句换行、关键字大写',
    detail: '一长串 SQL 拆成一行一个子句；可选 MySQL / PostgreSQL 等方言。',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <path d="M12 3c4.5 0 7 1.3 7 2.8v12.4c0 1.5-2.5 2.8-7 2.8s-7-1.3-7-2.8V5.8C5 4.3 7.5 3 12 3Z" />
        <path d="M5 6h14M5 11h14M5 16h14" />
      </svg>
    ),
  },
  {
    slug: 'timestamp',
    label: '时间戳转换',
    hint: '秒 / 毫秒 ↔ 本地时间',
    detail: '数字时间戳和日期互转，自动判断单位，也能手动锁定按秒还是按毫秒。',
    icon: untilIcon,
  },
]

const JsonTool = lazy(() => import('./JsonTool'))
const SqlTool = lazy(() => import('./SqlTool'))
const TimestampTool = lazy(() => import('./TimestampTool'))

function findTool(slug: string | undefined): ToolMeta | undefined {
  return TOOLS.find((tool) => tool.slug === slug)
}

export default function Tools() {
  const { slug } = useParams()
  const tool = findTool(slug)

  // 首页：一堆中等大小的图标入口，点哪个就进哪个的整页
  if (!tool) {
    return (
      <div className="tools-page">
        <header className="tools-head">
          <h1>工具箱</h1>
          <p>都是本地计算，不发请求、不保存内容。</p>
        </header>

        <div className="tools-grid">
          {TOOLS.map((item) => (
            <Link key={item.slug} to={`/tools/${item.slug}`} className="tool-tile">
              <span className="tool-tile-icon">{item.icon}</span>
              <span className="tool-tile-text">
                <strong>{item.label}</strong>
                <span>{item.hint}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    )
  }

  // 工具页：独占整页，编辑器拿到更多高度
  return (
    <div className="tools-page is-tool">
      <header className="tool-head">
        <Link to="/tools" className="tool-back">
          ← 工具箱
        </Link>
        <h1>{tool.label}</h1>
        <p>{tool.detail}</p>
      </header>

      <Suspense fallback={<div className="tools-state">加载中…</div>}>
        {tool.slug === 'json' && <JsonTool />}
        {tool.slug === 'sql' && <SqlTool />}
        {tool.slug === 'timestamp' && <TimestampTool />}
      </Suspense>
    </div>
  )
}
