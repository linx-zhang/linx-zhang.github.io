import { describe, expect, it } from 'vitest'
import {
  BIG_DEPTH,
  BIG_INPUT,
  buildRows,
  CHILD_PAGE,
  collectBranches,
  defaultDepth,
} from './jsonTreeModel'
import type { BranchRow, JsonRow, LeafRow, MoreRow } from './jsonTreeModel'

const simple = { a: 1, b: { c: 2 } }

const expandedPaths = (...paths: string[]) => (path: string) => paths.includes(path)

const rowText = (rows: JsonRow[], index: number) => {
  const row = rows[index]
  if (row.kind === 'leaf') return `leaf:${row.label}${row.text}${row.tail}`
  if (row.kind === 'branch') return `branch:${row.label}${row.open ? 'open' : 'closed'}${row.hint}${row.tail}`
  if (row.kind === 'more') return `more:${row.remaining}`
  return `close:${row.bracket}${row.tail}`
}

describe('buildRows', () => {
  it('根未展开时只有一行，并带上子节点计数', () => {
    const { rows, truncated } = buildRows(simple, { expanded: () => false })
    expect(truncated).toBe(false)
    expect(rows).toHaveLength(1)
    const row = rows[0] as BranchRow
    expect(row.open).toBe(false)
    expect(row.hint).toBe('… 2 个键')
  })

  it('展开根后展开子分支，行顺序是 子 → 收尾大括号', () => {
    const { rows } = buildRows(simple, { expanded: expandedPaths('$', '$|b') })
    expect(rows.map((_, index) => rowText(rows, index))).toEqual([
      'branch:open',
      'leaf:"a": 1,',
      'branch:"b": open',
      'leaf:"c": 2',
      'close:}',
      'close:}',
    ])
  })

  it('空对象与空数组单独一行，不再展开', () => {
    const { rows } = buildRows({ emptyObj: {}, emptyArr: [] }, { expanded: () => true })
    const first = rows[1] as BranchRow
    expect(first.kind).toBe('branch')
    expect(first.empty).toBe(true)
    const second = rows[2] as BranchRow
    expect(second.empty).toBe(true)
  })

  it('超大数组只渲染前 CHILD_PAGE 项，末尾给「显示更多」', () => {
    const value = Array.from({ length: 1000 }, (_, index) => index)
    const { rows } = buildRows(value, { expanded: () => true })
    expect(rows).toHaveLength(1 + CHILD_PAGE + 1 + 1)
    const more = rows[1 + CHILD_PAGE] as MoreRow
    expect(more.kind).toBe('more')
    expect(more.remaining).toBe(1000 - CHILD_PAGE)
  })

  it('childLimit 可被调用方抬高，剩下的继续提示', () => {
    const value = Array.from({ length: 500 }, (_, index) => index)
    const { rows } = buildRows(value, {
      expanded: () => true,
      childLimit: (path) => (path === '$' ? 400 : CHILD_PAGE),
    })
    const more = rows[1 + 400] as MoreRow
    expect(more.kind).toBe('more')
    expect(more.remaining).toBe(100)
  })

  it('预算用完就停，并标记 truncated', () => {
    const value = Array.from({ length: 500 }, (_, index) => index)
    const { rows, truncated } = buildRows(value, { expanded: () => true, budget: 10 })
    expect(truncated).toBe(true)
    expect(rows).toHaveLength(10)
  })

  it('长字符串截断并标注原长度，不再撑一行几万字', () => {
    const value = { text: 'x'.repeat(500) }
    const { rows } = buildRows(value, { expanded: () => true })
    const leaf = rows[1] as LeafRow
    expect(leaf.text.endsWith('…（共 500 字符）')).toBe(true)
    expect(leaf.tone).toBe('string')
  })

  it('数组下标与对象键的前缀形态不同', () => {
    const { rows } = buildRows({ list: ['a'] }, { expanded: () => true })
    const keyRow = rows[1] as BranchRow
    expect(keyRow.label).toBe('"list": ')
    const indexRow = rows[2] as LeafRow
    expect(indexRow.isIndex).toBe(true)
    expect(indexRow.label).toBe('0: ')
  })
})

describe('collectBranches', () => {
  const nested = { l1: { l2: { l3: { l4: 1 } } }, other: { x: 1 } }

  it('maxDepth=1 只展开根，第一层保持折叠', () => {
    const { paths } = collectBranches(nested, { maxDepth: 1 })
    expect([...paths]).toEqual(['$'])
  })

  it('maxDepth=2 展开根与第一层，第二层折叠', () => {
    const { paths } = collectBranches(nested, { maxDepth: 2 })
    expect(paths.has('$')).toBe(true)
    expect(paths.has('$|l1')).toBe(true)
    expect(paths.has('$|other')).toBe(true)
    expect(paths.has('$|l1|l2')).toBe(false)
  })

  it('Infinity 展开全部分支', () => {
    const { paths, truncated } = collectBranches(nested, { maxDepth: Number.POSITIVE_INFINITY })
    expect(truncated).toBe(false)
    // $ / $|l1 / $|l1|l2 / $|l1|l2|l3 / $|other
    expect(paths.size).toBe(5)
  })

  it('预算不足时截断，交给调用方退回分层展开', () => {
    const wide = { a: { b: 1 }, c: { d: 1 }, e: { f: 1 }, g: { h: 1 } }
    const { truncated } = collectBranches(wide, { maxDepth: Number.POSITIVE_INFINITY, budget: 3 })
    expect(truncated).toBe(true)
  })

  it('标量根不产生任何展开项', () => {
    expect(collectBranches(42, { maxDepth: Number.POSITIVE_INFINITY }).paths.size).toBe(0)
  })
})

describe('defaultDepth', () => {
  it('小 JSON 全展开，大 JSON 只开两层', () => {
    expect(defaultDepth(10_000)).toBe(Number.POSITIVE_INFINITY)
    expect(defaultDepth(BIG_INPUT + 1)).toBe(BIG_DEPTH)
  })
})
