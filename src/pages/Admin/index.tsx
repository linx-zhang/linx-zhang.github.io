import type { ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { usePermission } from '@/auth/usePermission'
import RequirePermission from '@/components/RequirePermission'
import ActivityTab from './ActivityTab'
import AnalyticsTab from './AnalyticsTab'
import PostsTab from './PostsTab'
import InvitesTab from './InvitesTab'
import UsersTab from './UsersTab'
import './Admin.css'

type AdminTab = 'posts' | 'invites' | 'users' | 'activity' | 'analytics'

interface TabDef {
  key: AdminTab
  label: string
  /** 需要的权限码；不填表示登录即可见 */
  permission?: string
  panel: ReactNode
}

/** 一张表描述全部分区：新增 tab 只加一行，不再改四处嵌套三元与权限判断 */
const TABS: TabDef[] = [
  { key: 'posts', label: '文章', panel: <PostsTab /> },
  { key: 'invites', label: '邀请码', panel: <InvitesTab /> },
  { key: 'users', label: '用户', permission: 'user:read:any', panel: <UsersTab /> },
  { key: 'activity', label: '日志', permission: 'activity:read:any', panel: <ActivityTab /> },
  { key: 'analytics', label: '分析', permission: 'activity:read:any', panel: <AnalyticsTab /> },
]

export default function Admin() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { has } = usePermission()

  const rawTab = searchParams.get('tab')
  // 未知 tab 落到第一项：URL 手改错了也不会白屏
  const active = TABS.find((item) => item.key === rawTab) ?? TABS[0]
  const visible = TABS.filter((item) => !item.permission || has(item.permission))

  const switchTab = (next: AdminTab) => {
    setSearchParams(next === 'posts' ? {} : { tab: next })
  }

  return (
    <div className="admin-page">
      <header className="admin-header">
        <h1>管理后台</h1>
        <p>管理文章、邀请码、用户与活跃日志。</p>
      </header>

      <div className="admin-tabs" role="tablist" aria-label="管理分区">
        {visible.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={active.key === item.key}
            className={active.key === item.key ? 'admin-tab active' : 'admin-tab'}
            onClick={() => switchTab(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {active.permission ? (
        <RequirePermission permission={active.permission}>{active.panel}</RequirePermission>
      ) : (
        active.panel
      )}
    </div>
  )
}
