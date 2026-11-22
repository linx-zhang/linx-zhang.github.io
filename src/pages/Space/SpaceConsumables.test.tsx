import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Consumable } from '@/api/consumables'
import { today } from '@/utils/calendar'

const api = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  finish: vi.fn(),
  startCycle: vi.fn(),
  update: vi.fn(),
  updateCycle: vi.fn(),
  cycles: vi.fn(),
  remove: vi.fn(),
}))

vi.mock('@/api/consumables', () => ({ consumableApi: api }))
vi.mock('@/auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: 1 } }) }))
vi.mock('@/components/ConfirmDialog/useConfirm', () => ({
  useConfirm: () => ({ confirm: vi.fn(), dialog: null }),
}))

import SpaceConsumables from './SpaceConsumables'

function item(overrides: Partial<Consumable>): Consumable {
  return {
    id: 1,
    name: '厨房纸巾',
    category: 'paper',
    unit: '包',
    quantity: 30,
    lead_days: 7,
    note: null,
    created_at: '2026-10-01 10:00:00',
    updated_at: '2026-10-01 10:00:00',
    cycle: {
      id: 11,
      started_on: '2026-10-01',
      ended_on: null,
      expected_days: 150,
      note: null,
      created_at: '2026-10-01 10:00:00',
      updated_at: '2026-10-01 10:00:00',
      actual_days: null,
    },
    days_used: 51,
    days_left: 99,
    due_on: '2027-02-28',
    progress: 0.34,
    status: 'ok',
    last_days: null,
    suggested_days: null,
    ...overrides,
  }
}

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset())
  api.list.mockResolvedValue({ items: [] })
})

describe('SpaceConsumables', () => {
  it('把该买的排在最前，并显示状态与剩余天数', async () => {
    api.list.mockResolvedValue({
      items: [
        item({ id: 1, name: '洗衣液', status: 'ok', days_left: 40 }),
        item({ id: 2, name: '垃圾袋', status: 'due', days_left: 2 }),
      ],
    })
    render(<SpaceConsumables />)

    await screen.findByText('垃圾袋')
    const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    expect(headings).toEqual(['垃圾袋', '洗衣液'])
    expect(screen.getByText('该买了')).toBeTruthy()
  })

  it('加一件时把预计天数与本地今天一起提交', async () => {
    render(<SpaceConsumables />)
    fireEvent.click(screen.getByRole('button', { name: /加一件/ }))

    fireEvent.change(screen.getByLabelText('消耗品名称'), { target: { value: '厨房纸巾' } })
    fireEvent.change(screen.getByLabelText('预计天数'), { target: { value: '30' } })
    fireEvent.click(screen.getByRole('button', { name: '添加' }))

    await waitFor(() =>
      expect(api.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: '厨房纸巾',
          expected_days: 30,
          started_on: today(),
        }),
        today(),
      ),
    )
  })

  it('用完后选「继续记」会把上一轮的实测天数带给下一轮', async () => {
    api.list.mockResolvedValue({ items: [item({})] })
    api.finish.mockResolvedValue(
      item({ cycle: null, status: 'idle', last_days: 55, suggested_days: 55 }),
    )
    render(<SpaceConsumables />)

    fireEvent.click(await screen.findByRole('button', { name: '用完了' }))
    expect(screen.getByText(/这一轮用了/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '继续记' }))

    await waitFor(() =>
      expect(api.startCycle).toHaveBeenCalledWith(
        1,
        { started_on: today(), expected_days: 55 },
        today(),
      ),
    )
  })

  it('选「先不买」只关掉当前周期，不开下一轮', async () => {
    api.list.mockResolvedValue({ items: [item({})] })
    api.finish.mockResolvedValue(item({ cycle: null, status: 'idle' }))
    render(<SpaceConsumables />)

    fireEvent.click(await screen.findByRole('button', { name: '用完了' }))
    fireEvent.click(screen.getByRole('button', { name: '先不买' }))

    await waitFor(() => expect(api.finish).toHaveBeenCalled())
    expect(api.startCycle).not.toHaveBeenCalled()
  })

  it('估不准的条目不抢在正常项前面', async () => {
    api.list.mockResolvedValue({
      items: [
        item({
          id: 1,
          name: '咖啡豆',
          status: 'unknown',
          days_left: null,
          due_on: null,
          cycle: { ...item({}).cycle!, expected_days: null },
        }),
        item({ id: 2, name: '洗衣液', status: 'ok' }),
      ],
    })
    render(<SpaceConsumables />)

    await screen.findByText('咖啡豆')
    const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    expect(headings).toEqual(['洗衣液', '咖啡豆'])
  })

  it('过期后显示已超几天，而不是继续指向未来的见底日', async () => {
    api.list.mockResolvedValue({
      items: [
        item({
          status: 'due',
          days_used: 63,
          days_left: -3,
          due_on: '2026-11-18',
          cycle: { ...item({}).cycle!, expected_days: 60 },
        }),
      ],
    })
    render(<SpaceConsumables />)

    expect(await screen.findByText(/已超 3 天/)).toBeTruthy()
  })

  it('换轮后把打开着的详情收起，避免旧日期被存回新一轮', async () => {
    api.list.mockResolvedValue({ items: [item({})] })
    api.finish.mockResolvedValue(item({ cycle: null, status: 'idle', last_days: 51 }))
    api.startCycle.mockResolvedValue(item({}))
    render(<SpaceConsumables />)

    fireEvent.click(await screen.findByRole('button', { name: '详情' }))
    expect(screen.getByText('周期历史')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '用完了' }))
    fireEvent.click(screen.getByRole('button', { name: '继续记' }))

    await waitFor(() => expect(api.startCycle).toHaveBeenCalled())
    expect(screen.queryByText('周期历史')).toBeNull()
  })

  it('待补货的条目一键补货，预计天数沿用上一轮', async () => {
    api.list.mockResolvedValue({
      items: [item({ cycle: null, status: 'idle', last_days: 62, suggested_days: 62 })],
    })
    render(<SpaceConsumables />)

    fireEvent.click(await screen.findByRole('button', { name: '补货' }))
    await waitFor(() =>
      expect(api.startCycle).toHaveBeenCalledWith(
        1,
        { started_on: today(), expected_days: 62 },
        today(),
      ),
    )
  })

  it('上一轮实测为 0 天时，补货不带非法的 expected_days', async () => {
    api.list.mockResolvedValue({
      items: [item({ cycle: null, status: 'idle', last_days: 0, suggested_days: 0 })],
    })
    api.startCycle.mockResolvedValue(item({}))
    render(<SpaceConsumables />)

    fireEvent.click(await screen.findByRole('button', { name: '补货' }))
    await waitFor(() =>
      expect(api.startCycle).toHaveBeenCalledWith(
        1,
        { started_on: today(), expected_days: null },
        today(),
      ),
    )
  })
})
