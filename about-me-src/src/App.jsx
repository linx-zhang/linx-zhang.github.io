import './App.css'

function App() {
  return (
    <div style={{
      maxWidth: '920px',
      margin: '2rem auto',
      padding: '0 1rem',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
      color: '#1f2937',
      lineHeight: '1.65'
    }}>
      {/* 头部 */}
      <header style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
        <h1 style={{ margin: 0, fontSize: '2.2rem' }}>Linx Zhang</h1>
        <p style={{ fontSize: '1.15rem', color: '#4b5563', marginTop: '4px' }}>高级 Python 工程师 · 数据平台 / 后端架构</p>
        <div style={{ marginTop: '1rem' }}>
          <a href="mailto:xxx@shturl.com" style={{ margin: '0 8px' }}>邮箱</a>
          <a href="https://github.com/linx-zhang" style={{ margin: '0 8px' }}>GitHub</a>
          <a href="/" style={{ margin: '0 8px' }}>← 返回知识库</a>
        </div>
      </header>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{
          borderBottom: '1px solid #e5e7eb',
          paddingBottom: '6px',
          fontSize: '1.3rem'
        }}>个人简介</h2>
        <p>
          高级Python后端工程师，长期深耕数据平台、异步任务调度、业务服务架构方向。擅长基于Python生态搭建高吞吐、可观测的数据链路，精通关系型数据库、缓存、消息中间件的落地与性能调优。
          有大规模结构化/三维资产数据处理经验，主导过ETL、离线计算、异步任务中台、数据治理相关模块建设；注重代码规范、可维护性与工程化沉淀，自建技术知识库持续输出笔记与脚本工具。
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{
          borderBottom: '1px solid #e5e7eb',
          paddingBottom: '6px',
          fontSize: '1.3rem'
        }}>核心技术栈</h2>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '0.6rem' }}>
          {[
            "Python", "Django", "FastAPI", "Redis", "PostgreSQL", "PolarDB",
            "MQ", "异步任务", "ETL", "数据平台", "Linux", "Git", "3D网格处理", "性能调优"
          ].map(tag => (
            <span key={tag} style={{
              background: '#f3f4f6',
              padding: '5px 11px',
              borderRadius: '999px',
              fontSize: '0.9rem'
            }}>{tag}</span>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{
          borderBottom: '1px solid #e5e7eb',
          paddingBottom: '6px',
          fontSize: '1.3rem'
        }}>工作经历</h2>

        {/* 第3段 重点：2022-06 数据平台 */}
        <div style={{ marginTop: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0 }}>【公司C】｜高级Python工程师 · 数据平台</h3>
            <span style={{ color: '#6b7280', whiteSpace: 'nowrap' }}>2022.06 - 至今</span>
          </div>
          <ul style={{ paddingLeft: '1.2rem', margin: '0.6rem 0 0', color: '#374151' }}>
            <li>负责数据平台核心链路建设，设计并落地多数据源ETL同步、离线计算、数据清洗流水线，支撑业务报表、指标统计、资产入库；</li>
            <li>基于 Redis + MQ 搭建分布式异步任务中台，支持任务限流、重试、死信、进度追踪，显著提升平台吞吐与稳定性；</li>
            <li>PostgreSQL / PolarDB 慢查询治理、索引优化、分库分表方案落地，解决大数据量下查询超时、锁竞争问题；</li>
            <li>负责3D人体资产数据处理服务开发，实现OBJ网格解析、特征提取、测量算法对接，承接上层业务数据需求；</li>
            <li>推动平台可观测建设：日志埋点、指标上报、告警体系，降低线上故障排查耗时。</li>
          </ul>
        </div>

        {/* 第2段 2021-12 */}
        <div style={{ marginTop: '1.4rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0 }}>【公司B】｜Python后端工程师</h3>
            <span style={{ color: '#6b7280', whiteSpace: 'nowrap' }}>2021.12 - 2022.05</span>
          </div>
          <ul style={{ paddingLeft: '1.2rem', margin: '0.6rem 0 0', color: '#374151' }}>
            <li>参与业务后端服务迭代，使用Django开发业务接口、后台管理模块，支撑内部运营与数据上报；</li>
            <li>开发定时脚本、数据校验脚本，完成业务数据清洗、对账、异常告警自动化；</li>
            <li>配合DBA完成SQL优化，梳理存量脏数据，输出数据修复方案。</li>
          </ul>
        </div>

        {/* 第1段 2020 */}
        <div style={{ marginTop: '1.4rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0 }}>【公司A】｜Python开发工程师</h3>
            <span style={{ color: '#6b7280', whiteSpace: 'nowrap' }}>2020.XX - 2021.11</span>
          </div>
          <ul style={{ paddingLeft: '1.2rem', margin: '0.6rem 0 0', color: '#374151' }}>
            <li>负责内部工具、自动化脚本开发，解放重复人工操作；</li>
            <li>学习Web服务、数据库、Linux运维，参与小型服务部署与问题排查；</li>
            <li>沉淀编码规范，持续提升代码健壮性。</li>
          </ul>
        </div>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{
          borderBottom: '1px solid #e5e7eb',
          paddingBottom: '6px',
          fontSize: '1.3rem'
        }}>个人项目</h2>
        <div style={{ marginTop: '0.8rem' }}>
          <h3 style={{ margin: 0 }}>个人技术知识库（当前站点）</h3>
          <ul style={{ paddingLeft: '1.2rem', margin: '0.5rem 0 0' }}>
            <li>GitHub Pages 静态知识库，Python脚本自动扫描目录生成导航菜单；</li>
            <li>按主题沉淀编译原理、C/C++、Python、中间件、数据库笔记；</li>
            <li>配套自动化构建脚本，一键编译React Profile页面、同步产物、更新导航。</li>
          </ul>
        </div>
      </section>

      <section>
        <h2 style={{
          borderBottom: '1px solid #e5e7eb',
          paddingBottom: '6px',
          fontSize: '1.3rem'
        }}>教育</h2>
        <p style={{ marginTop: '0.6rem' }}>XX大学｜XX专业｜20XX - 20XX</p>
      </section>
    </div>
  )
}

export default App
