import type { ReactNode } from 'react'
import DialogShell from '@/components/DialogShell'
import './Modal.css'

export interface ModalProps {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  /** 提交中：禁止 Escape / 点击遮罩关闭 */
  busy?: boolean
  width?: number
}

/** 通用弹窗：挂 body，Escape / 点击遮罩关闭 */
export default function Modal({
  title,
  onClose,
  children,
  footer,
  busy = false,
  width = 440,
}: ModalProps) {
  return (
    <DialogShell
      overlayClassName="modal-overlay"
      cardClassName="modal-card"
      onClose={onClose}
      blocking={busy}
      cardStyle={{ maxWidth: width }}
      initialFocusSelector="input:not([disabled]), button"
    >
      {(titleId) => (
        <>
          <div className="modal-head">
            <h2 id={titleId} className="modal-title">
              {title}
            </h2>
            <button
              type="button"
              className="modal-close"
              aria-label="关闭"
              disabled={busy}
              onClick={onClose}
            >
              ×
            </button>
          </div>
          <div className="modal-body">{children}</div>
          {footer && <div className="modal-footer">{footer}</div>}
        </>
      )}
    </DialogShell>
  )
}
