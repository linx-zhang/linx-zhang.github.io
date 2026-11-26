import { useState } from 'react'
import type { MouseEvent } from 'react'
import { errorMessage } from '@/api/errors'
import type { Consumable } from '@/api/consumables'
import ConsumableDetail from './ConsumableDetail'
import { amountLabel, categoryMeta, dueLabel, STATUS_TEXT } from './consumableFormat'
import './SpaceConsumables.css'

interface Props {
  item: Consumable
  expanded: boolean
  onToggleDetail: () => void
  onFinish: (item: Consumable, startNext: boolean) => Promise<void>
  onRestock: (item: Consumable) => Promise<void>
  onChanged: () => void
  onDelete: (item: Consumable) => void
}

/** 一张消耗品卡片：状态、进度与「用完了 / 补货」；详情展开时挂自己的表单 */
export default function ConsumableCard({
  item,
  expanded,
  onToggleDetail,
  onFinish,
  onRestock,
  onChanged,
  onDelete,
}: Props) {
  const [finishing, setFinishing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const meta = categoryMeta(item.category)

  /** 点卡片空白处进入详情；卡片里的按钮、展开后的表单保持各自行为 */
  const handleCardClick = (event: MouseEvent<HTMLElement>) => {
    if (finishing) return
    const target = event.target as HTMLElement
    if (target.closest('button, input, textarea, select, a, .space-item-detail')) return
    onToggleDetail()
  }

  const run = async (action: () => Promise<void>) => {
    setBusy(true)
    setError('')
    try {
      await action()
      setFinishing(false)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <article
      className={`space-item is-${item.status}${expanded ? ' is-open' : ''}`}
      onClick={handleCardClick}
    >
      <div className="space-item-head">
        <span className="space-item-icon" aria-hidden="true">
          {meta.icon}
        </span>
        <div className="space-item-titles">
          <h3>{item.name}</h3>
          {amountLabel(item) ? <p className="space-item-sub">{amountLabel(item)}</p> : null}
        </div>
        <span className="space-state-pill">{STATUS_TEXT[item.status]}</span>
      </div>

      {item.cycle ? (
        <>
          <div className="space-item-meter" aria-hidden="true">
            <span style={{ width: `${Math.round((item.progress ?? 0) * 100)}%` }} />
          </div>
          <p className="space-item-fact">
            {item.cycle.expected_days ? (
              <>
                已用 {item.days_used ?? 0} 天 · 预计 {item.cycle.expected_days} 天
                {dueLabel(item) ? <> · {dueLabel(item)}</> : null}
              </>
            ) : (
              <>已用 {item.days_used ?? 0} 天 · 还没估过，用完这轮就能自动算</>
            )}
          </p>
        </>
      ) : (
        <p className="space-item-fact">
          {item.last_days
            ? `上一轮 ${item.last_days} 天用完 · 还没开新一轮`
            : '还没记过完整一轮 · 买了就开始计时'}
        </p>
      )}

      {!finishing && (
        <div className="space-item-actions">
          {item.cycle ? (
            <button
              type="button"
              className="space-button space-button-primary space-item-finish"
              disabled={busy}
              onClick={() => {
                setFinishing(true)
                setError('')
              }}
            >
              用完了
            </button>
          ) : (
            <button
              type="button"
              className="space-button space-button-primary"
              disabled={busy}
              onClick={() => void run(() => onRestock(item))}
            >
              {busy ? '补货中…' : '补货'}
            </button>
          )}
          <button
            type="button"
            className="space-item-detail-toggle"
            aria-expanded={expanded}
            onClick={onToggleDetail}
          >
            {expanded ? '收起' : '详情'}
          </button>
        </div>
      )}

      {finishing && (
        <div className="space-finish">
          <p>
            这一轮用了 <b>{item.days_used ?? 0}</b> 天
            {item.cycle?.expected_days ? `（预计 ${item.cycle.expected_days} 天）` : ''}
            。下一轮也从今天开始吗？
          </p>
          <div className="space-finish-actions">
            <button
              type="button"
              className="space-button"
              disabled={busy}
              onClick={() => setFinishing(false)}
            >
              取消
            </button>
            <button
              type="button"
              className="space-button"
              disabled={busy}
              onClick={() => void run(() => onFinish(item, false))}
            >
              先不买
            </button>
            <button
              type="button"
              className="space-button space-button-primary"
              disabled={busy}
              onClick={() => void run(() => onFinish(item, true))}
            >
              {busy ? '处理中…' : '继续记'}
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="space-error space-action-error" role="alert">
          {error}
        </p>
      )}

      {expanded && (
        <ConsumableDetail item={item} onChanged={onChanged} onDelete={() => onDelete(item)} />
      )}
    </article>
  )
}
