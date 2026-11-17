import { useCallback, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import {
  BIG_DEPTH,
  buildRows,
  CHILD_PAGE,
  collectBranches,
  EXPAND_ALL_BUDGET,
  ROW_HEIGHT,
} from './jsonTreeModel'
import type { JsonRow } from './jsonTreeModel'

/** 父组件用 nonce 递增来下发一次「改展开方式」的指令，避免换 key 重挂 */
export interface TreeCommand {
  kind: 'depth' | 'all' | 'none'
  depth: number
  nonce: number
}

interface JsonTreeProps {
  value: unknown
  /** 首次渲染展开到第几层（Infinity = 全展开） */
  initialDepth: number
  command: TreeCommand
  /** 滚动容器的类名，工具页传 tool-code-scroll */
  className?: string
}

/** 每层缩进 */
const INDENT = 14
/** 折叠箭头占的宽度：行内容统一从这里开始 */
const ARROW = 18
/** 视口上下各多渲染几行，滚动时不露白 */
const OVERSCAN = 6

const rowStyle = (depth: number, hasArrow: boolean): CSSProperties => ({
  paddingLeft: depth * INDENT + ARROW,
  textIndent: hasArrow ? -ARROW : undefined,
})

interface RowActions {
  onToggle: (path: string) => void
  onMore: (path: string) => void
}

function Row({ row, actions }: { row: JsonRow; actions: RowActions }) {
  if (row.kind === 'leaf') {
    return (
      <div className="json-row" style={rowStyle(row.depth, false)}>
        {row.label && <span className={row.isIndex ? 'json-index' : 'json-key'}>{row.label}</span>}
        <span className={`json-${row.tone}`}>{row.text}</span>
        <span className="json-tail">{row.tail}</span>
      </div>
    )
  }

  if (row.kind === 'close') {
    return (
      <div className="json-row" style={rowStyle(row.depth, false)}>
        <span className="json-bracket">{row.bracket}</span>
        <span className="json-tail">{row.tail}</span>
      </div>
    )
  }

  if (row.kind === 'more') {
    return (
      <div className="json-row" style={rowStyle(row.depth, false)}>
        <button type="button" className="json-more" onClick={() => actions.onMore(row.path)}>
          显示更多（还剩 {row.remaining.toLocaleString()} 项）
        </button>
      </div>
    )
  }

  if (row.empty) {
    return (
      <div className="json-row" style={rowStyle(row.depth, false)}>
        {row.label && <span className={row.isIndex ? 'json-index' : 'json-key'}>{row.label}</span>}
        <span className="json-bracket">
          {row.bracket}
          {row.bracket === '{' ? '}' : ']'}
        </span>
        <span className="json-tail">{row.tail}</span>
      </div>
    )
  }

  return (
    <div className="json-row" style={rowStyle(row.depth, true)}>
      <button
        type="button"
        className="json-arrow"
        aria-expanded={row.open}
        aria-label={row.open ? '折叠' : '展开'}
        onClick={() => actions.onToggle(row.path)}
      >
        {row.open ? '▾' : '▸'}
      </button>
      {row.label && <span className={row.isIndex ? 'json-index' : 'json-key'}>{row.label}</span>}
      <span className="json-bracket">{row.bracket}</span>
      {!row.open && (
        <>
          {row.hint && <span className="json-hint">{row.hint}</span>}
          <span className="json-bracket">{row.bracket === '{' ? '}' : ']'}</span>
          <span className="json-tail">{row.tail}</span>
        </>
      )}
    </div>
  )
}

/** 路径 → 深度（`$` 为 0，之后每多一个 `|` 多一层） */
const pathDepth = (path: string): number => {
  let depth = 0
  for (let i = 0; i < path.length; i++) {
    if (path.charCodeAt(i) === 124) depth++
  }
  return depth
}

export default function JsonTree({ value, initialDepth, command, className }: JsonTreeProps) {
  /**
   * 展开状态 = 深度规则（默认开前 N 层）+ 手动覆盖。
   * 不用「先收集所有要展开的路径」：63 MB 的数组有几百万个分支，收集本身就要遍历一遍。
   */
  const [manualOpen, setManualOpen] = useState<{ nonce: number; open: Map<string, boolean> } | null>(null)
  const [limits, setLimits] = useState<Record<string, number>>({})
  const [scrollTop, setScrollTop] = useState(0)
  const [viewport, setViewport] = useState(0)
  const observerRef = useRef<ResizeObserver | null>(null)

  const base = useMemo(() => {
    if (command.nonce === 0 || command.kind === 'depth') {
      // nonce 为 0 表示首次渲染，用 initialDepth（大 JSON 只开两层）
      const maxDepth = command.nonce === 0 ? initialDepth : command.depth
      return { maxDepth, paths: new Set<string>(), truncated: false }
    }
    if (command.kind === 'none') return { maxDepth: 0, paths: new Set<string>(), truncated: false }
    const all = collectBranches(value, { maxDepth: Number.POSITIVE_INFINITY, budget: EXPAND_ALL_BUDGET })
    // 全展开超预算：退回只开前两层，并告诉用户一声
    if (all.truncated) return { maxDepth: BIG_DEPTH, paths: new Set<string>(), truncated: true }
    return { maxDepth: 0, paths: all.paths, truncated: false }
  }, [command, initialDepth, value])

  const openMap = manualOpen && manualOpen.nonce === command.nonce ? manualOpen.open : null

  const { rows } = useMemo(
    () =>
      buildRows(value, {
        expanded: (path, depth) => {
          if (openMap?.has(path)) return openMap.get(path) === true
          return depth < base.maxDepth || base.paths.has(path)
        },
        childLimit: (path) => limits[path],
      }),
    [value, openMap, base, limits],
  )

  const total = rows.length
  const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN)
  const end = Math.min(total, start + Math.ceil(Math.max(viewport, ROW_HEIGHT) / ROW_HEIGHT) + OVERSCAN * 2)

  /** 挂到滚动容器上：记下节点、量一次视口高度，并跟着容器尺寸变化重算可见窗口 */
  const attachScroller = useCallback((node: HTMLDivElement | null) => {
    observerRef.current?.disconnect()
    observerRef.current = null
    if (!node) return
    setViewport(node.clientHeight)
    const observer = new ResizeObserver(() => setViewport(node.clientHeight))
    observer.observe(node)
    observerRef.current = observer
  }, [])

  const actions: RowActions = useMemo(
    () => ({
      onToggle: (path) =>
        setManualOpen((prev) => {
          const open = new Map(prev && prev.nonce === command.nonce ? prev.open : [])
          // 手动点击时以当前渲染出来的状态取反：深度规则开着的点一下就是收
          const current = open.has(path)
            ? open.get(path) === true
            : base.paths.has(path) || pathDepth(path) < base.maxDepth
          open.set(path, !current)
          return { nonce: command.nonce, open }
        }),
      onMore: (path) =>
        setLimits((prev) => ({ ...prev, [path]: (prev[path] ?? CHILD_PAGE) + CHILD_PAGE })),
    }),
    [base, command.nonce],
  )

  return (
    <>
      {base.truncated && (
        <p className="json-notice">
          条目太多（超过 {EXPAND_ALL_BUDGET.toLocaleString()} 行），已按前 {BIG_DEPTH} 层展开，其余逐层点开
        </p>
      )}
      <div
        ref={attachScroller}
        className={className ? `json-scroll ${className}` : 'json-scroll'}
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      >
        <div style={{ height: start * ROW_HEIGHT }} aria-hidden />
        {rows.slice(start, end).map((row, index) => (
          <Row key={start + index} row={row} actions={actions} />
        ))}
        <div style={{ height: Math.max(0, (total - end) * ROW_HEIGHT) }} aria-hidden />
      </div>
    </>
  )
}
