/**
 * JSON 树的行模型：把任意 JSON 值压平成「当前可见的一行一行」。
 *
 * 存在的理由：树形视图以前靠 `output.length <= 120_000` 这种文本长度当开关，
 * 于是「格式化」大多被挡在门外、「压缩成一行」才勉强能看（见 JsonTool 旧实现）。
 * 这里改成按结构走：只遍历展开的分支，行数天然有界，再由 JsonTree 做定高虚拟滚动。
 */

/** 每行固定高度，必须与 Tools.css 里 .json-row 的 height/line-height 一致 */
export const ROW_HEIGHT = 22

/** 单个分支一次渲染多少个子节点，到底了给「显示更多」 */
export const CHILD_PAGE = 200

/** 全部展开的行数上限：再多就退回分层展开，避免一次挂几十万行 */
export const EXPAND_ALL_BUDGET = 50_000

/** 输入超过这个字符数就默认只展开前两层（不是限制，只是默认视图） */
export const BIG_INPUT = 400_000
export const BIG_DEPTH = 2

/** 单个字符串值最多显示多少字符，超出截断，靠 title 看全文 */
const STRING_MAX = 400

export interface BranchRow {
  kind: 'branch'
  depth: number
  path: string
  /** 已格式化的前缀：`"key": ` / `0: ` / ''（根） */
  label: string
  isIndex: boolean
  open: boolean
  /** `{` 或 `[` */
  bracket: '{' | '['
  /** 折叠时 `… 12 项`，展开时 '' */
  hint: string
  tail: string
  /** 空对象 / 空数组：直接显示 `{}` / `[]` */
  empty: boolean
}

export interface LeafRow {
  kind: 'leaf'
  depth: number
  path: string
  label: string
  isIndex: boolean
  text: string
  tone: 'string' | 'number' | 'bool' | 'null'
  tail: string
}

export interface CloseRow {
  kind: 'close'
  depth: number
  bracket: '}' | ']'
  tail: string
}

export interface MoreRow {
  kind: 'more'
  depth: number
  path: string
  remaining: number
}

export type JsonRow = BranchRow | LeafRow | CloseRow | MoreRow

type Task =
  | { t: 'node'; item: unknown; path: string; depth: number; label: string; isIndex: boolean; tail: string }
  | { t: 'close'; depth: number; bracket: '}' | ']'; tail: string }
  | { t: 'more'; depth: number; path: string; remaining: number }

export interface BuildOptions {
  /** 该分支是否展开；depth 是行深度（根为 0），调用方可以直接按深度做「只开前 N 层」 */
  expanded: (path: string, depth: number) => boolean
  /** 该分支一次渲染的子节点上限，缺省 CHILD_PAGE */
  childLimit?: (path: string) => number
  /** 行数上限，超出即截断（用于「全部展开」的预算保护） */
  budget?: number
}

const isBranch = (value: unknown): value is Record<string, unknown> | unknown[] =>
  typeof value === 'object' && value !== null

function leafRow(
  item: unknown,
  depth: number,
  path: string,
  label: string,
  isIndex: boolean,
  tail: string,
): LeafRow {
  if (typeof item === 'string') {
    const json = JSON.stringify(item)
    const text = json.length > STRING_MAX ? `${json.slice(0, STRING_MAX)}…（共 ${item.length} 字符）` : json
    return { kind: 'leaf', depth, path, label, isIndex, text, tone: 'string', tail }
  }
  if (typeof item === 'number') {
    return { kind: 'leaf', depth, path, label, isIndex, text: String(item), tone: 'number', tail }
  }
  if (typeof item === 'boolean') {
    return { kind: 'leaf', depth, path, label, isIndex, text: String(item), tone: 'bool', tail }
  }
  if (typeof item === 'bigint') {
    return { kind: 'leaf', depth, path, label, isIndex, text: String(item), tone: 'number', tail }
  }
  return { kind: 'leaf', depth, path, label, isIndex, text: 'null', tone: 'null', tail }
}

export function buildRows(root: unknown, options: BuildOptions): { rows: JsonRow[]; truncated: boolean } {
  const rows: JsonRow[] = []
  const budget = options.budget ?? 0
  let truncated = false

  const stack: Task[] = [{ t: 'node', item: root, path: '$', depth: 0, label: '', isIndex: false, tail: '' }]

  while (stack.length > 0) {
    if (budget > 0 && rows.length >= budget) {
      truncated = true
      break
    }
    const task = stack.pop() as Task

    if (task.t === 'close') {
      rows.push({ kind: 'close', depth: task.depth, bracket: task.bracket, tail: task.tail })
      continue
    }

    if (task.t === 'more') {
      rows.push({ kind: 'more', depth: task.depth, path: task.path, remaining: task.remaining })
      continue
    }

    const { item, path, depth, label, isIndex, tail } = task

    if (!isBranch(item)) {
      rows.push(leafRow(item, depth, path, label, isIndex, tail))
      continue
    }

    const isArray = Array.isArray(item)
    const keys = isArray ? null : Object.keys(item as Record<string, unknown>)
    const count = isArray ? (item as unknown[]).length : (keys as string[]).length
    const bracket = isArray ? '[' : '{'
    const closeBracket = isArray ? ']' : '}'

    if (count === 0) {
      rows.push({
        kind: 'branch',
        depth,
        path,
        label,
        isIndex,
        open: false,
        bracket,
        hint: '',
        tail,
        empty: true,
      })
      continue
    }

    if (!options.expanded(path, depth)) {
      rows.push({
        kind: 'branch',
        depth,
        path,
        label,
        isIndex,
        open: false,
        bracket,
        hint: `… ${count} ${isArray ? '项' : '个键'}`,
        tail,
        empty: false,
      })
      continue
    }

    rows.push({
      kind: 'branch',
      depth,
      path,
      label,
      isIndex,
      open: true,
      bracket,
      hint: '',
      tail,
      empty: false,
    })

    const limit = Math.max(1, options.childLimit?.(path) ?? CHILD_PAGE)
    const renderCount = Math.min(count, limit)

    // LIFO：先压 close，再压 more，最后压子节点（倒序），弹出顺序就是 子 → more → close
    stack.push({ t: 'close', depth, bracket: closeBracket, tail })
    if (count > renderCount) {
      stack.push({ t: 'more', depth: depth + 1, path, remaining: count - renderCount })
    }
    for (let i = renderCount - 1; i >= 0; i--) {
      const childKey = isArray ? String(i) : (keys as string[])[i]
      stack.push({
        t: 'node',
        item: isArray ? (item as unknown[])[i] : (item as Record<string, unknown>)[childKey],
        path: `${path}|${childKey}`,
        depth: depth + 1,
        label: isArray ? `${childKey}: ` : `${JSON.stringify(childKey)}: `,
        isIndex: isArray,
        tail: i === count - 1 ? '' : ',',
      })
    }
  }

  return { rows, truncated }
}

export interface CollectOptions {
  /** 展开到第几层（Infinity = 全展开） */
  maxDepth: number
  /** 最多收集多少个分支，防止「全部展开」时遍历整棵树 */
  budget?: number
}

/**
 * 收集要展开的分支路径。
 * 注意：maxDepth 是「展开层级」，depth 从 0（根）开始，所以 maxDepth=2 表示根与第一层展开。
 */
export function collectBranches(root: unknown, options: CollectOptions): { paths: Set<string>; truncated: boolean } {
  const paths = new Set<string>()
  const budget = options.budget ?? 0
  let visited = 0
  let truncated = false

  if (!isBranch(root)) return { paths, truncated }

  const stack: { item: unknown; path: string; depth: number }[] = [{ item: root, path: '$', depth: 0 }]

  while (stack.length > 0) {
    const { item, path, depth } = stack.pop() as { item: unknown; path: string; depth: number }
    visited++
    if (budget > 0 && visited > budget) {
      truncated = true
      break
    }
    if (!isBranch(item)) continue

    const isArray = Array.isArray(item)
    const count = isArray ? (item as unknown[]).length : Object.keys(item as Record<string, unknown>).length

    if (count > 0 && depth < options.maxDepth) paths.add(path)
    if (depth + 1 >= options.maxDepth || count === 0) continue

    // 只为自己要展开的下一层继续下探
    if (isArray) {
      const array = item as unknown[]
      for (let i = array.length - 1; i >= 0; i--) {
        stack.push({ item: array[i], path: `${path}|${i}`, depth: depth + 1 })
      }
    } else {
      const keys = Object.keys(item as Record<string, unknown>)
      for (let i = keys.length - 1; i >= 0; i--) {
        stack.push({
          item: (item as Record<string, unknown>)[keys[i]],
          path: `${path}|${keys[i]}`,
          depth: depth + 1,
        })
      }
    }
  }

  return { paths, truncated }
}

/** 输入规模 → 默认展开层级：大 JSON 只开两层，小 JSON 全开（保持原有观感） */
export function defaultDepth(chars: number): number {
  return chars > BIG_INPUT ? BIG_DEPTH : Number.POSITIVE_INFINITY
}
