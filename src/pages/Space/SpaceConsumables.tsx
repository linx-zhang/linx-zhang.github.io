import { useState } from 'react'
import { useConfirm } from '@/components/ConfirmDialog/useConfirm'
import type { Consumable } from '@/api/consumables'
import ConsumableCard from './ConsumableCard'
import ConsumableForm from './ConsumableForm'
import { useConsumables } from './useConsumables'
import './SpaceConsumables.css'

/**
 * 消耗品看板：只负责取数调用、展开哪张卡片、加一件的开关。
 * 新建表单、单卡交互、详情与周期历史分别在同目录组件里，样式仍共用
 * `SpaceConsumables.css`。
 */
export default function SpaceConsumables() {
  const { confirm, dialog } = useConfirm()
  const {
    todayKey,
    items,
    sorted,
    counts,
    status,
    error,
    reload,
    create,
    finish,
    restock,
    remove,
  } = useConsumables()

  const [adding, setAdding] = useState(false)
  const [detailId, setDetailId] = useState<number | null>(null)

  if (status === 'error' && items.length === 0) {
    return (
      <div className="space-state space-state-error">
        <p>{error}</p>
        <button type="button" className="space-button" onClick={reload}>
          重试
        </button>
      </div>
    )
  }

  const handleFinish = async (item: Consumable, startNext: boolean) => {
    try {
      await finish(item, startNext)
    } finally {
      // 换轮后详情里的「本轮开始/预计」已经过期，继续开着容易被误存回新一轮
      if (detailId === item.id) setDetailId(null)
    }
  }

  const handleRestock = async (item: Consumable) => {
    try {
      await restock(item)
    } finally {
      if (detailId === item.id) setDetailId(null)
    }
  }

  const handleDelete = (item: Consumable) => {
    confirm({
      title: `删除「${item.name}」？`,
      description: '周期历史会一起消失，之后重新记就是新物品了。',
      confirmText: '删除',
      tone: 'danger',
      onConfirm: async () => {
        await remove(item)
        setDetailId((id) => (id === item.id ? null : id))
      },
    })
  }

  return (
    <section className="space-consumables">
      <div className="space-consumables-bar">
        <p className="space-consumables-count">
          {counts.total > 0 ? (
            <>
              {counts.total} 件{counts.due > 0 ? <em> · {counts.due} 件该补了</em> : null}
            </>
          ) : (
            '还没有记录'
          )}
        </p>
        <button
          type="button"
          className="space-button space-add-item"
          onClick={() => setAdding((open) => !open)}
          aria-expanded={adding}
        >
          {adding ? '收起' : '＋ 加一件'}
        </button>
      </div>

      {!adding && items.length === 0 && status === 'ready' && (
        <div className="space-state space-empty-consumables">
          <p>把纸巾、洗衣液、垃圾袋记进来。</p>
          <p className="space-faint">
            平时不用记，快用完点一次「用完了」，下一轮的时间就会自动估出来。
          </p>
        </div>
      )}

      {adding && (
        <ConsumableForm
          todayKey={todayKey}
          onCreate={create}
          onCancel={() => setAdding(false)}
        />
      )}

      {sorted.length > 0 && (
        <div className="space-item-list">
          {sorted.map((item) => (
            <ConsumableCard
              key={item.id}
              item={item}
              expanded={detailId === item.id}
              onToggleDetail={() => setDetailId((id) => (id === item.id ? null : item.id))}
              onFinish={handleFinish}
              onRestock={handleRestock}
              onChanged={reload}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {dialog}
    </section>
  )
}
