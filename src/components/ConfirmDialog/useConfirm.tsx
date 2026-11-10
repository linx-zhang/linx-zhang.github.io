import { useCallback, useState } from 'react'
import type { ReactNode } from 'react'
import ConfirmDialog from '@/components/ConfirmDialog'

export interface ConfirmOptions {
  title: string
  description?: ReactNode
  confirmText?: string
  cancelText?: string
  pendingText?: string
  tone?: 'primary' | 'danger'
  /** 确认后执行的异步操作；期间确认键禁用，结束后弹窗关闭 */
  onConfirm: () => void | Promise<void>
}

/** 页面级确认弹窗：同一时刻只会有一个确认框 */
export function useConfirm() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const [pending, setPending] = useState(false)

  const confirm = useCallback((next: ConfirmOptions) => {
    setPending(false)
    setOptions(next)
  }, [])

  const close = useCallback(() => {
    setPending(false)
    setOptions(null)
  }, [])

  const handleConfirm = useCallback(async () => {
    if (!options) return
    setPending(true)
    try {
      await options.onConfirm()
    } catch {
      // 失败时由调用方展示错误，这里只负责关闭弹窗
    } finally {
      setPending(false)
      setOptions(null)
    }
  }, [options])

  const dialog = options ? (
    <ConfirmDialog
      title={options.title}
      description={options.description}
      confirmText={options.confirmText}
      cancelText={options.cancelText}
      pendingText={options.pendingText}
      tone={options.tone}
      pending={pending}
      onConfirm={handleConfirm}
      onCancel={close}
    />
  ) : null

  return { confirm, dialog }
}
