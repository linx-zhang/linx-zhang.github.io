import { useSearchParams } from 'react-router-dom'
import { usePermission } from '@/auth/usePermission'
import RequirePermission from '@/components/RequirePermission'
import PostsTab from './PostsTab'
import InvitesTab from './InvitesTab'
import UsersTab from './UsersTab'
import './Admin.css'

type AdminTab = 'posts' | 'invites' | 'users'

export default function Admin() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { has } = usePermission()
  const canReadUsers = has('user:read:any')

  const rawTab = searchParams.get('tab')
  const tab: AdminTab =
    rawTab === 'invites' ? 'invites' : rawTab === 'users' ? 'users' : 'posts'

  const switchTab = (next: AdminTab) => {
    setSearchParams(next === 'posts' ? {} : { tab: next })
  }

  return (
    <div className="admin-page">
      <header className="admin-header">
        <h1>管理后台</h1>
        <p>发布文章、管理邀请码与用户。</p>
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
      </div>

      {tab === 'posts' && <PostsTab />}
      {tab === 'invites' && <InvitesTab />}
      {tab === 'users' && (
        <RequirePermission permission="user:read:any">
          <UsersTab />
        </RequirePermission>
      )}
    </div>
  )
}
