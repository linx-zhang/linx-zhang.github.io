import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'

export interface FloatingPanelPosition {
  top: number
  left: number
  width: number
}

export interface UseFloatingPanelOptions {
  /** 浮层预估高度，下方放不下时翻转到触发器上方 */
  estimateHeight: number
  /** 浮层最小宽度，默认与触发器同宽 */
  minWidth?: number
  /** 浮层最大宽度 */
  maxWidth?: number
}

export interface FloatingPanelApi {
  open: boolean
  position: FloatingPanelPosition | null
  triggerRef: RefObject<HTMLButtonElement | null>
  panelRef: RefObject<HTMLDivElement | null>
  openPanel: () => void
  closePanel: () => void
  togglePanel: () => void
}

const VIEWPORT_MARGIN = 8

/**
 * 浮层通用行为：fixed 定位、下方空间不足时向上翻转、水平不超出视口，
 * 以及点击外部 / resize / scroll 时自动关闭。Select 与 DateRangePicker 共用。
 */
export function useFloatingPanel({
  estimateHeight,
  minWidth,
  maxWidth,
}: UseFloatingPanelOptions): FloatingPanelApi {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<FloatingPanelPosition | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const computePosition = (): FloatingPanelPosition | null => {
    const trigger = triggerRef.current
    if (!trigger) return null
    const rect = trigger.getBoundingClientRect()
    let width = rect.width
    if (minWidth !== undefined) width = Math.max(width, minWidth)
    if (maxWidth !== undefined) width = Math.min(width, maxWidth)
    width = Math.min(width, window.innerWidth - VIEWPORT_MARGIN * 2)

    let top = rect.bottom + 4
    if (top + estimateHeight > window.innerHeight - VIEWPORT_MARGIN) {
      top = Math.max(VIEWPORT_MARGIN, rect.top - estimateHeight - 4)
    }

    let left = rect.left
    if (left + width > window.innerWidth - VIEWPORT_MARGIN) {
      left = Math.max(VIEWPORT_MARGIN, window.innerWidth - VIEWPORT_MARGIN - width)
    }

    return { top, left, width }
  }

  const openPanel = () => {
    setPosition(computePosition())
    setOpen(true)
  }

  const closePanel = () => setOpen(false)

  const togglePanel = () => {
    if (open) closePanel()
    else openPanel()
  }

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (triggerRef.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return
      setOpen(false)
    }
    const onViewportChange = () => setOpen(false)
    document.addEventListener('mousedown', onPointerDown)
    window.addEventListener('resize', onViewportChange)
    window.addEventListener('scroll', onViewportChange, true)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('resize', onViewportChange)
      window.removeEventListener('scroll', onViewportChange, true)
    }
  }, [open])

  return { open, position, triggerRef, panelRef, openPanel, closePanel, togglePanel }
}
