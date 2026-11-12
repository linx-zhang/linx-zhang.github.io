import type { ReactNode } from 'react'
import DialogShell from '@/components/DialogShell'
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
  return (
    <DialogShell
      overlayClassName="confirm-overlay"
      cardClassName="confirm-card"
      onClose={onCancel}
      blocking={pending}
      initialFocusSelector=".confirm-confirm"
    >
      {(titleId) => (
        <>
          <h2 id={titleId} className="confirm-title">
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
        </>
      )}
    </DialogShell>
  )
}
