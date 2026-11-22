import { useMemo } from 'react'
import { useAuth } from '@/auth/AuthProvider'
import { consumableApi } from '@/api/consumables'
import type { Consumable, CreateConsumablePayload } from '@/api/consumables'
import { useResource } from '@/hooks/useResource'
import { today } from '@/utils/calendar'
import { STATUS_ORDER } from './consumableFormat'

/**
 * 消耗品看板的数据层：列表、排序、计数与四个写操作。
 * 页面只负责「什么时候调用」与展示；错误由调用处的组件接住、转成文案。
 */
const EMPTY_ITEMS: Consumable[] = []

export function useConsumables() {
  const { user } = useAuth()
  const todayKey = today()

  const query = useResource<Consumable[]>(
    async () => (await consumableApi.list(todayKey)).items,
    [user?.id],
    { enabled: user !== null },
  )
  const items = query.data ?? EMPTY_ITEMS

  const sorted = useMemo(
    () =>
      [...items].sort(
        (a, b) =>
          STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
          (a.due_on ?? '9999-99-99').localeCompare(b.due_on ?? '9999-99-99') ||
          b.created_at.localeCompare(a.created_at),
      ),
    [items],
  )

  const counts = useMemo(
    () => ({
      total: items.length,
      due: items.filter((item) => item.status === 'due' || item.status === 'idle').length,
    }),
    [items],
  )

  const create = async (payload: CreateConsumablePayload) => {
    await consumableApi.create(payload, todayKey)
    query.reload()
  }

  const finish = async (item: Consumable, startNext: boolean) => {
    try {
      const finished = await consumableApi.finish(item.id, todayKey, todayKey)
      if (startNext) {
        await consumableApi.startCycle(
          item.id,
          {
            started_on: todayKey,
            expected_days: finished.suggested_days ?? finished.last_days ?? null,
          },
          todayKey,
        )
      }
      query.reload()
    } catch (err) {
      // 「关掉这一轮」可能已经成功、只是开下一轮失败；重拉一次让卡片回到真实状态
      query.reload()
      throw err
    }
  }

  /** 补货：一键从今天开始新一轮，预计天数取上一轮实测（没有就不设） */
  const restock = async (item: Consumable) => {
    await consumableApi.startCycle(
      item.id,
      {
        started_on: todayKey,
        expected_days: item.suggested_days ?? item.last_days ?? null,
      },
      todayKey,
    )
    query.reload()
  }

  const remove = async (item: Consumable) => {
    await consumableApi.remove(item.id)
    query.reload()
  }

  return {
    todayKey,
    items,
    sorted,
    counts,
    status: query.status,
    error: query.error,
    reload: query.reload,
    create,
    finish,
    restock,
    remove,
  }
}
