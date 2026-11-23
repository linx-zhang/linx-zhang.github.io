import type { ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { usePermission } from '@/auth/usePermission'
import RequirePermission from '@/components/RequirePermission'
import ActivityTab from './ActivityTab'
import AnalyticsTab from './AnalyticsTab'
import PostsTab from './PostsTab'
import InvitesTab from './InvitesTab'
import ResumesTab from './ResumesTab'
import UsersTab from './UsersTab'
import './Admin.css'

type AdminTab = 'posts' | 'invites' | 'users' | 'activity' | 'analytics' | 'resumes'

interface TabDef {
  key: AdminTab
  label: string
  /** 需要的权限码；不填表示登录即可见 */
  permission?: string
  panel: ReactNode
  /** 占一个可访问的分区，但不进 tab 条：入口由别的分区给链接 */
  entryOnly?: boolean
}

/**
 * 一张表描述全部分区：新增 tab 只加一行，不再改四处嵌套三元与权限判断。
 * 用户排在第一位并作为默认分区——后台最常做的是看人和改权限；文章其次。
 * 邀请码留成独立分区，从「用户」页入口进入，不在用户页里和用户列表挤在同一屏管理。
 */
const TABS: TabDef[] = [
  { key: 'users', label: '用户', permission: 'user:read:any', panel: <UsersTab /> },
  { key: 'posts', label: '文章', panel: <PostsTab /> },
  {
    key: 'resumes',
    label: '简历',
    permission: 'resume:manage:any',
    panel: <ResumesTab />,
  },
  { key: 'activity', label: '日志', permission: 'activity:read:any', panel: <ActivityTab /> },
  { key: 'analytics', label: '分析', permission: 'activity:read:any', panel: <AnalyticsTab /> },
  {
    key: 'invites',
    label: '邀请码',
    permission: 'invite_code:read:any',
    panel: <InvitesTab />,
    entryOnly: true,
  },
]

export default function Admin() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { has } = usePermission()

  const rawTab = searchParams.get('tab')
  // 有权限的分区包含「只从别处进入」的邀请码；tab 条只展示常规分区
  const accessible = TABS.filter((item) => !item.permission || has(item.permission))
  const visible = accessible.filter((item) => !item.entryOnly)
  // 未知 tab 落到第一个**看得见**的分区：URL 手改错了不会白屏，也不会撞权限门
  const active = accessible.find((item) => item.key === rawTab) ?? visible[0] ?? TABS[0]

  const switchTab = (next: AdminTab) => {
    setSearchParams(next === 'users' ? {} : { tab: next })
  }

  return (
    <div className="admin-page">
      <header className="admin-header">
        <h1>管理后台</h1>
        <p>管理用户、文章、简历、活跃日志与访问分析；邀请码从用户页进入单独管理。</p>
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

      {/* 独立分区没有对应 tab，给一条回用户页的退路 */}
      {active.entryOnly && (
        <button type="button" className="admin-back-link" onClick={() => switchTab('users')}>
          ← 返回用户管理
        </button>
      )}

      {active.permission ? (
        <RequirePermission permission={active.permission}>{active.panel}</RequirePermission>
      ) : (
        active.panel
      )}
    </div>
  )
}
