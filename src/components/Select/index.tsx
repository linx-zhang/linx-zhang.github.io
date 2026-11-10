import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useFloatingPanel } from '@/components/FloatingPanel/useFloatingPanel'
import './Select.css'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface SelectProps {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  disabled?: boolean
  placeholder?: string
  ariaLabel?: string
}

const PANEL_MAX_HEIGHT = 280

/** 受控自定义下拉：浮层挂 body，避免被父级 overflow 裁切 */
export default function Select({
  value,
  onChange,
  options,
  disabled = false,
  placeholder = '请选择',
  ariaLabel,
}: SelectProps) {
  const [activeIndex, setActiveIndex] = useState(-1)

  const { open, position, triggerRef, panelRef, openPanel: openFloating, closePanel: closeFloating } =
    useFloatingPanel({
      estimateHeight: Math.min(PANEL_MAX_HEIGHT, options.length * 38 + 8),
    })
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])

  const selected = options.find((option) => option.value === value)

  const openPanel = () => {
    if (disabled) return
    const index = options.findIndex((option) => option.value === value && !option.disabled)
    setActiveIndex(index >= 0 ? index : firstEnabledIndex(options))
    openFloating()
  }

  const closePanel = () => {
    closeFloating()
    setActiveIndex(-1)
  }

  const choose = (option: SelectOption) => {
    if (option.disabled) return
    onChange(option.value)
    closePanel()
    triggerRef.current?.focus()
  }

  useEffect(() => {
    if (!open) return
    const node = optionRefs.current[activeIndex]
    node?.scrollIntoView({ block: 'nearest' })
  }, [open, activeIndex])

  const moveActive = (step: 1 | -1) => {
    if (!open) {
      openPanel()
      return
    }
    if (options.length === 0) return
    let next = activeIndex
    for (let i = 0; i < options.length; i += 1) {
      next = (next + step + options.length) % options.length
      if (!options[next].disabled) {
        setActiveIndex(next)
        return
      }
    }
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        moveActive(1)
        break
      case 'ArrowUp':
        event.preventDefault()
        moveActive(-1)
        break
      case 'Enter':
      case ' ': {
        event.preventDefault()
        if (!open) {
          openPanel()
        } else {
          const option = options[activeIndex]
          if (option) choose(option)
        }
        break
      }
      case 'Escape':
        if (open) {
          event.preventDefault()
          closePanel()
        }
        break
      case 'Tab':
        if (open) closePanel()
        break
      case 'Home':
        if (open) {
          event.preventDefault()
          setActiveIndex(firstEnabledIndex(options))
        }
        break
      case 'End':
        if (open) {
          event.preventDefault()
          setActiveIndex(lastEnabledIndex(options))
        }
        break
      default:
        break
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={open ? 'select-trigger select-trigger-open' : 'select-trigger'}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => (open ? closePanel() : openPanel())}
        onKeyDown={handleKeyDown}
      >
        <span className={selected ? 'select-value' : 'select-value select-placeholder'}>
          {selected ? selected.label : placeholder}
        </span>
        <span className="select-arrow" aria-hidden="true">
          ▾
        </span>
      </button>

      {open &&
        position &&
        createPortal(
          <div
            ref={panelRef}
            className="select-panel"
            role="listbox"
            aria-label={ariaLabel}
            style={{
              top: position.top,
              left: position.left,
              width: position.width,
              maxHeight: PANEL_MAX_HEIGHT,
            }}
          >
            {options.map((option, index) => (
              <button
                key={option.value}
                ref={(node) => {
                  optionRefs.current[index] = node
                }}
                type="button"
                role="option"
                aria-selected={option.value === value}
                disabled={option.disabled}
                className={
                  index === activeIndex ? 'select-option select-option-active' : 'select-option'
                }
                onMouseEnter={() => {
                  if (!option.disabled) setActiveIndex(index)
                }}
                onClick={() => choose(option)}
              >
                <span className="select-option-label">{option.label}</span>
                {option.value === value && (
                  <span className="select-check" aria-hidden="true">
                    ✓
                  </span>
                )}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  )
}

function firstEnabledIndex(options: SelectOption[]): number {
  return options.findIndex((option) => !option.disabled)
}

function lastEnabledIndex(options: SelectOption[]): number {
  for (let i = options.length - 1; i >= 0; i -= 1) {
    if (!options[i].disabled) return i
  }
  return -1
}
