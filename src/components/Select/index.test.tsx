import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import Select from '@/components/Select'

const OPTIONS = [
  { value: '2', label: '2 空格' },
  { value: '4', label: '4 空格' },
  { value: '1', label: 'Tab' },
]

function renderSelect(value = '2', extra: { disabled?: boolean; className?: string; panelClassName?: string } = {}) {
  const onChange = vi.fn()
  render(
    <Select
      ariaLabel="缩进方式"
      value={value}
      onChange={onChange}
      options={OPTIONS}
      className={extra.className}
      panelClassName={extra.panelClassName}
      disabled={extra.disabled}
    />,
  )
  return { onChange, trigger: screen.getByRole('button', { name: '缩进方式' }) }
}

// 用原生断言而不是 jest-dom：这里没有装 @testing-library/jest-dom
const opened = () => screen.queryByRole('listbox') !== null

describe('Select', () => {
  it('触发器显示当前值，列举项要点击后才出现', () => {
    const { trigger } = renderSelect()
    expect(trigger.textContent).toContain('2 空格')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(opened()).toBe(false)

    fireEvent.click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(opened()).toBe(true)
  })

  it('点选某一项会回调并收起面板', () => {
    const { onChange, trigger } = renderSelect()
    fireEvent.click(trigger)
    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(3)
    // 选中项标记在 aria-selected 上，视觉对勾跟着它走
    expect(options[0].getAttribute('aria-selected')).toBe('true')
    expect(options[1].getAttribute('aria-selected')).toBe('false')

    fireEvent.click(options[1])
    expect(onChange).toHaveBeenCalledWith('4')
    expect(opened()).toBe(false)
  })

  it('键盘：ArrowDown 打开、再按一次换到下一项、Enter 确认', () => {
    const { onChange, trigger } = renderSelect()
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    expect(opened()).toBe(true)

    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    fireEvent.keyDown(trigger, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('4')
  })

  it('键盘：Esc 与 Tab 都收起面板，Esc 不触发选择', () => {
    const { onChange, trigger } = renderSelect()

    fireEvent.click(trigger)
    fireEvent.keyDown(trigger, { key: 'Escape' })
    expect(opened()).toBe(false)

    fireEvent.click(trigger)
    fireEvent.keyDown(trigger, { key: 'Tab' })
    expect(opened()).toBe(false)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('点面板之外的地方自动收起', () => {
    const { trigger } = renderSelect()
    fireEvent.click(trigger)
    expect(opened()).toBe(true)

    fireEvent.mouseDown(document.body)
    expect(opened()).toBe(false)
  })

  it('禁用时点不开', () => {
    const { trigger } = renderSelect('2', { disabled: true })
    fireEvent.click(trigger)
    expect(opened()).toBe(false)
  })

  it('className 落到触发器上，panelClassName 落到面板上（工具箱靠这两个类调尺寸）', () => {
    const { trigger } = renderSelect('2', {
      className: 'tool-select',
      panelClassName: 'tool-select-panel',
    })
    expect(trigger.className).toContain('tool-select')

    fireEvent.click(trigger)
    const panel = screen.getByRole('listbox')
    expect(panel.className).toContain('select-panel')
    expect(panel.className).toContain('tool-select-panel')
  })
})
