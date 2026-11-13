import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import DatePicker from '@/components/DatePicker'
import { useConfirm } from '@/components/ConfirmDialog/useConfirm'
import { errorMessage } from '@/api/client'
import { memoApi } from '@/api/memos'
import type { Memo, MemoSummary } from '@/api/memos'
import { useAuth } from '@/auth/AuthProvider'
import { usePermission } from '@/auth/usePermission'
import { PAGE_SIZE, formatDate } from '@/utils/format'
import './Space.css'

type Filter = 'all' | 'pending' | 'done'

const pad = (value: number) => String(value).padStart(2, '0')

/** 本地日期（YYYY-MM-DD）：due_at 存的就是这个口径，不能用 UTC 比 */
function localToday(): string {
  const now = new Date()
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** "M 月 D 日 · 星期四" */
function todayLabel(): string {
  const now = new Date()
  const weekday = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
  return `${now.getMonth() + 1} 月 ${now.getDate()} 日 · ${weekday[now.getDay()]}`
}

function dueMeta(dueAt: string): { text: string; tone: 'today' | 'late' | 'later' } {
  const today = localToday()
  if (dueAt === today) return { text: '今天到期', tone: 'today' }
  if (dueAt < today) return { text: `${dueAt.slice(5)} 已过期`, tone: 'late' }
  return { text: `${dueAt.slice(5)} 到期`, tone: 'later' }
}

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '待办' },
  { key: 'done', label: '已完成' },
]

export default function Space() {
  const { user, ready, openLogin } = useAuth()
  const { has } = usePermission()
  const { confirm, dialog } = useConfirm()

  const [filter, setFilter] = useState<Filter>('all')
  const [items, setItems] = useState<Memo[]>([])
  const [hasNext, setHasNext] = useState(false)
  const [pageIndex, setPageIndex] = useState(0)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  const [summary, setSummary] = useState<MemoSummary | null>(null)
  const [body, setBody] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [saving, setSaving] = useState(false)
  const [composeError, setComposeError] = useState('')
  // 就地编辑已有条目：内容和到期日都能改，改完直接落库
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editBody, setEditBody] = useState('')
  const [editDue, setEditDue] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')
  // 手机上先给一个「＋ 记一条」按钮，点开才是输入区；桌面上宽屏默认展开
  const [expanded, setExpanded] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches,
  )
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!expanded) return
    const timer = window.setTimeout(() => textareaRef.current?.focus(), 60)
    return () => window.clearTimeout(timer)
  }, [expanded])

  const loadPage = useCallback(
    (done: boolean | undefined, offset: number) => memoApi.list(done, PAGE_SIZE, offset),
    [],
  )

  useEffect(() => {
    if (!user) return
    let cancelled = false
    setStatus('loading')
    setError('')
    const done = filter === 'all' ? undefined : filter === 'done'
    loadPage(done, pageIndex * PAGE_SIZE)
      .then((page) => {
        if (cancelled) return
        setItems((prev) => (pageIndex === 0 ? page.items : [...prev, ...page.items]))
        setHasNext(page.has_next)
        setStatus('ready')
      })
      .catch((err) => {
        if (cancelled) return
        setError(errorMessage(err))
        setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [user, filter, pageIndex, reloadKey, loadPage])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    memoApi
      .summary()
      .then((next) => {
        if (!cancelled) setSummary(next)
      })
      .catch(() => {
        // 计数失败不影响列表本身，页面照常显示条目
      })
    return () => {
      cancelled = true
    }
  }, [user, reloadKey])

  const refresh = () => {
    setPageIndex(0)
    setReloadKey((key) => key + 1)
  }

  const switchFilter = (next: Filter) => {
    if (next === filter) return
    setFilter(next)
    setItems([])
    setPageIndex(0)
    setReloadKey((key) => key + 1)
  }

  const submit = async (event?: FormEvent) => {
    event?.preventDefault()
    setComposeError('')
    const text = body.trim()
    if (!text) {
      setComposeError('写点什么再保存')
      return
    }
    if (text.length > 2000) {
      setComposeError('一条最多 2000 个字符')
      return
    }
    setSaving(true)
    try {
      await memoApi.create({ body: text, due_at: dueAt || null })
      setBody('')
      setDueAt('')
      // 新建的条目在「已完成」里看不到，切回「全部」再刷新
      if (filter === 'done') setFilter('all')
      // 清掉旧列表再刷新，这样重取期间会显示骨架，不会「点了保存像什么都没发生」
      setItems([])
      setPageIndex(0)
      setReloadKey((key) => key + 1)
    } catch (err) {
      setComposeError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (memo: Memo) => {
    setEditingId(memo.id)
    setEditBody(memo.body)
    setEditDue(memo.due_at ?? '')
    setEditError('')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditError('')
  }

  const saveEdit = async (memo: Memo) => {
    const text = editBody.trim()
    if (!text) {
      setEditError('内容不能为空')
      return
    }
    if (text.length > 2000) {
      setEditError('一条最多 2000 个字符')
      return
    }
    setEditSaving(true)
    try {
      const updated = await memoApi.update(memo.id, { body: text, due_at: editDue || null })
      setItems((prev) => prev.map((item) => (item.id === memo.id ? updated : item)))
      setEditingId(null)
      setReloadKey((key) => key + 1)
    } catch (err) {
      setEditError(errorMessage(err))
    } finally {
      setEditSaving(false)
    }
  }

  const toggleDone = async (memo: Memo) => {
    const nextDone = !memo.done
    // 先改本地：勾选要立刻有反馈，失败再回滚并刷新计数
    setItems((prev) =>
      prev.map((item) => (item.id === memo.id ? { ...item, done: nextDone } : item)),
    )
    try {
      const updated = await memoApi.update(memo.id, { done: nextDone })
      setItems((prev) => prev.map((item) => (item.id === memo.id ? updated : item)))
      setReloadKey((key) => key + 1)
    } catch (err) {
      setItems((prev) =>
        prev.map((item) => (item.id === memo.id ? { ...item, done: memo.done } : item)),
      )
      setError(errorMessage(err))
    }
  }

  const remove = (memo: Memo) => {
    confirm({
      title: '删除这条备忘录？',
      description: '删除后不再出现在列表里。',
      confirmText: '删除',
      tone: 'danger',
      onConfirm: async () => {
        await memoApi.remove(memo.id)
        setItems((prev) => prev.filter((item) => item.id !== memo.id))
        setReloadKey((key) => key + 1)
      },
    })
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault()
      void submit()
    }
  }

  const counts = useMemo(() => {
    const total = summary ? summary.pending + summary.done : null
    return {
      all: total,
      pending: summary?.pending ?? null,
      done: summary?.done ?? null,
    }
  }, [summary])

  if (!ready) return <div className="space-page space-state">加载中…</div>

  if (!user) {
    return (
      <div className="space-page">
        <header className="space-header">
          <h1>个人空间</h1>
          <p className="space-meta">{todayLabel()} · 未登录</p>
        </header>
        <div className="space-gate">
          <p>登录后才可以记录和查看自己的备忘录与待办。</p>
          <button type="button" className="space-button space-button-primary" onClick={() => openLogin()}>
            登录
          </button>
        </div>
        <p className="space-foot">只属于你的备忘录，别人看不到。</p>
      </div>
    )
  }

  const filtering = filter !== 'all'

  return (
    <div className="space-page">
      <header className="space-header">
        <h1>个人空间</h1>
        <p className="space-meta">
          {todayLabel()}
          {summary && ` · ${summary.pending} 条待办`}
          {summary && summary.due > 0 && `，${summary.due} 条已到期`}
        </p>
      </header>

      {/* 快捷入口是给管理员的：普通用户看到「分析 / 邀请码」也进不去，不如不显示 */}
      {user.role === 'admin' && (
        <nav className="space-quick" aria-label="快捷入口">
          <Link to="/blog">
            写文章<span>发到博客</span>
          </Link>
          {has('activity:read:any') && (
            <Link to="/admin?tab=analytics">
              分析<span>访客与停留</span>
            </Link>
          )}
          {has('invite_code:read:any') && (
            <Link to="/admin?tab=invites">
              邀请码<span>生成与查看</span>
            </Link>
          )}
        </nav>
      )}

      <div className="space-dock">
        {!expanded ? (
          <button
            type="button"
            className="space-compose-trigger"
            onClick={() => setExpanded(true)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
            记一条
            <span>备忘录 / 待办</span>
          </button>
        ) : (
          <>
            <form className="space-composer" onSubmit={submit} noValidate>
              <textarea
                ref={textareaRef}
                value={body}
                rows={1}
                maxLength={2000}
                placeholder="写点什么，比如「周五前交周报」"
                aria-label="新备忘录"
                onChange={(event) => {
                  setBody(event.target.value)
                  setComposeError('')
                  event.target.style.height = 'auto'
                  event.target.style.height = `${Math.min(event.target.scrollHeight, 140)}px`
                }}
                onKeyDown={onKeyDown}
              />
              {/* 原生 date 输入在中文环境里会露出「年/月/日」三个空槽，很怪：
                  把它藏起来，只用一个按钮显示状态，点按钮再拉起系统日历 */}
              <div className="space-due">
                <DatePicker
                  value={dueAt || null}
                  onChange={(day) => setDueAt(day ?? '')}
                  placeholder="到期日"
                  ariaLabel="到期日"
                  triggerClassName="space-due-trigger"
                  icon={
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                      <path d="M7 4v3M17 4v3M4 9h16M5 7h14v12H5z" />
                    </svg>
                  }
                />
                {dueAt && (
                  <button
                    type="button"
                    className="space-due-clear"
                    aria-label="清除到期日"
                    onClick={() => setDueAt('')}
                  >
                    ×
                  </button>
                )}
              </div>
              <button
                type="submit"
                className="space-button space-button-primary"
                disabled={saving || body.trim().length === 0}
              >
                {saving ? '保存中…' : '保存'}
              </button>
            </form>
            <div className="space-dock-foot">
              <button
                type="button"
                className="space-collapse"
                onClick={() => {
                  setExpanded(false)
                  setComposeError('')
                }}
              >
                收起
              </button>
              {composeError ? (
                <p className="space-error">{composeError}</p>
              ) : (
                <p className="space-hint">Ctrl / ⌘ + Enter 保存</p>
              )}
            </div>
          </>
        )}
      </div>

      <div className="space-list-head">
        <div className="space-seg" role="group" aria-label="筛选">
          {FILTERS.map((item) => (
            <button
              key={item.key}
              type="button"
              aria-pressed={filter === item.key}
              onClick={() => switchFilter(item.key)}
            >
              {item.label}
              {counts[item.key] !== null ? ` ${counts[item.key]}` : ''}
            </button>
          ))}
        </div>
        <span className="space-order">按创建时间倒序</span>
      </div>

      {status === 'error' && (
        <div className="space-state space-state-error">
          <p>{error}</p>
          <button type="button" className="space-button" onClick={refresh}>
            重试
          </button>
        </div>
      )}

      {status === 'loading' && items.length === 0 && (
        <div className="space-list" aria-busy="true" aria-label="加载中">
          {[0, 1, 2].map((row) => (
            <article key={row} className="space-memo space-skeleton">
              <span className="space-skeleton-box" />
              <div className="space-skeleton-lines">
                <span className="space-skeleton-line" />
                <span className="space-skeleton-line is-short" />
              </div>
            </article>
          ))}
        </div>
      )}

      {status !== 'error' && items.length === 0 && status === 'ready' && (
        <div className="space-state">
          {filtering ? '这里还没有条目。' : '还没有备忘录，点下面的「＋ 记一条」写第一条。'}
        </div>
      )}

      {items.length > 0 && (
        <div className="space-list">
          {items.map((memo) => {
            const due = memo.due_at ? dueMeta(memo.due_at) : null
            const isEditing = editingId === memo.id
            if (isEditing) {
              return (
                <article key={memo.id} className="space-memo is-editing">
                  <div className="space-edit">
                    <textarea
                      className="space-edit-text"
                      value={editBody}
                      rows={3}
                      maxLength={2000}
                      autoFocus
                      aria-label="修改备忘录"
                      onChange={(event) => {
                        setEditBody(event.target.value)
                        setEditError('')
                      }}
                      onKeyDown={(event) => {
                        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                          event.preventDefault()
                          void saveEdit(memo)
                        }
                        if (event.key === 'Escape') {
                          event.preventDefault()
                          cancelEdit()
                        }
                      }}
                    />
                    <div className="space-edit-foot">
                      <div className="space-due">
                        <DatePicker
                          value={editDue || null}
                          onChange={(day) => setEditDue(day ?? '')}
                          placeholder="到期日"
                          ariaLabel="到期日"
                          triggerClassName="space-due-trigger"
                          icon={
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                              <path d="M7 4v3M17 4v3M4 9h16M5 7h14v12H5z" />
                            </svg>
                          }
                        />
                        {editDue && (
                          <button
                            type="button"
                            className="space-due-clear"
                            aria-label="清除到期日"
                            onClick={() => setEditDue('')}
                          >
                            ×
                          </button>
                        )}
                      </div>
                      <div className="space-edit-actions">
                        <button type="button" className="space-button" onClick={cancelEdit}>
                          取消
                        </button>
                        <button
                          type="button"
                          className="space-button space-button-primary"
                          disabled={editSaving || editBody.trim().length === 0}
                          onClick={() => void saveEdit(memo)}
                        >
                          {editSaving ? '保存中…' : '保存'}
                        </button>
                      </div>
                    </div>
                    {editError && <p className="space-error">{editError}</p>}
                  </div>
                </article>
              )
            }
            return (
              <article key={memo.id} className={memo.done ? 'space-memo is-done' : 'space-memo'}>
                <button
                  type="button"
                  className="space-check"
                  aria-pressed={memo.done}
                  aria-label={memo.done ? '取消完成' : '标记完成'}
                  onClick={() => void toggleDone(memo)}
                >
                  <span className="space-box">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
                      <path d="M20 7L9 18 4 13" />
                    </svg>
                  </span>
                </button>

                <div className="space-memo-main">
                  <button
                    type="button"
                    className="space-memo-text space-memo-text-button"
                    onClick={() => startEdit(memo)}
                    title="点一下修改"
                  >
                    {memo.body}
                  </button>
                  <p className="space-memo-meta">
                    {due && (
                      <span className={`space-tag space-tag-${due.tone}`}>{due.text}</span>
                    )}
                    {memo.done && memo.done_at && <span>完成于 {formatDate(memo.done_at)}</span>}
                    {!memo.done && <span>{formatDate(memo.created_at)}</span>}
                  </p>
                </div>

                <button
                  type="button"
                  className="space-del"
                  aria-label="删除"
                  onClick={() => remove(memo)}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                    <path d="M6 7h12M9 7V5h6v2M8 7l1 12h6l1-12" />
                  </svg>
                </button>
              </article>
            )
          })}

          {hasNext && (
            <button
              type="button"
              className="space-button space-more"
              disabled={status === 'loading'}
              onClick={() => setPageIndex((index) => index + 1)}
            >
              {status === 'loading' ? '加载中…' : '加载更多'}
            </button>
          )}
        </div>
      )}

      <p className="space-foot">只属于你的备忘录，别人看不到。</p>
      {dialog}
    </div>
  )
}
