import { useEffect, useState } from 'react'
import DatePicker from '@/components/DatePicker'
import { errorMessage } from '@/api/errors'
import { consumableApi } from '@/api/consumables'
import type { Consumable, ConsumableCycle } from '@/api/consumables'
import { today } from '@/utils/calendar'
import { parseConsumableNumbers, shortDay } from './consumableFormat'
import './SpaceConsumables.css'

interface Draft {
  name: string
  lead: string
  quantity: string
  unit: string
  note: string
  expected: string
  startedOn: string
}

interface EditingCycle {
  id: number
  startedOn: string
  endedOn: string
}

interface Props {
  item: Consumable
  onChanged: () => void
  onDelete: () => void
}

function draftFrom(item: Consumable, todayKey: string): Draft {
  return {
    name: item.name,
    lead: String(item.lead_days),
    quantity: item.quantity === null ? '' : String(item.quantity),
    unit: item.unit ?? '',
    note: item.note ?? '',
    expected:
      item.cycle?.expected_days === null || item.cycle?.expected_days === undefined
        ? ''
        : String(item.cycle.expected_days),
    startedOn: item.cycle?.started_on ?? todayKey,
  }
}

/** 详情面板：字段修正、本轮开始日/预计天数、周期历史；数据自己取，保存后通知外层重拉 */
export default function ConsumableDetail({ item, onChanged, onDelete }: Props) {
  const todayKey = today()
  const [draft, setDraft] = useState<Draft>(() => draftFrom(item, todayKey))
  const [history, setHistory] = useState<ConsumableCycle[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [editingCycle, setEditingCycle] = useState<EditingCycle | null>(null)
  const [cycleError, setCycleError] = useState('')

  const loadHistory = async () => {
    setHistoryLoading(true)
    try {
      setHistory((await consumableApi.cycles(item.id)).items)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setHistoryLoading(false)
    }
  }

  useEffect(() => {
    void loadHistory()
    // 只在换物品时重取；保存后的刷新由 save 自己触发
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id])

  const saveDetail = async () => {
    const name = draft.name.trim()
    if (!name) {
      setError('名字不能为空')
      return
    }
    const numbers = parseConsumableNumbers(draft)
    if ('error' in numbers) {
      setError(numbers.error)
      return
    }

    setSaving(true)
    setError('')
    try {
      await consumableApi.update(
        item.id,
        {
          name,
          lead_days: numbers.leadDays,
          quantity: numbers.quantity,
          unit: draft.unit.trim() || null,
          note: draft.note.trim() || null,
        },
        todayKey,
      )
      if (item.cycle) {
        await consumableApi.updateCycle(
          item.id,
          item.cycle.id,
          {
            started_on: draft.startedOn || item.cycle.started_on,
            expected_days: numbers.expectedDays,
          },
          todayKey,
        )
      }
      await loadHistory()
      onChanged()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const saveCycle = async () => {
    if (!editingCycle) return
    if (!editingCycle.endedOn && item.cycle && item.cycle.id !== editingCycle.id) {
      setCycleError('后面还有一轮在进行中，先把它用完再撤回这一轮')
      return
    }
    if (editingCycle.endedOn && editingCycle.endedOn < editingCycle.startedOn) {
      setCycleError('结束日不能早于开始日')
      return
    }
    setCycleError('')
    setSaving(true)
    try {
      const updated = await consumableApi.updateCycle(
        item.id,
        editingCycle.id,
        {
          started_on: editingCycle.startedOn,
          ended_on: editingCycle.endedOn || null,
        },
        todayKey,
      )
      setEditingCycle(null)
      // 改的是当前这一轮时，把上方的「本轮」同步过来；否则要重开详情才看到新开始日
      const fresh = updated.cycle
      if (fresh && item.cycle?.id === editingCycle.id) {
        setDraft((prev) => ({
          ...prev,
          startedOn: fresh.started_on,
          expected: fresh.expected_days === null ? '' : String(fresh.expected_days),
        }))
      }
      await loadHistory()
      onChanged()
    } catch (err) {
      setCycleError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-item-detail">
      <div className="space-detail-grid">
        <label className="space-field">
          名称
          <input
            className="space-field-input"
            value={draft.name}
            maxLength={40}
            aria-label="修改名称"
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          />
        </label>
        <label className="space-field">
          提前提醒
          <input
            type="number"
            inputMode="numeric"
            className="space-field-input is-narrow"
            value={draft.lead}
            aria-label="修改提前提醒"
            onChange={(event) => setDraft({ ...draft, lead: event.target.value })}
          />
          天
        </label>
        <label className="space-field">
          数量
          <input
            type="number"
            inputMode="decimal"
            className="space-field-input is-narrow"
            value={draft.quantity}
            placeholder="可选"
            aria-label="修改数量"
            onChange={(event) => setDraft({ ...draft, quantity: event.target.value })}
          />
        </label>
        <label className="space-field">
          单位
          <input
            className="space-field-input is-narrow"
            value={draft.unit}
            maxLength={8}
            aria-label="修改单位"
            onChange={(event) => setDraft({ ...draft, unit: event.target.value })}
          />
        </label>
      </div>

      {item.cycle && (
        <div className="space-detail-cycle">
          <span className="space-detail-label">本轮</span>
          <DatePicker
            value={draft.startedOn || null}
            onChange={(day) => setDraft({ ...draft, startedOn: day ?? todayKey })}
            ariaLabel="本轮开始日"
            placeholder="开始日"
            suffix="开始"
            triggerClassName="space-due-trigger"
          />
          <label className="space-field">
            预计
            <input
              type="number"
              inputMode="numeric"
              className="space-field-input is-narrow"
              value={draft.expected}
              placeholder="未设"
              aria-label="本轮预计天数"
              onChange={(event) => setDraft({ ...draft, expected: event.target.value })}
            />
            天
          </label>
        </div>
      )}

      <label className="space-field space-field-wide">
        备注
        <input
          className="space-field-input"
          value={draft.note}
          maxLength={200}
          placeholder="品牌、放哪儿，都可以"
          aria-label="备注"
          onChange={(event) => setDraft({ ...draft, note: event.target.value })}
        />
      </label>

      {error && <p className="space-error">{error}</p>}

      <div className="space-detail-actions">
        <button type="button" className="space-danger-link" onClick={onDelete}>
          删除
        </button>
        <button
          type="button"
          className="space-button space-button-primary"
          disabled={saving}
          onClick={() => void saveDetail()}
        >
          {saving ? '保存中…' : '保存修改'}
        </button>
      </div>

      <div className="space-history">
        <h4>周期历史</h4>
        {historyLoading ? (
          <p className="space-faint">读取中…</p>
        ) : history.length === 0 ? (
          <p className="space-faint">还没有完整的周期。</p>
        ) : (
          <ul>
            {history.map((cycle) => {
              const editing = editingCycle?.id === cycle.id
              return (
                <li key={cycle.id}>
                  {editing ? (
                    <div className="space-history-edit">
                      <DatePicker
                        value={editingCycle.startedOn || null}
                        onChange={(day) =>
                          setEditingCycle({
                            ...editingCycle,
                            startedOn: day ?? editingCycle.startedOn,
                          })
                        }
                        ariaLabel="修改开始日"
                        suffix="开始"
                        triggerClassName="space-due-trigger"
                      />
                      <span className="space-faint">→</span>
                      <DatePicker
                        value={editingCycle.endedOn || null}
                        onChange={(day) =>
                          setEditingCycle({
                            ...editingCycle,
                            endedOn: day ?? '',
                          })
                        }
                        ariaLabel="修改结束日"
                        placeholder="还在用"
                        suffix="用完"
                        triggerClassName="space-due-trigger"
                      />
                      <div className="space-history-actions">
                        <button
                          type="button"
                          className="space-button"
                          onClick={() => {
                            setEditingCycle(null)
                            setCycleError('')
                          }}
                        >
                          取消
                        </button>
                        <button
                          type="button"
                          className="space-button space-button-primary"
                          disabled={saving}
                          onClick={() => void saveCycle()}
                        >
                          保存
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <span className="space-history-range">
                        {shortDay(cycle.started_on)}
                        <span className="space-faint"> → </span>
                        {cycle.ended_on ? shortDay(cycle.ended_on) : '进行中'}
                      </span>
                      <span className="space-history-days">
                        {cycle.actual_days !== null ? `${cycle.actual_days} 天` : '—'}
                      </span>
                      <button
                        type="button"
                        className="space-item-detail-toggle"
                        onClick={() => {
                          setCycleError('')
                          setEditingCycle({
                            id: cycle.id,
                            startedOn: cycle.started_on,
                            endedOn: cycle.ended_on ?? '',
                          })
                        }}
                      >
                        改
                      </button>
                    </>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        {cycleError && <p className="space-error">{cycleError}</p>}
      </div>
    </div>
  )
}
