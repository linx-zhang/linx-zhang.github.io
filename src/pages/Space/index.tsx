import { useMemo } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { today, WEEKDAYS } from '@/utils/calendar'
import { dayExtrasLabel } from '@/utils/lunar'
import SpaceConsumables from './SpaceConsumables'
import SpaceMemos from './SpaceMemos'
import type { MemoView } from './memoSort'
import './Space.css'

/** 个人空间两个板块：备忘录（含日历）和日常消耗品 */
type Module = 'memo' | 'consumables'

/** 板块有独立路径，刷新后留在当前板块；旧链接的 ?tab=consumables 继续生效 */
const MODULE_PATHS: Record<Module, string> = {
  memo: '/space/memos',
  consumables: '/space/consumables',
}

function moduleFrom(pathname: string, tab: string | null): Module {
  if (pathname.endsWith('/consumables') || tab === 'consumables') return 'consumables'
  return 'memo'
}

/** 两个板块共用同一句：模块名由 tab 承担，这里只表达「只属于你」 */
const SPACE_TAGLINE = '只属于你，别人看不到。'

/** "M 月 D 日 · 星期四 · 农历十月十一 · 今日小雪" */
function todayLabel(): string {
  const now = new Date()
  const base = `${now.getMonth() + 1} 月 ${now.getDate()} 日 · 星期${WEEKDAYS[now.getDay()]}`
  return `${base}${dayExtrasLabel(today())}`
}

/**
 * 个人空间的外壳：登录门、页头（日期·星期·农历）、板块 tab 与视图切换。
 * 备忘录自己的列表/输入区/月历在 `SpaceMemos`；消耗品在 `SpaceConsumables`，
 * 切板块时整块卸载，两个板块不共享 memo 的请求与状态。
 */
export default function Space() {
  const { user, ready, openLogin } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  // 视图支持 ?view=calendar 直接进来（万年历下方有「查看我的待办」入口）
  const [params, setParams] = useSearchParams()
  /** 视图也直接由 URL 决定，刷新 / 前进后退不会掉回列表 */
  const view: MemoView = params.get('view') === 'calendar' ? 'calendar' : 'list'
  const module = moduleFrom(location.pathname, params.get('tab'))
  // ?date=YYYY-MM-DD 只当天进月历时用一次；格式不对就当没传
  const initialDay = useMemo(() => {
    const raw = params.get('date')
    return raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : undefined
  }, [params])

  /** 切板块走真实路径，刷新 / 前进后退都停在同一个板块 */
  const changeModule = (next: Module) => {
    if (next === module) return
    navigate({ pathname: MODULE_PATHS[next], search: location.search })
  }

  /** 列表 / 日历也写进 URL，刷新不会掉回列表 */
  const changeView = (next: MemoView) => {
    const nextParams = new URLSearchParams(params)
    if (next === 'calendar') nextParams.set('view', 'calendar')
    else nextParams.delete('view')
    setParams(nextParams, { replace: true })
  }

  if (!ready) return <div className="space-page space-state">加载中…</div>

  if (!user) {
    return (
      <div className="space-page">
        <header className="space-header">
          <Link className="space-meta space-date" to={`/tools/calendar?date=${today()}`} title="打开万年历">
            {todayLabel()}
          </Link>
          <p className="space-tagline">{SPACE_TAGLINE}</p>
        </header>
        <div className="space-gate">
          <p>登录后才可以记录和查看自己的备忘录、待办与消耗品。</p>
          <button type="button" className="space-button space-button-primary" onClick={() => openLogin()}>
            登录
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-page">
      <header className="space-header">
        <Link className="space-meta space-date" to={`/tools/calendar?date=${today()}`} title="打开万年历">
          {todayLabel()}
        </Link>
        <p className="space-tagline">{SPACE_TAGLINE}</p>
      </header>

      {/* 板块 tab 与视图切换同一条：左边选内容，右边选呈现方式。
          切换放在这里而不是列表头 / 月历头，是为了两个视图切换时控件不跳位置。 */}
      <div className="space-toolbar">
        <nav className="space-modules" role="tablist" aria-label="板块">
          <button
            type="button"
            role="tab"
            aria-selected={module === 'memo'}
            onClick={() => changeModule('memo')}
          >
            备忘录
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={module === 'consumables'}
            onClick={() => changeModule('consumables')}
          >
            消耗品
          </button>
        </nav>
        {module === 'memo' && (
          <div className="space-view" role="group" aria-label="视图">
            <button
              type="button"
              aria-pressed={view === 'list'}
              onClick={() => changeView('list')}
            >
              列表
            </button>
            <button
              type="button"
              aria-pressed={view === 'calendar'}
              onClick={() => changeView('calendar')}
            >
              日历
            </button>
          </div>
        )}
      </div>

      {module === 'memo' ? (
        <SpaceMemos userId={user.id} view={view} initialDay={initialDay} />
      ) : (
        <SpaceConsumables />
      )}
    </div>
  )
}
