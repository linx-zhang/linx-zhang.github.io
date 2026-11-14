import { lazy, Suspense } from 'react'
import type { ComponentType, ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import './Tools.css'

const JsonTool = lazy(() => import('./JsonTool'))
const SqlTool = lazy(() => import('./SqlTool'))
const TimestampTool = lazy(() => import('./TimestampTool'))
const RandomTool = lazy(() => import('./RandomTool'))
const ClipTool = lazy(() => import('./ClipTool'))

interface ToolMeta {
  slug: string
  label: string
  hint: string
  detail: string
  icon: ReactNode
  /** 每个工具自带渲染组件：新增工具只要在 TOOLS 里加一条，不用改渲染分支 */
  Component: ComponentType<{ code?: string }>
}

/**
 * 所有工具图标共用这一个外壳：同一套 viewBox / 描边宽度 / 端点圆角。
 * 图标「参差不齐」多半不是尺寸问题，而是每个 svg 自己写了一份描边参数、各自的
 * 光学尺寸和重心也不一样；外壳统一后，只要把图形收进同样的 16 单位光学方框就行。
 */
function ToolIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

// 图形统一收在 12×12 为中心、约 14–16 单位见方的光学方框里（见 ToolIcon 注释）
const untilIcon = (
  <ToolIcon>
    <circle cx="12" cy="12" r="6.8" />
    <path d="M12 8.6v3.6l2.4 1.5" />
  </ToolIcon>
)

const TOOLS: ToolMeta[] = [
  {
    slug: 'json',
    label: 'JSON 格式化',
    Component: JsonTool,
    hint: '格式化 / 压缩 / 报错定位',
    detail: '粘贴一段 JSON，整理成缩进结构；格式错了会指出多出或少了哪个符号。',
    icon: (
      <ToolIcon>
        <path d="M9.6 5c-1.5 0-2.3.9-2.3 2.2v2.4c0 1.1-.8 1.9-1.9 2.4 1.1.5 1.9 1.3 1.9 2.4v2.4c0 1.3.8 2.2 2.3 2.2" />
        <path d="M14.4 5c1.5 0 2.3.9 2.3 2.2v2.4c0 1.1.8 1.9 1.9 2.4-1.1.5-1.9 1.3-1.9 2.4v2.4c0 1.3-.8 2.2-2.3 2.2" />
      </ToolIcon>
    ),
  },
  {
    slug: 'sql',
    label: 'SQL 格式化',
    Component: SqlTool,
    hint: '按子句换行、关键字大写',
    detail: '一长串 SQL 拆成一行一个子句；可选 MySQL / PostgreSQL 等方言。',
    icon: (
      <ToolIcon>
        <ellipse cx="12" cy="6.8" rx="6" ry="2.2" />
        <path d="M6 6.8v10.2c0 1.2 2.7 2.3 6 2.3s6-1.1 6-2.3V6.8" />
        <path d="M6 11.6c0 1.2 2.7 2.3 6 2.3s6-1.1 6-2.3" />
      </ToolIcon>
    ),
  },
  {
    slug: 'timestamp',
    label: '时间戳转换',
    Component: TimestampTool,
    hint: '秒 / 毫秒 ↔ 本地时间',
    detail: '数字时间戳和日期互转，自动判断单位，也能手动锁定按秒还是按毫秒。',
    icon: untilIcon,
  },
  {
    slug: 'random',
    label: 'UUID / 密码',
    Component: RandomTool,
    hint: 'v4 / v7 · 可选字符集',
    detail: '生成 UUID（v4 随机、v7 时间有序）和随机密码，字符集自选，可排除 0/O、1/l/I 这类易混字符。',
    icon: (
      <ToolIcon>
        <rect x="6.5" y="10.2" width="11" height="9.2" rx="2" />
        <path d="M9 10.2V8a3 3 0 0 1 6 0v2.2" />
        <circle cx="12" cy="14.4" r="1.2" />
        <path d="M12 15.4v1.4" />
      </ToolIcon>
    ),
  },
  {
    slug: 'clip',
    label: '共享剪切板',
    Component: ClipTool,
    hint: '日志粘进来 · 24 小时短链',
    detail: '把日志或一小段文本存到后端，生成一条 24 小时内谁都能读的链接；过期自动失效，也能随时撤销。',
    icon: (
      <ToolIcon>
        <rect x="6.7" y="6.4" width="10.6" height="13" rx="2" />
        <path d="M9.6 6.4V5.3c0-.5.4-.9.9-.9h3c.5 0 .9.4.9.9v1.1" />
        <path d="M9.2 11.2h5.6M9.2 14.6h5.6" />
      </ToolIcon>
    ),
  },
]

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
        <tool.Component code={code} />
      </Suspense>
    </div>
  )
}
