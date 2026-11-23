/**
 * 内置简历模板：接口没有默认简历（首次部署 / 全部删除）时 `/profile` 用这一份。
 *
 * 只保留「可打印正文」，不含导出按钮与返回首页这类操作控件——那些由页面外壳渲染，
 * 管理员编辑简历时看到的也只是这份正文。
 */
export const RESUME_TEMPLATE_HTML = `
<div class="profile-header-bar">
  <h1>Linx Zhang</h1>
  <p class="profile-subtitle">高级 Python 工程师 · 数据平台 / 后端架构</p>
  <div class="contact-line print-only">
    <span>xxx@qq.com</span>
    <span class="dot">·</span>
    <span>github.com/linx-zhang</span>
  </div>
</div>

<section class="resume-section">
  <h2>个人简介</h2>
  <p>
    高级 Python 后端工程师，长期深耕数据平台、异步任务调度、业务服务架构方向。擅长基于 Python 生态搭建高吞吐、可观测的数据链路，精通关系型数据库、缓存、消息中间件的落地与性能调优。
    有大规模结构化 / 三维资产数据处理经验，主导过 ETL、离线计算、异步任务中台、数据治理相关模块建设；注重代码规范、可维护性与工程化沉淀，自建技术知识库持续输出笔记与脚本工具。
  </p>
</section>

<section class="resume-section">
  <h2>核心技术栈</h2>
  <div class="tag-group">
    <span class="tag">Python</span>
    <span class="tag">Django</span>
    <span class="tag">FastAPI</span>
    <span class="tag">Redis</span>
    <span class="tag">PostgreSQL</span>
    <span class="tag">PolarDB</span>
    <span class="tag">MQ</span>
    <span class="tag">异步任务</span>
    <span class="tag">ETL</span>
    <span class="tag">数据平台</span>
    <span class="tag">Linux</span>
    <span class="tag">Git</span>
    <span class="tag">3D 网格处理</span>
    <span class="tag">性能调优</span>
  </div>
</section>

<section class="resume-section">
  <h2>工作经历</h2>
  <div class="exp-item">
    <div class="exp-head">
      <h3>【公司C】｜高级 Python 工程师 · 数据平台</h3>
      <span class="exp-date">2022.06 - 至今</span>
    </div>
    <ul>
      <li>负责数据平台核心链路建设，设计并落地多数据源 ETL 同步、离线计算、数据清洗流水线，支撑业务报表、指标统计、资产入库；</li>
      <li>基于 Redis + MQ 搭建分布式异步任务中台，支持任务限流、重试、死信、进度追踪，显著提升平台吞吐与稳定性；</li>
      <li>PostgreSQL / PolarDB 慢查询治理、索引优化、分库分表方案落地，解决大数据量下查询超时、锁竞争问题；</li>
      <li>负责 3D 人体资产数据处理服务开发，实现 OBJ 网格解析、特征提取、测量算法对接，承接上层业务数据需求；</li>
      <li>推动平台可观测建设：日志埋点、指标上报、告警体系，降低线上故障排查耗时。</li>
    </ul>
  </div>

  <div class="exp-item">
    <div class="exp-head">
      <h3>【公司B】｜Python 后端工程师</h3>
      <span class="exp-date">2021.12 - 2022.05</span>
    </div>
    <ul>
      <li>参与业务后端服务迭代，使用 Django 开发业务接口、后台管理模块，支撑内部运营与数据上报；</li>
      <li>开发定时脚本、数据校验脚本，完成业务数据清洗、对账、异常告警自动化；</li>
      <li>配合 DBA 完成 SQL 优化，梳理存量脏数据，输出数据修复方案。</li>
    </ul>
  </div>

  <div class="exp-item">
    <div class="exp-head">
      <h3>【公司A】｜Python 开发工程师</h3>
      <span class="exp-date">2020.XX - 2021.11</span>
    </div>
    <ul>
      <li>负责内部工具、自动化脚本开发，解放重复人工操作；</li>
      <li>学习 Web 服务、数据库、Linux 运维，参与小型服务部署与问题排查；</li>
      <li>沉淀编码规范，持续提升代码健壮性。</li>
    </ul>
  </div>
</section>

<section class="resume-section">
  <h2>个人项目</h2>
  <div class="proj-item">
    <h3>个人技术知识库（当前站点）</h3>
    <ul>
      <li>Vite + React + TypeScript 构建的单页站点，GitHub Pages 托管，Cloudflare Worker + D1 提供账号、文章与数据接口；</li>
      <li>知识库源文件集中在 raw-docs，构建期镜像成 /wiki 静态产物、运行时读索引渲染，md 与 html 两类文档分开处理；</li>
      <li>按主题沉淀编译原理、C/C++、Python、中间件、数据库笔记；另有博客评论、工具箱与可导出 PDF 的简历页。</li>
    </ul>
  </div>
</section>

<section class="resume-section">
  <h2>教育</h2>
  <p>XX大学｜XX专业｜20XX - 20XX</p>
</section>
`.trim()
