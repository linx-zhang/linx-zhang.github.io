import ReactMarkdown from 'react-markdown'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import rehypePrismPlus from 'rehype-prism-plus'
import { useEffect, useRef } from 'react'
import type { CSSProperties, MouseEvent } from 'react'
import 'github-markdown-css/github-markdown.css'
import 'prism-themes/themes/prism-one-light.css'
import './MarkdownView.css'

interface MarkdownViewProps {
  content: string
  className?: string
  style?: CSSProperties
}

/** 非 https 或旧浏览器里 clipboard API 不可用，退回 textarea + execCommand */
async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // 继续走下面的兜底
    }
  }
  const holder = document.createElement('textarea')
  holder.value = text
  holder.setAttribute('readonly', '')
  holder.style.position = 'fixed'
  holder.style.top = '-1000px'
  document.body.appendChild(holder)
  holder.select()
  const ok = document.execCommand('copy')
  document.body.removeChild(holder)
  return ok
}

/** 全站统一的 Markdown 渲染入口，避免 Docs 与博客使用不同插件配置 */
export default function MarkdownView({ content, className, style }: MarkdownViewProps) {
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

  return (
    <div
      ref={containerRef}
      className={className ? `markdown-body ${className}` : 'markdown-body'}
      style={{ color: '#1f2937', lineHeight: 1.6, ...style }}
      onClick={handleCopy}
    >
      <ReactMarkdown
        remarkPlugins={[remarkFrontmatter, remarkGfm]}
        rehypePlugins={[rehypeRaw, [rehypePrismPlus, { ignoreMissing: true }]]}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
