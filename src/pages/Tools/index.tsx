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
  {
    slug: 'random',
    label: 'UUID / 密码',
    hint: 'v4 / v7 · 可选字符集',
    detail: '生成 UUID（v4 随机、v7 时间有序）和随机密码，字符集自选，可排除 0/O、1/l/I 这类易混字符。',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <rect x="4.5" y="10" width="15" height="10.5" rx="2.4" />
        <path d="M8 10V7.2a4 4 0 0 1 8 0V10" />
        <circle cx="12" cy="15" r="1.5" />
        <path d="M12 16.5v1.9" />
      </svg>
    ),
  },
  {
    slug: 'clip',
    label: '共享剪切板',
    hint: '日志粘进来 · 24 小时短链',
    detail: '把日志或一小段文本存到后端，生成一条 24 小时内谁都能读的链接；过期自动失效，也能随时撤销。',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <rect x="5" y="6" width="14" height="15" rx="2.2" />
        <path d="M9 6V4.8c0-.5.4-.9.9-.9h4.2c.5 0 .9.4.9.9V6" />
        <path d="M8.5 11.5h7M8.5 15h7" />
      </svg>
    ),
  },
]

const JsonTool = lazy(() => import('./JsonTool'))
const SqlTool = lazy(() => import('./SqlTool'))
const TimestampTool = lazy(() => import('./TimestampTool'))
const RandomTool = lazy(() => import('./RandomTool'))
const ClipTool = lazy(() => import('./ClipTool'))

function findTool(slug: string | undefined): ToolMeta | undefined {
  return TOOLS.find((tool) => tool.slug === slug)
}

export default function Tools() {
  const { slug, code } = useParams()
  // 阅读链接走 /tools/clip/<code> 这条独立路由，没有 :slug，这里补回工具身份
  const tool = findTool(slug ?? (code ? 'clip' : undefined))

  // 首页：一堆中等大小的图标入口，点哪个就进哪个的整页
  if (!tool) {
    return (
      <div className="tools-page">
        <header className="tools-head">
          <h1>工具箱</h1>
          <p>除共享剪切板外都在本地计算，不发请求、不保存内容；剪切板的内容存后端，24 小时后自动失效。</p>
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
        <p>{code ? '别人分享过来的一段内容，24 小时后自动失效。' : tool.detail}</p>
      </header>

      <Suspense fallback={<div className="tools-state">加载中…</div>}>
        {tool.slug === 'json' && <JsonTool />}
        {tool.slug === 'sql' && <SqlTool />}
        {tool.slug === 'timestamp' && <TimestampTool />}
        {tool.slug === 'random' && <RandomTool />}
        {tool.slug === 'clip' && <ClipTool code={code} />}
      </Suspense>
    </div>
  )
}
