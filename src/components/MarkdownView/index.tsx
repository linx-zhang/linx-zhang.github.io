import ReactMarkdown from 'react-markdown'
import type { PluggableList } from 'unified'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import rehypePrismPlus from 'rehype-prism-plus'
import { useEffect, useRef } from 'react'
import type { CSSProperties, MouseEvent } from 'react'
import 'github-markdown-css/github-markdown.css'
import 'prism-themes/themes/prism-one-light.css'
import './MarkdownView.css'
import { copyText } from '@/utils/clipboard'

interface MarkdownViewProps {
  content: string
  className?: string
  style?: CSSProperties
  /**
   * 是否放行 Markdown 里的原始 HTML。
   *
   * 只有内容来源可信时才开（wiki：仓库里的 md，作者就是站点主人）。
   * 博客正文来自任意注册用户，默认关闭——否则 <style> / <iframe> / <form> 会真进 DOM，
   * 可以伪造登录浮层钓 localStorage 里的 token。关闭后原始 HTML 退化成文本，正文照常可读。
   */
  rawHtml?: boolean
}

/** 全站统一的 Markdown 渲染入口，避免 Docs 与博客使用不同插件配置 */
export default function MarkdownView({
  content,
  className,
  style,
  rawHtml = false,
}: MarkdownViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  // 代码块复制按钮：md 是运行时渲染的，给每个 <pre> 挂一个按钮，内容变化后重挂
  useEffect(() => {
    const root = containerRef.current
    if (!root) return
    root.querySelectorAll('pre').forEach((pre) => {
      if (pre.querySelector('.md-copy-btn')) return
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'md-copy-btn no-print'
      button.textContent = '复制'
      pre.appendChild(button)
    })
  }, [content])

  const handleCopy = async (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement
    if (!target.classList.contains('md-copy-btn')) return
    const pre = target.closest('pre')
    const code = pre?.querySelector('code')
    const text = (code ?? pre)?.textContent ?? ''
    const ok = await copyText(text)
    target.textContent = ok ? '已复制' : '复制失败'
    target.setAttribute('data-copied', String(ok))
    window.setTimeout(() => {
      target.textContent = '复制'
      target.setAttribute('data-copied', 'false')
    }, 1400)
  }

  // rehypeRaw 只在可信内容下挂载
  const rehypePlugins: PluggableList = rawHtml
    ? [rehypeRaw, [rehypePrismPlus, { ignoreMissing: true }]]
    : [[rehypePrismPlus, { ignoreMissing: true }]]

  return (
    <div
      ref={containerRef}
      className={className ? `markdown-body ${className}` : 'markdown-body'}
      style={{ color: '#1f2937', lineHeight: 1.6, ...style }}
      onClick={handleCopy}
    >
      <ReactMarkdown remarkPlugins={[remarkFrontmatter, remarkGfm]} rehypePlugins={rehypePlugins}>
        {content}
      </ReactMarkdown>
    </div>
  )
}
