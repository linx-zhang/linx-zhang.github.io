import { Link } from 'react-router-dom'
import './Home.css'

export default function Home() {
  return (
    <div className="home-page">
      <div className="hero">
        <h1>Linx Zhang</h1>
        <p className="subtitle">
          高级 Python 后端工程师 · 数据平台 / 后端架构
        </p>
        <p className="desc">
          这里是我的个人站点，用来沉淀技术笔记、项目实践与个人简历。
          内容以 Python、数据库、中间件、数据链路、3D 资产处理为主。
        </p>
      </div>

      <div className="card-grid">
        <Link to="/wiki" className="card">
          <div className="card-icon">📚</div>
          <h2>技术知识库</h2>
          <p>笔记、踩坑记录、代码片段、架构方案，持续更新</p>
        </Link>

        <Link to="/profile" className="card">
          <div className="card-icon">👤</div>
          <h2>个人简历</h2>
          <p>工作经历、技术栈、项目介绍，支持一键导出 PDF</p>
        </Link>
      </div>

      <div className="links-row">
        <a href="https://github.com/linx-zhang" target="_blank" rel="noreferrer">GitHub</a>
        <a href="mailto:xxx@shturl.com">Email</a>
      </div>
    </div>
  )
}
