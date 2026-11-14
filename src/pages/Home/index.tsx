import { Link } from 'react-router-dom'
import { blogApi } from '@/api/blog'
import type { Post } from '@/api/blog'
import { useResource } from '@/hooks/useResource'
import { formatDate } from '@/utils/format'
import './Home.css'

const HOME_POST_COUNT = 3

export default function Home() {
  const { data, status } = useResource<Post[]>(
    () => blogApi.listPosts(HOME_POST_COUNT, 0).then((page) => page.items),
    [],
  )
  const posts = data ?? []

  return (
    <div className="home-page">
      <div className="hero">
        <h1>Linx Zhang</h1>
        <p className="home-subtitle">
          高级 Python 后端工程师 · 数据平台 / 后端架构
        </p>
        <p className="desc">
          这里是我的个人站点，包含技术知识库、博客与个人简历三部分。
          内容以 Python、数据库、中间件、数据链路、3D 资产处理为主。
        </p>
      </div>

      <div className="card-grid">
        <Link to="/wiki" className="card">
          <div className="card-icon">📚</div>
          <h2>技术知识库</h2>
          <p>笔记、踩坑记录、代码片段与架构方案</p>
          <span className="card-arrow">查看知识库 →</span>
        </Link>

        <Link to="/blog" className="card">
          <div className="card-icon">📝</div>
          <h2>博客</h2>
          <p>阶段性的技术思考与记录，支持评论交流</p>
          <span className="card-arrow">阅读博客 →</span>
        </Link>

        <Link to="/profile" className="card">
          <div className="card-icon">👤</div>
          <h2>个人简历</h2>
          <p>工作经历、技术栈与项目介绍，可导出 PDF</p>
          <span className="card-arrow">查看简历 →</span>
        </Link>
      </div>

      <section className="home-section">
        <div className="home-section-head">
          <h2>最新文章</h2>
          <Link to="/blog" className="home-section-more">
            查看全部 →
          </Link>
        </div>

        {status === 'loading' && <p className="home-note">加载中…</p>}

        {status === 'ready' && posts.length === 0 && (
          <p className="home-note">还没有发布文章，先看看知识库吧。</p>
        )}

        {status === 'ready' && posts.length > 0 && (
          <ul className="home-posts">
            {posts.map((post) => (
              <li key={post.id}>
                <Link to={`/blog/${post.id}`} className="home-post">
                  <span className="home-post-title">{post.title}</span>
                  <span className="home-post-date">{formatDate(post.created_at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {status === 'error' && (
          <p className="home-note">最新文章暂时不可用，可直接前往博客列表。</p>
        )}
      </section>

      <div className="links-row">
        <a href="https://github.com/linx-zhang" target="_blank" rel="noreferrer">GitHub</a>
        <a href="mailto:xxx@qq.com">Email</a>
      </div>
    </div>
  )
}
