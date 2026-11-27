import { describe, expect, it } from 'vitest'
import {
  MAX_DIFF_LINES,
  MAX_FILE_BYTES,
  diffStats,
  diffText,
  diffToText,
  filterDiffRows,
  isTextLikeFile,
  splitLines,
} from './diff'

describe('文本 Diff', () => {
  it('相同文本全是 equal', () => {
    const rows = diffText('a\nb', 'a\nb')
    expect(rows.map((row) => row.kind)).toEqual(['equal', 'equal'])
    expect(rows[0]).toMatchObject({ oldLine: 1, newLine: 1, text: 'a' })
  })

  it('新增和删除行各自带正确的行号', () => {
    const rows = diffText('a\nb\nc', 'a\nx\nc')
    expect(rows.map((row) => row.kind)).toEqual(['equal', 'del', 'add', 'equal'])
    expect(rows[1]).toMatchObject({ oldLine: 2, text: 'b' })
    expect(rows[2]).toMatchObject({ newLine: 2, text: 'x' })
    expect(rows[3]).toMatchObject({ oldLine: 3, newLine: 3, text: 'c' })
  })

  it('CRLF 和末尾换行不影响行数', () => {
    expect(splitLines('a\r\nb\r\n')).toEqual(['a', 'b'])
    expect(diffText('a\r\nb\r\n', 'a\nb').every((row) => row.kind === 'equal')).toBe(true)
  })

  it('可以忽略行尾空白', () => {
    expect(diffText('a  \nb', 'a\nb').filter((row) => row.kind !== 'equal')).toHaveLength(2)
    expect(
      diffText('a  \nb', 'a\nb', { ignoreTrailingWhitespace: true }).filter((row) => row.kind !== 'equal'),
    ).toHaveLength(0)
  })

  it('统计和只看差异', () => {
    const rows = diffText('a\nb', 'a\nb\nc')
    expect(diffStats(rows)).toEqual({ added: 1, removed: 0, unchanged: 2 })
    expect(filterDiffRows(rows, true)).toEqual([{ kind: 'add', newLine: 3, text: 'c' }])
  })

  it('复制文本只包含增删行', () => {
    const rows = diffText('a\nb', 'a\nc')
    expect(diffToText(rows)).toBe('-b\n+c')
  })

  it('文件类型白名单', () => {
    expect(isTextLikeFile({ name: 'app.log', type: '' })).toBe(true)
    expect(isTextLikeFile({ name: 'data.json', type: 'application/json' })).toBe(true)
    expect(isTextLikeFile({ name: 'photo.png', type: 'image/png' })).toBe(false)
  })

  it('单边上限是 1 GB / 10 万行', () => {
    expect(MAX_FILE_BYTES).toBe(1024 * 1024 * 1024)
    expect(MAX_DIFF_LINES).toBe(100_000)
  })
})
