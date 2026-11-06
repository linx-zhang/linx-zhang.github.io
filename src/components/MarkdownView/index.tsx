import ReactMarkdown from 'react-markdown'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import rehypePrismPlus from 'rehype-prism-plus'
import type { CSSProperties } from 'react'
import 'github-markdown-css/github-markdown.css'
import 'prism-themes/themes/prism-one-light.css'

interface MarkdownViewProps {
  content: string
  className?: string
  style?: CSSProperties
}

/** 全站统一的 Markdown 渲染入口，避免 Docs 与博客使用不同插件配置 */
export default function MarkdownView({ content, className, style }: MarkdownViewProps) {
  return (
    <div
      className={className ? `markdown-body ${className}` : 'markdown-body'}
      style={{ color: '#1f2937', lineHeight: 1.6, ...style }}
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
