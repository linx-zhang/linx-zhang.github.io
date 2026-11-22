import { useState } from 'react'
import type { FormEvent } from 'react'
import { errorMessage } from '@/api/errors'
import type { CreateConsumablePayload } from '@/api/consumables'
import { CATEGORIES, parseConsumableNumbers } from './consumableFormat'
import type { ConsumableCategory } from '@/api/consumables'
import './SpaceConsumables.css'

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

interface Props {
  todayKey: string
  onCreate: (payload: CreateConsumablePayload) => Promise<void>
  onCancel: () => void
}

/** 新建表单：只负责输入与本地校验，提交成功与否由调用方决定 */
export default function ConsumableForm({ todayKey, onCreate, onCancel }: Props) {
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const name = draft.name.trim()
    if (!name) {
      setError('先起个名字')
      return
    }
    const numbers = parseConsumableNumbers(draft)
    if ('error' in numbers) {
      setError(numbers.error)
      return
    }

    setCreating(true)
    setError('')
    try {
      await onCreate({
        name,
        category: draft.category,
        unit: draft.unit.trim() || null,
        quantity: numbers.quantity,
        lead_days: numbers.leadDays,
        started_on: todayKey,
        expected_days: numbers.expectedDays,
      })
      setDraft(EMPTY_DRAFT)
      onCancel()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setCreating(false)
    }
  }

  return (
    <form className="space-item-form" onSubmit={submit} noValidate>
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
            setError('')
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
              setError('')
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
              setError('')
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
              setError('')
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

      {error && <p className="space-error">{error}</p>}

      <div className="space-item-form-actions">
        <button type="button" className="space-button" onClick={onCancel}>
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
  )
}
