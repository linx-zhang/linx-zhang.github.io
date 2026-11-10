import { useSearchParams } from 'react-router-dom'
import PostsTab from './PostsTab'
import InvitesTab from './InvitesTab'
import './Admin.css'

export default function Admin() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') === 'invites' ? 'invites' : 'posts'

  const switchTab = (next: 'posts' | 'invites') => {
    setSearchParams(next === 'invites' ? { tab: 'invites' } : {})
  }

  return (
    <div className="admin-page">
      <header className="admin-header">
        <h1>管理后台</h1>
        <p>发布文章、生成和管理邀请码。</p>
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
      </div>

      {tab === 'posts' ? <PostsTab /> : <InvitesTab />}
    </div>
  )
}
