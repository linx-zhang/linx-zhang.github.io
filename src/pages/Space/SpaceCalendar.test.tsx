import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import SpaceCalendar from './SpaceCalendar'

const baseProps = {
  memos: [],
  status: 'ready' as const,
  error: '',
  onRetry: () => {},
  onToggleDone: () => {},
}

function setup(onCreate = vi.fn().mockResolvedValue(undefined)) {
  render(<SpaceCalendar {...baseProps} initialDay="2026-11-25" onCreate={onCreate} />)
  return onCreate
}

describe('SpaceCalendar 新增', () => {
  it('把内容加到当前选中的那一天', async () => {
    const onCreate = setup()
    fireEvent.click(screen.getByRole('button', { name: /记一条/ }))
    const textarea = screen.getByLabelText(/到期的新条目/) as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: '交周报' } })
    fireEvent.keyDown(textarea, { key: 'Enter' })

    await waitFor(() => expect(onCreate).toHaveBeenCalledWith('交周报', '2026-11-25'))
    // 成功后清空但保持展开，方便连续录入
    await waitFor(() => expect(textarea.value).toBe(''))
    expect(screen.getByRole('button', { name: '添加' })).toBeTruthy()
  })

  it('换一天再提交，到期日跟着选中的格子走', async () => {
    const onCreate = setup()
    fireEvent.click(screen.getByLabelText(/^11 月 28 日/))
    fireEvent.click(screen.getByRole('button', { name: /记一条/ }))
    const textarea = screen.getByLabelText(/到期的新条目/)
    fireEvent.change(textarea, { target: { value: '还书' } })
    fireEvent.click(screen.getByRole('button', { name: '添加' }))

    await waitFor(() => expect(onCreate).toHaveBeenCalledWith('还书', '2026-11-28'))
  })

  it('输入区展开时换一天，草稿清掉、到期日跟着新格子', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: /记一条/ }))
    const textarea = screen.getByLabelText(/到期的新条目/) as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: '写了一半' } })

    fireEvent.click(screen.getByLabelText(/^11 月 28 日/))
    const next = screen.getByLabelText(/到期的新条目/) as HTMLTextAreaElement
    expect(next.value).toBe('')
    expect(screen.getByRole('heading', { name: /11 月 28 日/ })).toBeTruthy()
  })

  it('输入法选词时的回车不提交', () => {
    const onCreate = setup()
    fireEvent.click(screen.getByRole('button', { name: /记一条/ }))
    const textarea = screen.getByLabelText(/到期的新条目/)
    fireEvent.change(textarea, { target: { value: '拼' } })
    fireEvent.keyDown(textarea, { key: 'Enter', isComposing: true })
    expect(onCreate).not.toHaveBeenCalled()
  })

  it('失败时就地显示错误且保留草稿', async () => {
    setup(vi.fn().mockRejectedValue(new Error('网络开小差')))
    fireEvent.click(screen.getByRole('button', { name: /记一条/ }))
    const textarea = screen.getByLabelText(/到期的新条目/) as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: '交周报' } })
    fireEvent.keyDown(textarea, { key: 'Enter' })

    await waitFor(() => expect(screen.getByText('请求失败，请稍后重试。')).toBeTruthy())
    expect((screen.getByLabelText(/到期的新条目/) as HTMLTextAreaElement).value).toBe('交周报')
  })

  it('选完一天把当天面板滚进视口', async () => {
    const scrollIntoView = vi.fn()
    const original = Element.prototype.scrollIntoView
    Element.prototype.scrollIntoView = scrollIntoView
    try {
      setup()
      fireEvent.click(screen.getByLabelText(/^11 月 28 日/))
      await waitFor(() => expect(scrollIntoView).toHaveBeenCalled())
    } finally {
      Element.prototype.scrollIntoView = original
    }
  })

  it('Esc 收起输入区并清掉草稿', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: /记一条/ }))
    const textarea = screen.getByLabelText(/到期的新条目/)
    fireEvent.change(textarea, { target: { value: '先不写了' } })
    fireEvent.keyDown(textarea, { key: 'Escape' })

    expect(screen.queryByLabelText(/到期的新条目/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /记一条/ }))
    expect((screen.getByLabelText(/到期的新条目/) as HTMLTextAreaElement).value).toBe('')
  })
})
