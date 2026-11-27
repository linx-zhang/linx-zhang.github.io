import { diffLines } from 'diff'

/** 文本 Diff 的纯计算：组件只负责两个输入、文件读取和渲染。 */

export type DiffKind = 'equal' | 'add' | 'del'

export interface DiffRow {
  kind: DiffKind
  oldLine?: number
  newLine?: number
  text: string
}

export interface DiffStats {
  added: number
  removed: number
  unchanged: number
}

export const MAX_FILE_BYTES = 1024 * 1024 * 1024
export const MAX_DIFF_LINES = 100_000

const TEXT_EXTENSIONS = new Set([
  'txt',
  'log',
  'json',
  'jsonl',
  'sql',
  'csv',
  'tsv',
  'md',
  'markdown',
  'yaml',
  'yml',
  'xml',
  'html',
  'htm',
  'css',
  'scss',
  'less',
  'js',
  'jsx',
  'ts',
  'tsx',
  'py',
  'go',
  'java',
  'kt',
  'rs',
  'c',
  'h',
  'cpp',
  'hpp',
  'sh',
  'ps1',
  'ini',
  'conf',
  'cfg',
  'toml',
  'env',
  'diff',
  'patch',
])

export function isTextLikeFile(file: Pick<File, 'name' | 'type'>): boolean {
  if (file.type.startsWith('text/')) return true
  if (file.type === 'application/json' || file.type === 'application/xml') return true
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  return TEXT_EXTENSIONS.has(extension)
}

export interface DiffOptions {
  /** 忽略行尾空格 / Tab，但展示时也按去掉后的内容显示 */
  ignoreTrailingWhitespace?: boolean
}

/** 按行拆分，统一 CRLF；去掉末尾换行带来的空行 */
export function splitLines(text: string): string[] {
  const normalized = text.replace(/\r\n?/g, '\n')
  const lines = normalized.split('\n')
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()
  return lines
}

/**
 * diffLines 的 value 带换行，oneChangePerToken 让每个 change 只代表一行，
 * 这样 old/new 行号可以严格按行推进，不会因为一整段增删而错位。
 */
export function diffText(
  oldText: string,
  newText: string,
  options: DiffOptions = {},
): DiffRow[] {
  const normalize = (line: string) =>
    options.ignoreTrailingWhitespace ? line.replace(/[ \t]+$/, '') : line
  const oldLines = splitLines(oldText).map(normalize)
  const newLines = splitLines(newText).map(normalize)
  // diffLines 把换行也算进 token；两边统一补一个结尾换行，
  // 否则「最后一行有没有换行」会被当成内容不同。
  const oldValue = oldLines.length ? `${oldLines.join('\n')}\n` : ''
  const newValue = newLines.length ? `${newLines.join('\n')}\n` : ''
  const changes = diffLines(oldValue, newValue, { oneChangePerToken: true })

  const rows: DiffRow[] = []
  let oldLine = 1
  let newLine = 1

  for (const change of changes) {
    const text = change.value.replace(/\r?\n$/, '')
    if (change.added) {
      rows.push({ kind: 'add', newLine, text })
      newLine += 1
    } else if (change.removed) {
      rows.push({ kind: 'del', oldLine, text })
      oldLine += 1
    } else {
      rows.push({ kind: 'equal', oldLine, newLine, text })
      oldLine += 1
      newLine += 1
    }
  }

  return rows
}

export function diffStats(rows: readonly DiffRow[]): DiffStats {
  return rows.reduce<DiffStats>(
    (stats, row) => {
      if (row.kind === 'add') stats.added += 1
      else if (row.kind === 'del') stats.removed += 1
      else stats.unchanged += 1
      return stats
    },
    { added: 0, removed: 0, unchanged: 0 },
  )
}

/** 只看差异时去掉 equal 行；上下文由用户自己决定，不强行截断 */
export function filterDiffRows(rows: readonly DiffRow[], onlyDiff: boolean): DiffRow[] {
  return onlyDiff ? rows.filter((row) => row.kind !== 'equal') : [...rows]
}

/** 复制成常见的 +/- 文本 */
export function diffToText(rows: readonly DiffRow[]): string {
  return rows
    .filter((row) => row.kind !== 'equal')
    .map((row) => `${row.kind === 'add' ? '+' : '-'}${row.text}`)
    .join('\n')
}
