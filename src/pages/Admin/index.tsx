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

export default function Admin() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { has } = usePermission()
  const canReadUsers = has('user:read:any')
  const canReadActivity = has('activity:read:any')

  const rawTab = searchParams.get('tab')
  const tab: AdminTab =
    rawTab === 'invites'
      ? 'invites'
      : rawTab === 'users'
        ? 'users'
        : rawTab === 'activity'
          ? 'activity'
          : rawTab === 'analytics'
            ? 'analytics'
            : 'posts'

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
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'posts'}
          className={tab === 'posts' ? 'admin-tab active' : 'admin-tab'}
          onClick={() => switchTab('posts')}
        >
          文章
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'invites'}
          className={tab === 'invites' ? 'admin-tab active' : 'admin-tab'}
          onClick={() => switchTab('invites')}
        >
          邀请码
        </button>
        {canReadUsers && (
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'users'}
            className={tab === 'users' ? 'admin-tab active' : 'admin-tab'}
            onClick={() => switchTab('users')}
          >
            用户
          </button>
        )}
        {canReadActivity && (
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'activity'}
            className={tab === 'activity' ? 'admin-tab active' : 'admin-tab'}
            onClick={() => switchTab('activity')}
          >
            日志
          </button>
        )}
        {canReadActivity && (
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'analytics'}
            className={tab === 'analytics' ? 'admin-tab active' : 'admin-tab'}
            onClick={() => switchTab('analytics')}
          >
            分析
          </button>
        )}
      </div>

      {tab === 'posts' && <PostsTab />}
      {tab === 'invites' && <InvitesTab />}
      {tab === 'users' && (
        <RequirePermission permission="user:read:any">
          <UsersTab />
        </RequirePermission>
      )}
      {tab === 'activity' && (
        <RequirePermission permission="activity:read:any">
          <ActivityTab />
        </RequirePermission>
      )}
      {tab === 'analytics' && (
        <RequirePermission permission="activity:read:any">
          <AnalyticsTab />
        </RequirePermission>
      )}
    </div>
  )
}
