import { describe, expect, it } from 'vitest'
import { sanitizeResumeHtml } from './resumeHtml'

describe('sanitizeResumeHtml', () => {
  it('保留简历排版需要的标签与类名', () => {
    const html = '<section class="resume-section"><h2>工作经历</h2><p>正文</p></section>'
    expect(sanitizeResumeHtml(html)).toBe(html)
  })

  it('脚本、表单与事件属性都进不来', () => {
    const html =
      '<p onclick="alert(1)">安全</p><script>alert(1)</script><form><input value="x"></form>'
    const clean = sanitizeResumeHtml(html)
    expect(clean).toContain('<p>安全</p>')
    expect(clean).not.toContain('onclick')
    expect(clean).not.toContain('<script')
    expect(clean).not.toContain('<form')
    expect(clean).not.toContain('<input')
  })

  it('只保留白名单类名，去掉 style / id / data-*', () => {
    const html =
      '<div class="resume-section evil" style="color:red" id="x" data-a="b">内容</div>'
    expect(sanitizeResumeHtml(html)).toBe('<div class="resume-section">内容</div>')
  })

  it('链接只放行 http/https/mailto 与站内路径', () => {
    const ok = sanitizeResumeHtml(
      '<a href="https://example.com" target="_blank" onclick="x()">外链</a>',
    )
    expect(ok).toContain('href="https://example.com"')
    expect(ok).toContain('rel="noopener noreferrer"')
    expect(ok).not.toContain('target=')
    expect(ok).not.toContain('onclick=')

    const bad = sanitizeResumeHtml('<a href="javascript:alert(1)">点我</a>')
    expect(bad).toBe('<a>点我</a>')
  })

  it('未知标签脱壳保留文字，不留下图层', () => {
    expect(sanitizeResumeHtml('<main><p>保留</p></main>')).toBe('<p>保留</p>')
  })
})
