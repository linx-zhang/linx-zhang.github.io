import { useEffect, useId, useRef } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { createPortal } from 'react-dom'

/** 可聚焦元素选择器，用于初始聚焦与 Tab 循环 */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export interface DialogShellProps {
  /** 遮罩层类名（各弹窗自带的样式） */
  overlayClassName: string
  /** 卡片类名 */
  cardClassName: string
  onClose: () => void
  /** true 时 Escape 与点击遮罩都不关闭（提交中） */
  blocking?: boolean
  /** 卡片没有标题元素时，用 aria-label 描述；有标题则通过 children 回调传入 id 给 aria-labelledby */
  ariaLabel?: string
  /** 覆盖卡片最大宽度等内联样式 */
  cardStyle?: CSSProperties
  /** 初始聚焦选择器，默认取卡片内第一个可聚焦元素 */
  initialFocusSelector?: string
  children: (titleId: string) => ReactNode
}

/**
 * 弹窗基座：portal 到 body、遮罩点击关闭、Escape 关闭、焦点记录与恢复、Tab 焦点循环。
 * 标题 id 由 useId 生成，因此多个弹窗同时存在也不会互相指错标题。
 */
export default function DialogShell({
  overlayClassName,
  cardClassName,
  onClose,
  blocking = false,
  ariaLabel,
  cardStyle,
  initialFocusSelector,
  children,
}: DialogShellProps) {
  const titleId = useId()
  const cardRef = useRef<HTMLDivElement>(null)
  const previousFocus = useRef<Element | null>(null)

  useEffect(() => {
    previousFocus.current = document.activeElement
    const card = cardRef.current
    const first = card?.querySelector<HTMLElement>(initialFocusSelector ?? FOCUSABLE)
    first?.focus()
    return () => {
      const target = previousFocus.current
      if (target instanceof HTMLElement && document.contains(target)) target.focus()
    }
    // 只在挂载时执行一次：初始聚焦与关闭后的焦点恢复
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (blocking) return
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab') return

      const card = cardRef.current
      if (!card) return
      const nodes = Array.from(card.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (nodes.length === 0) {
        event.preventDefault()
        return
      }

      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      const active = document.activeElement

      if (event.shiftKey) {
        if (active === first || !(active instanceof HTMLElement) || !card.contains(active)) {
          event.preventDefault()
          last.focus()
        }
        return
      }
      if (active === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [blocking, onClose])

  return createPortal(
    <div
      className={overlayClassName}
      onClick={(event) => {
        if (event.target === event.currentTarget && !blocking) onClose()
      }}
    >
      <div
        ref={cardRef}
        className={cardClassName}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabel ? undefined : titleId}
        style={cardStyle}
      >
        {children(titleId)}
      </div>
    </div>,
    document.body,
  )
}
