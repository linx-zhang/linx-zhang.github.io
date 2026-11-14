/**
 * 页面级错误边界：任意子树 render 抛错时，只让这一块失效，而不是整站白屏。
 *
 * 用法两种：
 * 1. 包在 <Routes> 外层 —— 兜住一切（Provider 层面的崩溃也在内）；
 * 2. 包在单个页面 / 面板外层 —— 局部降级，其余页面照常可用。
 */
import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import './ErrorBoundary.css'

interface ErrorBoundaryProps {
  children: ReactNode
  /** 自定义降级 UI；不传则用默认卡片 */
  fallback?: ReactNode
  /** 出错时上报（可选） */
  onError?: (error: Error, info: ErrorInfo) => void
}

interface ErrorBoundaryState {
  error: Error | null
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError?.(error, info)
  }

  private reset = () => {
    this.setState({ error: null })
  }

  render(): ReactNode {
    const { error } = this.state
    if (!error) return this.props.children
    if (this.props.fallback) return this.props.fallback
    return (
      <div className="error-boundary" role="alert">
        <h2>页面出错了</h2>
        <p>这一块内容暂时无法显示。可以先重试，或返回上一页继续浏览。</p>
        <div className="error-boundary-actions">
          <button type="button" className="blog-button" onClick={this.reset}>
            重试
          </button>
          <button type="button" className="blog-button" onClick={() => window.location.reload()}>
            刷新页面
          </button>
        </div>
      </div>
    )
  }
}
