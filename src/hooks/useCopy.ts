import { useEffect, useRef, useState } from 'react'
import { copyText } from '@/utils/clipboard'

const RESET_MS = 1600

interface CopyFeedback {
  /** 最近一次复制成功的按钮标识；null 表示这一轮还没有复制过 */
  copiedKey: string | null
  copy: (text: string, key?: string) => Promise<boolean>
  isCopied: (key?: string) => boolean
}

/**
 * 复制按钮的统一反馈：写入剪贴板 → 按钮短暂变「已复制」。
 *
 * 同一屏可能出现多个复制按钮（例如时间戳换算的每一行），所以用 key 区分，
 * 只让被点的那一个变文案；写入失败返回 false，由调用方决定提示方式。
 */
export function useCopy(): CopyFeedback {
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const timer = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
    },
    [],
  )

  const copy = async (text: string, key = '') => {
    const ok = await copyText(text)
    if (!ok) return false
    setCopiedKey(key)
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setCopiedKey(null), RESET_MS)
    return true
  }

  return { copiedKey, copy, isCopied: (key = '') => copiedKey === key }
}
