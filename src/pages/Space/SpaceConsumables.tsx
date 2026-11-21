import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import DatePicker from '@/components/DatePicker'
import { useConfirm } from '@/components/ConfirmDialog/useConfirm'
import { errorMessage } from '@/api/errors'
import { consumableApi } from '@/api/consumables'
import type {
  Consumable,
  ConsumableCategory,
  ConsumableCycle,
  ConsumableStatus,
} from '@/api/consumables'
import { useAuth } from '@/auth/AuthProvider'
import { useResource } from '@/hooks/useResource'
import { parseDay, today } from '@/utils/calendar'

/** 类别只决定图标和分组，不参与计算 */
const CATEGORIES: { key: ConsumableCategory; label: string; icon: string }[] = [
  { key: 'paper', label: '纸品', icon: '🧻' },
  { key: 'clean', label: '清洁', icon: '🧴' },
  { key: 'food', label: '食品', icon: '🥫' },
  { key: 'pet', label: '宠物', icon: '🐾' },
  { key: 'other', label: '其他', icon: '📦' },
]

const STATUS_TEXT: Record<ConsumableStatus, string> = {
  due: '该买了',
  soon: '快用完',
  idle: '待补货',
  unknown: '估不准',
  ok: '正常',
}

/** 排序：能买的排前面；估不准的还没进入节奏，沉到正常项后面 */
const STATUS_ORDER: Record<ConsumableStatus, number> = {
  due: 0,
  idle: 1,
  soon: 2,
  ok: 3,
  unknown: 4,
}

/** '2026-12-03' → '12 月 3 日' */
function monthDay(day: string): string {
  const date = parseDay(day)
  return `${date.getMonth() + 1} 月 ${date.getDate()} 日`
}

/** '2026-10-08' → '10/08'，周期历史用短格式 */
function shortDay(day: string): string {
  return day.slice(5).replace('-', '/')
}

function categoryMeta(key: ConsumableCategory) {
  return CATEGORIES.find((item) => item.key === key) ?? CATEGORIES[CATEGORIES.length - 1]
}

/** 数量 + 单位只是辅助信息：没填数量就不显示，单留个单位没有意义 */
function amountLabel(item: Consumable): string {
  if (item.quantity === null) return ''
  const value = Number.isInteger(item.quantity) ? String(item.quantity) : item.quantity.toFixed(1)
  return `${value}${item.unit ? ` ${item.unit}` : ''}`
}

/** 「11 月 28 日见底」/「今天见底」/「已超 3 天」——过期后不再说未来日期 */
function dueLabel(item: Consumable): string | null {
  if (!item.due_on) return null
  const left = item.days_left ?? 0
  if (left < 0) return `已超 ${-left} 天`
  if (left === 0) return '今天见底'
  return `${monthDay(item.due_on)}见底`
}

interface Draft {
  name: string
  category: ConsumableCategory
  expected: string
  lead: string
  quantity: string
  unit: string
}

const EMPTY_DRAFT: Draft = {
  name: '',
  category: 'other',
  expected: '',
  lead: '7',
  quantity: '',
  unit: '',
}

export default function SpaceConsumables() {
  const { user } = useAuth()
  const { confirm, dialog } = useConfirm()
  const todayKey = today()

  const query = useResource<Consumable[]>(
    async () => (await consumableApi.list(todayKey)).items,
    [user?.id],
    { enabled: user !== null },
  )
  const items = query.data ?? []

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

  // ---- 新建 ----------------------------------------------------------------
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  const [creating, setCreating] = useState(false)
  const [formError, setFormError] = useState('')

  const resetForm = () => {
    setDraft(EMPTY_DRAFT)
    setFormError('')
  }

  const submitCreate = async (event?: FormEvent) => {
    event?.preventDefault()
    const name = draft.name.trim()
    if (!name) {
      setFormError('先起个名字')
      return
    }
    const expected = draft.expected.trim() ? Number(draft.expected) : null
    if (expected !== null && (!Number.isFinite(expected) || expected < 1 || expected > 3650)) {
      setFormError('预计天数填 1–3650 之间')
      return
    }
    const lead = draft.lead.trim() ? Number(draft.lead) : 7
    if (!Number.isFinite(lead) || lead < 0 || lead > 60) {
      setFormError('提前提醒填 0–60 天')
      return
    }
    const quantity = draft.quantity.trim() ? Number(draft.quantity) : null
    if (quantity !== null && (!Number.isFinite(quantity) || quantity < 0)) {
      setFormError('数量不能是负数')
      return
    }

    setCreating(true)
    setFormError('')
    try {
      await consumableApi.create(
        {
          name,
          category: draft.category,
          unit: draft.unit.trim() || null,
          quantity,
          lead_days: lead,
          started_on: todayKey,
          expected_days: expected,
        },
        todayKey,
      )
      resetForm()
      setAdding(false)
      query.reload()
    } catch (err) {
      setFormError(errorMessage(err))
    } finally {
      setCreating(false)
    }
  }

  // ---- 用完 / 补货 ---------------------------------------------------------
  const [busyId, setBusyId] = useState<number | null>(null)
  const [finishingId, setFinishingId] = useState<number | null>(null)
  const [actionError, setActionError] = useState('')

  const finish = async (item: Consumable, startNext: boolean) => {
    setBusyId(item.id)
    setActionError('')
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
      setFinishingId(null)
      query.reload()
    } catch (err) {
      // 「关掉这一轮」可能已经成功、只是开下一轮失败；重拉一次让卡片回到真实状态
      setActionError(errorMessage(err))
      query.reload()
    } finally {
      // 换轮后详情里的「本轮开始/预计」已经过期，继续开着容易被误存回新一轮
      if (detailId === item.id) setDetailId(null)
      setBusyId(null)
    }
  }

  /** 补货：一键从今天开始新一轮，预计天数取上一轮实测（没有就不设） */
  const restock = async (item: Consumable) => {
    setBusyId(item.id)
    setActionError('')
    try {
      await consumableApi.startCycle(
        item.id,
        {
          started_on: todayKey,
          expected_days: item.suggested_days ?? item.last_days ?? null,
        },
        todayKey,
      )
      query.reload()
    } catch (err) {
      setActionError(errorMessage(err))
    } finally {
      if (detailId === item.id) setDetailId(null)
      setBusyId(null)
    }
  }

  // ---- 详情与修正 ----------------------------------------------------------
  const [detailId, setDetailId] = useState<number | null>(null)
  const [history, setHistory] = useState<ConsumableCycle[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [detailDraft, setDetailDraft] = useState({
    name: '',
    lead: '7',
    quantity: '',
    unit: '',
    note: '',
    expected: '',
    startedOn: '',
  })
  const [detailSaving, setDetailSaving] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [editingCycle, setEditingCycle] = useState<{
    id: number
    startedOn: string
    endedOn: string
  } | null>(null)
  const [cycleError, setCycleError] = useState('')

  const loadHistory = async (itemId: number) => {
    setHistoryLoading(true)
    try {
      setHistory((await consumableApi.cycles(itemId)).items)
    } catch (err) {
      setDetailError(errorMessage(err))
    } finally {
      setHistoryLoading(false)
    }
  }

  const toggleDetail = (item: Consumable) => {
    if (detailId === item.id) {
      setDetailId(null)
      return
    }
    setDetailId(item.id)
    setDetailError('')
    setCycleError('')
    setEditingCycle(null)
    setDetailDraft({
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
    })
    void loadHistory(item.id)
  }

  const saveDetail = async (item: Consumable) => {
    const name = detailDraft.name.trim()
    if (!name) {
      setDetailError('名字不能为空')
      return
    }
    const lead = detailDraft.lead.trim() ? Number(detailDraft.lead) : 7
    if (!Number.isFinite(lead) || lead < 0 || lead > 60) {
      setDetailError('提前提醒填 0–60 天')
      return
    }
    const quantity = detailDraft.quantity.trim() ? Number(detailDraft.quantity) : null
    if (quantity !== null && (!Number.isFinite(quantity) || quantity < 0)) {
      setDetailError('数量不能是负数')
      return
    }
    const expected = detailDraft.expected.trim() ? Number(detailDraft.expected) : null
    if (expected !== null && (!Number.isFinite(expected) || expected < 1 || expected > 3650)) {
      setDetailError('预计天数填 1–3650 之间')
      return
    }

    setDetailSaving(true)
    setDetailError('')
    try {
      await consumableApi.update(
        item.id,
        {
          name,
          lead_days: lead,
          quantity,
          unit: detailDraft.unit.trim() || null,
          note: detailDraft.note.trim() || null,
        },
        todayKey,
      )
      if (item.cycle) {
        await consumableApi.updateCycle(
          item.id,
          item.cycle.id,
          {
            started_on: detailDraft.startedOn || item.cycle.started_on,
            expected_days: expected,
          },
          todayKey,
        )
      }
      await loadHistory(item.id)
      query.reload()
    } catch (err) {
      setDetailError(errorMessage(err))
    } finally {
      setDetailSaving(false)
    }
  }

  const saveCycle = async (item: Consumable) => {
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
    setDetailSaving(true)
    try {
      await consumableApi.updateCycle(
        item.id,
        editingCycle.id,
        {
          started_on: editingCycle.startedOn,
          ended_on: editingCycle.endedOn || null,
        },
        todayKey,
      )
      setEditingCycle(null)
      await loadHistory(item.id)
      query.reload()
    } catch (err) {
      setCycleError(errorMessage(err))
    } finally {
      setDetailSaving(false)
    }
  }

  const removeItem = (item: Consumable) => {
    confirm({
      title: `删除「${item.name}」？`,
      description: '周期历史会一起消失，之后重新记就是新物品了。',
      confirmText: '删除',
      tone: 'danger',
      onConfirm: async () => {
        await consumableApi.remove(item.id)
        query.reload()
      },
    })
  }

  // ---- 渲染 ----------------------------------------------------------------
  if (query.status === 'error' && items.length === 0) {
    return (
      <div className="space-state space-state-error">
        <p>{query.error}</p>
        <button type="button" className="space-button" onClick={query.reload}>
          重试
        </button>
      </div>
    )
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
          onClick={() => {
            setAdding((open) => !open)
            setFormError('')
          }}
          aria-expanded={adding}
        >
          {adding ? '收起' : '＋ 加一件'}
        </button>
      </div>

      {!adding && items.length === 0 && query.status === 'ready' && (
        <div className="space-state space-empty-consumables">
          <p>把纸巾、洗衣液、垃圾袋记进来。</p>
          <p className="space-faint">
            平时不用记，快用完点一次「用完了」，下一轮的时间就会自动估出来。
          </p>
        </div>
      )}

      {adding && (
        <form className="space-item-form" onSubmit={submitCreate} noValidate>
          <div className="space-item-form-head">
            <input
              className="space-item-name-input"
              value={draft.name}
              maxLength={40}
              autoFocus
              placeholder="名称，比如「厨房纸巾」"
              aria-label="消耗品名称"
              onChange={(event) => {
                setDraft({ ...draft, name: event.target.value })
                setFormError('')
              }}
            />
          </div>

          <div className="space-cat-row" role="group" aria-label="类别">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                type="button"
                className="space-cat"
                aria-pressed={draft.category === cat.key}
                onClick={() => setDraft({ ...draft, category: cat.key })}
              >
                <span aria-hidden="true">{cat.icon}</span>
                {cat.label}
              </button>
            ))}
          </div>

          <div className="space-field-row">
            <label className="space-field">
              大概能用
              <input
                type="number"
                inputMode="numeric"
                className="space-field-input"
                value={draft.expected}
                placeholder="可不填"
                aria-label="预计天数"
                onChange={(event) => {
                  setDraft({ ...draft, expected: event.target.value })
                  setFormError('')
                }}
              />
              天
            </label>
            <label className="space-field">
              提前
              <input
                type="number"
                inputMode="numeric"
                className="space-field-input"
                value={draft.lead}
                aria-label="提前提醒天数"
                onChange={(event) => {
                  setDraft({ ...draft, lead: event.target.value })
                  setFormError('')
                }}
              />
              天提醒
            </label>
          </div>

          <div className="space-field-row">
            <label className="space-field">
              数量
              <input
                type="number"
                inputMode="decimal"
                className="space-field-input is-narrow"
                value={draft.quantity}
                placeholder="可选"
                aria-label="数量"
                onChange={(event) => {
                  setDraft({ ...draft, quantity: event.target.value })
                  setFormError('')
                }}
              />
            </label>
            <label className="space-field">
              单位
              <input
                className="space-field-input is-narrow"
                value={draft.unit}
                maxLength={8}
                placeholder="包/卷/只"
                aria-label="单位"
                onChange={(event) => setDraft({ ...draft, unit: event.target.value })}
              />
            </label>
            <span className="space-field-note">只是备注，不参与计算</span>
          </div>

          {formError && <p className="space-error">{formError}</p>}

          <div className="space-item-form-actions">
            <button
              type="button"
              className="space-button"
              onClick={() => {
                setAdding(false)
                resetForm()
              }}
            >
              取消
            </button>
            <button
              type="submit"
              className="space-button space-button-primary"
              disabled={creating || draft.name.trim().length === 0}
            >
              {creating ? '添加中…' : '添加'}
            </button>
          </div>
        </form>
      )}

      {actionError && (
        <p className="space-error space-action-error" role="alert">
          {actionError}
        </p>
      )}

      {sorted.length > 0 && (
        <div className="space-item-list">
          {sorted.map((item) => {
            const meta = categoryMeta(item.category)
            const showsDetail = detailId === item.id
            const isFinishing = finishingId === item.id
            const busy = busyId === item.id
            return (
              <article key={item.id} className={`space-item is-${item.status}`}>
                <div className="space-item-head">
                  <span className="space-item-icon" aria-hidden="true">
                    {meta.icon}
                  </span>
                  <div className="space-item-titles">
                    <h3>{item.name}</h3>
                    {amountLabel(item) ? (
                      <p className="space-item-sub">{amountLabel(item)}</p>
                    ) : null}
                  </div>
                  <span className="space-state-pill">{STATUS_TEXT[item.status]}</span>
                </div>

                {item.cycle ? (
                  <>
                    <div className="space-item-meter" aria-hidden="true">
                      <span
                        style={{ width: `${Math.round((item.progress ?? 0) * 100)}%` }}
                      />
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

                {!isFinishing && (
                  <div className="space-item-actions">
                    {item.cycle ? (
                      <button
                        type="button"
                        className="space-button space-button-primary space-item-finish"
                        disabled={busy}
                        onClick={() => {
                          setFinishingId(item.id)
                          setActionError('')
                        }}
                      >
                        用完了
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="space-button space-button-primary"
                        disabled={busy}
                        onClick={() => void restock(item)}
                      >
                        {busy ? '补货中…' : '补货'}
                      </button>
                    )}
                    <button
                      type="button"
                      className="space-item-detail-toggle"
                      aria-expanded={showsDetail}
                      onClick={() => toggleDetail(item)}
                    >
                      {showsDetail ? '收起' : '详情'}
                    </button>
                  </div>
                )}

                {isFinishing && (
                  <div className="space-finish">
                    <p>
                      这一轮用了 <b>{item.days_used ?? 0}</b> 天
                      {item.cycle?.expected_days
                        ? `（预计 ${item.cycle.expected_days} 天）`
                        : ''}
                      。下一轮也从今天开始吗？
                    </p>
                    <div className="space-finish-actions">
                      <button
                        type="button"
                        className="space-button"
                        disabled={busy}
                        onClick={() => setFinishingId(null)}
                      >
                        取消
                      </button>
                      <button
                        type="button"
                        className="space-button"
                        disabled={busy}
                        onClick={() => void finish(item, false)}
                      >
                        先不买
                      </button>
                      <button
                        type="button"
                        className="space-button space-button-primary"
                        disabled={busy}
                        onClick={() => void finish(item, true)}
                      >
                        {busy ? '处理中…' : '继续记'}
                      </button>
                    </div>
                  </div>
                )}

                {showsDetail && (
                  <div className="space-item-detail">
                    <div className="space-detail-grid">
                      <label className="space-field">
                        名称
                        <input
                          className="space-field-input"
                          value={detailDraft.name}
                          maxLength={40}
                          aria-label="修改名称"
                          onChange={(event) =>
                            setDetailDraft({ ...detailDraft, name: event.target.value })
                          }
                        />
                      </label>
                      <label className="space-field">
                        提前提醒
                        <input
                          type="number"
                          inputMode="numeric"
                          className="space-field-input is-narrow"
                          value={detailDraft.lead}
                          aria-label="修改提前提醒"
                          onChange={(event) =>
                            setDetailDraft({ ...detailDraft, lead: event.target.value })
                          }
                        />
                        天
                      </label>
                      <label className="space-field">
                        数量
                        <input
                          type="number"
                          inputMode="decimal"
                          className="space-field-input is-narrow"
                          value={detailDraft.quantity}
                          placeholder="可选"
                          aria-label="修改数量"
                          onChange={(event) =>
                            setDetailDraft({ ...detailDraft, quantity: event.target.value })
                          }
                        />
                      </label>
                      <label className="space-field">
                        单位
                        <input
                          className="space-field-input is-narrow"
                          value={detailDraft.unit}
                          maxLength={8}
                          aria-label="修改单位"
                          onChange={(event) =>
                            setDetailDraft({ ...detailDraft, unit: event.target.value })
                          }
                        />
                      </label>
                    </div>

                    {item.cycle && (
                      <div className="space-detail-cycle">
                        <span className="space-detail-label">本轮</span>
                        <DatePicker
                          value={detailDraft.startedOn || null}
                          onChange={(day) =>
                            setDetailDraft({ ...detailDraft, startedOn: day ?? todayKey })
                          }
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
                            value={detailDraft.expected}
                            placeholder="未设"
                            aria-label="本轮预计天数"
                            onChange={(event) =>
                              setDetailDraft({ ...detailDraft, expected: event.target.value })
                            }
                          />
                          天
                        </label>
                      </div>
                    )}

                    <label className="space-field space-field-wide">
                      备注
                      <input
                        className="space-field-input"
                        value={detailDraft.note}
                        maxLength={200}
                        placeholder="品牌、放哪儿，都可以"
                        aria-label="备注"
                        onChange={(event) =>
                          setDetailDraft({ ...detailDraft, note: event.target.value })
                        }
                      />
                    </label>

                    {detailError && <p className="space-error">{detailError}</p>}

                    <div className="space-detail-actions">
                      <button
                        type="button"
                        className="space-danger-link"
                        onClick={() => removeItem(item)}
                      >
                        删除
                      </button>
                      <button
                        type="button"
                        className="space-button space-button-primary"
                        disabled={detailSaving}
                        onClick={() => void saveDetail(item)}
                      >
                        {detailSaving ? '保存中…' : '保存修改'}
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
                                        disabled={detailSaving}
                                        onClick={() => void saveCycle(item)}
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
                )}
              </article>
            )
          })}
        </div>
      )}

      {dialog}
    </section>
  )
}
