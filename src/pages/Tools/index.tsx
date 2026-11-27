import { lazy, Suspense } from 'react'
import type { ComponentType, ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import './Tools.css'

const JsonTool = lazy(() => import('./JsonTool'))
const SqlTool = lazy(() => import('./SqlTool'))
const RegexTool = lazy(() => import('./RegexTool'))
const DiffTool = lazy(() => import('./DiffTool'))
const JwtTool = lazy(() => import('./JwtTool'))
const UrlTool = lazy(() => import('./UrlTool'))
const CronTool = lazy(() => import('./CronTool'))
const ColorTool = lazy(() => import('./ColorTool'))
const QrTool = lazy(() => import('./QrTool'))
const ImageTool = lazy(() => import('./ImageTool'))
const FinanceTool = lazy(() => import('./FinanceTool'))
const TimestampTool = lazy(() => import('./TimestampTool'))
const RandomTool = lazy(() => import('./RandomTool'))
const ClipTool = lazy(() => import('./ClipTool'))
const HashTool = lazy(() => import('./HashTool'))
const CalendarTool = lazy(() => import('./CalendarTool'))
const PersonalityTool = lazy(() => import('./PersonalityTool'))

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
    slug: 'calendar',
    label: '万年历',
    Component: CalendarTool,
    hint: '农历 · 节气 · 节日',
    detail: '月视图带农历与节气，点任意一天看当天农历、干支与距下一个节日还有几天。',
    icon: (
      <ToolIcon>
        <rect x="5.8" y="6.6" width="12.4" height="11.6" rx="2" />
        <path d="M5.8 10.4h12.4" />
        <path d="M9.2 4.8v2.6M14.8 4.8v2.6" />
        <path d="M9 13.6h2.4M12.9 13.6h2.2" />
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
    slug: 'mbti',
    label: 'MBTI · 星座',
    Component: PersonalityTool,
    hint: '12 题 · 四维 · 生日查星座',
    detail: '12 组二选一看清 E/I、S/N、T/F、J/P 四组倾向；也可以按公历生日查太阳星座和常见印象。',
    icon: (
      <ToolIcon>
        <circle cx="12" cy="12" r="6.8" />
        <path d="M12 6.8l1.5 3.7 3.7 1.5-3.7 1.5-1.5 3.7-1.5-3.7-3.7-1.5 3.7-1.5z" />
      </ToolIcon>
    ),
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
  {
    slug: 'hash',
    label: '文件哈希',
    Component: HashTool,
    hint: 'MD5 / SHA-256 · 不出本机',
    detail:
      '拖一个文件进来，算出 MD5、SHA-1、SHA-256、SHA-512；粘一段发布方给的哈希就能直接核对。文件只在本机读取。',
    icon: (
      <ToolIcon>
        <path d="M10.2 5.8 8.8 18.2" />
        <path d="M15.2 5.8 13.8 18.2" />
        <path d="M5.8 9.9h12.4" />
        <path d="M5.8 14.1h12.4" />
      </ToolIcon>
    ),
  },
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
    slug: 'regex',
    label: '正则测试',
    Component: RegexTool,
    hint: '高亮 · 捕获组 · 替换预览',
    detail: '实时看匹配区间、捕获组和命名组，支持 g/i/m/s/u 修饰符；替换预览能验证 $1 这类引用。',
    icon: (
      <ToolIcon>
        <path d="M8.4 5.8 6.1 18.2" />
        <path d="M16.6 5.8 14.3 18.2" />
        <path d="M3.8 12.7h16.4" />
      </ToolIcon>
    ),
  },
  {
    slug: 'diff',
    label: '文本 Diff',
    Component: DiffTool,
    hint: '两份文本 · 文件 · 行级差异',
    detail: '粘贴两段文本，或直接读两个文件；按行标出新增、删除和未变，只看差异时更清爽。',
    icon: (
      <ToolIcon>
        <path d="M9.1 6.4v11.2M6.2 9.3l2.9-2.9 2.9 2.9" />
        <path d="M14.9 17.6V6.4M17.8 14.7l-2.9 2.9-2.9-2.9" />
      </ToolIcon>
    ),
  },
  {
    slug: 'jwt',
    label: 'JWT 解析',
    Component: JwtTool,
    hint: 'Header · Payload · 过期判断',
    detail: '拆开 JWT 的头部、载荷和签名，显示标准字段和过期时间；只解码，不校验签名。',
    icon: (
      <ToolIcon>
        <rect x="5.6" y="7.4" width="12.8" height="9.2" rx="2" />
        <circle cx="12" cy="12" r="1.9" />
        <path d="M12 4.2v3.2M12 16.6v3.2" />
      </ToolIcon>
    ),
  },
  {
    slug: 'url',
    label: 'URL 编解码',
    Component: UrlTool,
    hint: 'Chrome 式 query 表格',
    detail: '把 URL 拆成基础地址、query 参数和片段；参数按解码值编辑，改完实时生成编码后的 URL。',
    icon: (
      <ToolIcon>
        <path d="M10.2 13.8 8.7 15.3a3.8 3.8 0 0 1-5.4-5.4l2.4-2.4a3.8 3.8 0 0 1 5.4 0" />
        <path d="M13.8 10.2l1.5-1.5a3.8 3.8 0 0 1 5.4 5.4l-2.4 2.4a3.8 3.8 0 0 1-5.4 0" />
        <path d="M9.2 14.8 14.8 9.2" />
      </ToolIcon>
    ),
  },
  {
    slug: 'cron',
    label: 'Cron 表达式',
    Component: CronTool,
    hint: '解析 · 下次执行 · 生成',
    detail: '看懂一段 5 段 cron，按本机时区列出接下来几次；也可以从频率、时间反推表达式。',
    icon: (
      <ToolIcon>
        <circle cx="12" cy="12" r="6.8" />
        <path d="M12 8.3v3.9l2.7 1.6" />
        <path d="M18.2 5.4l1.2 1.2M19.4 5.4l-1.2 1.2" />
      </ToolIcon>
    ),
  },
  {
    slug: 'color',
    label: '颜色转换',
    Component: ColorTool,
    hint: '色卡选色 · HEX / RGB / HSL',
    detail: '在色卡上按住拖动选颜色，也能在 HEX、RGB、HSL 之间换算，带透明度预览；顺带算 WCAG 对比度，判断文字在白底或深底上够不够清楚。',
    icon: (
      <ToolIcon>
        <path d="M12 5.2a6.8 6.8 0 1 0 0 13.6c1.4 0 2.2-.9 2.2-2.1 0-.5-.2-.9-.5-1.3-.3-.6 0-1.4.8-1.4h2.4a3.8 3.8 0 0 0 3.8-4.2A6.8 6.8 0 0 0 12 5.2z" />
        <circle cx="8.9" cy="10.1" r=".9" />
        <circle cx="12.4" cy="8.2" r=".9" />
        <circle cx="15.7" cy="10.5" r=".9" />
      </ToolIcon>
    ),
  },
  {
    slug: 'qr',
    label: '二维码生成',
    Component: QrTool,
    hint: '可选 logo · 方形 / 圆角 / 圆形',
    detail: '把网址或文本生成二维码，能加中心 logo 并选形状、占比；纠错和点阵密度实时可见，下载 PNG。',
    icon: (
      <ToolIcon>
        <rect x="5.2" y="5.2" width="5.2" height="5.2" rx="1" />
        <rect x="13.6" y="5.2" width="5.2" height="5.2" rx="1" />
        <rect x="5.2" y="13.6" width="5.2" height="5.2" rx="1" />
        <path d="M13.6 13.6h2.3v2.3h-2.3zM17.7 17.7h1.1v1.1h-1.1z" />
      </ToolIcon>
    ),
  },
  {
    slug: 'image',
    label: '图片压缩',
    Component: ImageTool,
    hint: 'WebP / JPEG / PNG · 单张 1 GB',
    detail: '拖一张图片进来，缩小尺寸并按质量重新编码；单张不超过 1 GB，全程只在本机处理，左右对比原图和压缩结果，满意后直接下载。',
    icon: (
      <ToolIcon>
        <rect x="5" y="6.4" width="14" height="11.2" rx="2" />
        <circle cx="9.2" cy="10.4" r="1.3" />
        <path d="M5.8 16.2l4.3-4 3 2.6 3-3 3.4 3.2" />
      </ToolIcon>
    ),
  },
  {
    slug: 'finance',
    label: '复利定投',
    Component: FinanceTool,
    hint: '本金 + 月定投 · 逐年曲线',
    detail: '输入本金、每月定投、年化收益和年限，算期末总额与收益；逐年曲线和明细能看清复利什么时候开始加速。',
    icon: (
      <ToolIcon>
        <path d="M4.8 17.4l4.1-4.3 3.1 2.5 5.4-6.4" />
        <path d="M14.5 6.4h5v5" />
        <path d="M5 20h14" />
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
