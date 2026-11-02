import './App.css'

function App() {
  return (
    <div style={{
      maxWidth: '900px',
      margin: '2rem auto',
      padding: '0 1rem',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      color: '#222'
    }}>
      {/* 头部 */}
      <header style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h1 style={{ margin: 0, fontSize: '2rem' }}>Linx Zhang</h1>
        <p style={{ color: '#666' }}>后端开发工程师</p>
        <div style={{ marginTop: '0.5rem' }}>
          <a href="mailto:xxx@shturl." style={{ margin: '0 8px' }}>邮箱</a>
          <a href="https://github.com/linx-zhang" style={{ margin: '0 8px' }}>GitHub</a>
          <a href="/" style={{ margin: '0 8px' }}>← 返回知识库</a>
        </div>
      </header>

      <section style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ borderBottom: '1px solid #ddd', paddingBottom: '4px' }}>个人简介</h2>
        <p>
          后端开发工程师，熟悉 Python / Go，擅长 Web 服务、中间件、数据库优化，
          有 3D 相关数据处理、消息队列、缓存架构落地经验。热爱技术沉淀，维护个人知识库。
        </p>
      </section>

      <section style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ borderBottom: '1px solid #ddd', paddingBottom: '4px' }}>技术栈</h2>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {["Python", "Django", "Redis", "PostgreSQL", "MQ", "Go", "Git", "Linux"].map(tag => (
            <span key={tag} style={{
              background: '#efefef',
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '0.9rem'
            }}>{tag}</span>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ borderBottom: '1px solid #ddd', paddingBottom: '4px' }}>工作经历</h2>
        <div>
          <h3 style={{ margin: '0' }}>XX公司｜后端工程师</h3>
          <p style={{ color: '#666', margin: '4px 0 8px' }}>20XX.XX - 至今</p>
          <ul style={{ paddingLeft: '1.2rem', margin:0 }}>
            <li>负责3D人体资产处理服务开发，OBJ网格解析、测量算法对接</li>
            <li>设计并实现基于Redis+MQ的异步任务链路，提升吞吐</li>
            <li>PostgreSQL索引优化、慢查询治理，PolarDB使用与调优</li>
          </ul>
        </div>
      </section>

      <section style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ borderBottom: '1px solid #ddd', paddingBottom: '4px' }}>项目</h2>
        <div>
          <h3 style={{ margin: '0' }}>个人知识库（当前站点）</h3>
          <ul style={{ paddingLeft: '1.2rem', margin:0 }}>
            <li>GitHub Pages 静态站点，Python脚本自动生成目录导航</li>
            <li>按主题分类沉淀技术笔记，包含C++/Python/编译链接等内容</li>
          </ul>
        </div>
      </section>

      <section>
        <h2 style={{ borderBottom: '1px solid #ddd', paddingBottom: '4px' }}>教育</h2>
        <p>XX大学｜XX专业｜20XX - 20XX</p>
      </section>
    </div>
  )
}

export default App
