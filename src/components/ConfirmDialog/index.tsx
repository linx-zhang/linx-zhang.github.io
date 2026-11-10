import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import './ConfirmDialog.css'

export interface ConfirmDialogProps {
  title: string
  description?: ReactNode
  confirmText?: string
  cancelText?: string
  /** 提交期间确认键上的文案 */
  pendingText?: string
  tone?: 'primary' | 'danger'
  pending?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** 受控确认弹窗：挂到 body 上，避免被父级 overflow 裁切 */
export default function ConfirmDialog({
  title,
  description,
  confirmText = '确认',
  cancelText = '取消',
  pendingText = '处理中…',
  tone = 'primary',
  pending = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null)
  const previousFocus = useRef<Element | null>(null)

  useEffect(() => {
    previousFocus.current = document.activeElement
    confirmRef.current?.focus()
    return () => {
      const target = previousFocus.current
      if (target instanceof HTMLElement && document.contains(target)) target.focus()
    }
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !pending) onCancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [pending, onCancel])

  return createPortal(
    <div
      className="confirm-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget && !pending) onCancel()
      }}
    >
      <div
        className="confirm-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
      >
        <h2 id="confirm-dialog-title" className="confirm-title">
          {title}
        </h2>
        {description && <div className="confirm-desc">{description}</div>}
        <div className="confirm-actions">
          <button
            type="button"
            className="confirm-button confirm-cancel"
            disabled={pending}
            onClick={onCancel}
          >
            {cancelText}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={
              tone === 'danger'
                ? 'confirm-button confirm-confirm confirm-danger'
                : 'confirm-button confirm-confirm'
            }
            disabled={pending}
            onClick={onConfirm}
          >
            {pending ? pendingText : confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
