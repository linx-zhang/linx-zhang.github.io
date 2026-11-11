import { useRef } from 'react'
import { useReactToPrint } from 'react-to-print'
import './Profile.css'

export default function Profile() {
  const printContentRef = useRef<HTMLDivElement>(null)

  const handlePrint = useReactToPrint({
    contentRef: printContentRef,
    documentTitle: 'Linx_Zhang_Resume',
    pageStyle: '',
  })

  return (
    <div className="profile-preview-wrap">
      <div ref={printContentRef} className="profile-print-root">
        <div className="profile-header-bar">
          <h1>Linx Zhang</h1>
          <p className="profile-subtitle">高级 Python 工程师 · 数据平台 / 后端架构</p>
          {/* 新增：联系方式文本，网页和PDF都会显示 */}
          <div className="contact-line print-only">
            <span>xxx@qq.com</span>
            {/* <span className="dot">·</span> */}
            {/* <span>github.com/linx-zhang</span> */}
          </div>
          <div className="action-group no-print">
            <a href="mailto:xxx@qq.com">邮箱</a>
            <a href="https://github.com/linx-zhang">GitHub</a>
            <a href="https://www.zhihu.com/people/linx.z/answers">知乎</a>
            <a href="/">返回首页</a>
            <button onClick={handlePrint} className="print-btn">导出 PDF</button>
          </div>
        </div>


        <section className="resume-section">
          <h2>个人简介</h2>
          <p>
            高级Python后端工程师，长期深耕数据平台、异步任务调度、业务服务架构方向。擅长基于Python生态搭建高吞吐、可观测的数据链路，精通关系型数据库、缓存、消息中间件的落地与性能调优。
            有大规模结构化/三维资产数据处理经验，主导过ETL、离线计算、异步任务中台、数据治理相关模块建设；注重代码规范、可维护性与工程化沉淀，自建技术知识库持续输出笔记与脚本工具。
          </p>
        </section>

        <section className="resume-section">
          <h2>核心技术栈</h2>
          <div className="tag-group">
            {[
              "Python", "Django", "FastAPI", "Redis", "PostgreSQL", "PolarDB",
              "MQ", "异步任务", "ETL", "数据平台", "Linux", "Git", "3D网格处理", "性能调优"
            ].map(tag => (
              <span key={tag} className="tag">{tag}</span>
            ))}
          </div>
        </section>

        <section className="resume-section">
          <h2>工作经历</h2>
          <div className="exp-item">
            <div className="exp-head">
              <h3>【公司C】｜高级Python工程师 · 数据平台</h3>
              <span className="exp-date">2022.06 - 至今</span>
            </div>
            <ul>
              <li>负责数据平台核心链路建设，设计并落地多数据源ETL同步、离线计算、数据清洗流水线，支撑业务报表、指标统计、资产入库；</li>
              <li>基于 Redis + MQ 搭建分布式异步任务中台，支持任务限流、重试、死信、进度追踪，显著提升平台吞吐与稳定性；</li>
              <li>PostgreSQL / PolarDB 慢查询治理、索引优化、分库分表方案落地，解决大数据量下查询超时、锁竞争问题；</li>
              <li>负责3D人体资产数据处理服务开发，实现OBJ网格解析、特征提取、测量算法对接，承接上层业务数据需求；</li>
              <li>推动平台可观测建设：日志埋点、指标上报、告警体系，降低线上故障排查耗时。</li>
            </ul>
          </div>

          <div className="exp-item">
            <div className="exp-head">
              <h3>【公司B】｜Python后端工程师</h3>
              <span className="exp-date">2021.12 - 2022.05</span>
            </div>
            <ul>
              <li>参与业务后端服务迭代，使用Django开发业务接口、后台管理模块，支撑内部运营与数据上报；</li>
              <li>开发定时脚本、数据校验脚本，完成业务数据清洗、对账、异常告警自动化；</li>
              <li>配合DBA完成SQL优化，梳理存量脏数据，输出数据修复方案。</li>
            </ul>
          </div>

          <div className="exp-item">
            <div className="exp-head">
              <h3>【公司A】｜Python开发工程师</h3>
              <span className="exp-date">2020.XX - 2021.11</span>
            </div>
            <ul>
              <li>负责内部工具、自动化脚本开发，解放重复人工操作；</li>
              <li>学习Web服务、数据库、Linux运维，参与小型服务部署与问题排查；</li>
              <li>沉淀编码规范，持续提升代码健壮性。</li>
            </ul>
          </div>
        </section>

        <section className="resume-section">
          <h2>个人项目</h2>
          <div className="proj-item">
            <h3>个人技术知识库（当前站点）</h3>
            <ul>
              <li>GitHub Pages 静态知识库，Python脚本自动扫描目录生成导航菜单；</li>
              <li>按主题沉淀编译原理、C/C++、Python、中间件、数据库笔记；</li>
              <li>配套自动化构建脚本，一键编译React Profile页面、同步产物、更新导航。</li>
            </ul>
          </div>
        </section>

        <section className="resume-section">
          <h2>教育</h2>
          <p>XX大学｜XX专业｜20XX - 20XX</p>
        </section>
      </div>
    </div>
  )
}
