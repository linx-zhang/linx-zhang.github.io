import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { today, WEEKDAYS } from '@/utils/calendar'
import { dayExtrasLabel } from '@/utils/lunar'
import SpaceConsumables from './SpaceConsumables'
import SpaceMemos from './SpaceMemos'
import type { MemoView } from './memoSort'
import './Space.css'

/** 个人空间两个板块：备忘录（含日历）和日常消耗品 */
type Module = 'memo' | 'consumables'

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

  // 视图支持 ?view=calendar 直接进来（万年历下方有「查看我的待办」入口）
  const [params] = useSearchParams()
  const [view, setView] = useState<MemoView>(() =>
    params.get('view') === 'calendar' ? 'calendar' : 'list',
  )
  const [module, setModule] = useState<Module>(() =>
    params.get('tab') === 'consumables' ? 'consumables' : 'memo',
  )
  // ?date=YYYY-MM-DD 只当天进月历时用一次；格式不对就当没传
  const initialDay = useMemo(() => {
    const raw = params.get('date')
    return raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : undefined
  }, [params])

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

      {/* 板块 tab 一条；列表/日历切换交给备忘录自己，贴在筛选行右侧 */}
      <div className="space-toolbar">
        <nav className="space-modules" role="tablist" aria-label="板块">
          <button
            type="button"
            role="tab"
            aria-selected={module === 'memo'}
            onClick={() => setModule('memo')}
          >
            备忘录
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={module === 'consumables'}
            onClick={() => setModule('consumables')}
          >
            消耗品
          </button>
        </nav>
      </div>

      {module === 'memo' ? (
        <SpaceMemos
          userId={user.id}
          view={view}
          onViewChange={setView}
          initialDay={initialDay}
        />
      ) : (
        <SpaceConsumables />
      )}
    </div>
  )
}
