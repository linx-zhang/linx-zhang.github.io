/**
 * Markdown 编辑变换：只做「文本 + 选区」这一层纯计算，不碰 DOM。
 *
 * 放在 utils 而不是组件里，有两个原因：
 * 1. 工具栏按钮、快捷键、将来的粘贴处理都复用同一套变换，行为不会各自漂移；
 * 2. 纯函数可以直接跑用例，不需要渲染环境。
 *
 * 所有函数都返回新选区，调用方负责把选区写回 textarea（并保留原生撤销栈）。
 */

export interface TextEdit {
  value: string
  /** 变换后应选中的区间起点 */
  start: number
  /** 变换后应选中的区间终点 */
  end: number
}

/** 选区所在的行范围 [lineStart, lineEnd)，lineEnd 不含换行符 */
function lineBounds(value: string, start: number, end: number): { lineStart: number; lineEnd: number } {
  const lineStart = value.lastIndexOf('\n', start - 1) + 1
  const nextBreak = value.indexOf('\n', end)
  return { lineStart, lineEnd: nextBreak === -1 ? value.length : nextBreak }
}

// `*text*` / `_text_` 之外的分隔符都可能出现在正文里，这里只需要成对包裹
export function wrapSelection(
  value: string,
  start: number,
  end: number,
  before: string,
  after: string,
  placeholder = '',
): TextEdit {
  const selected = value.slice(start, end)
  const inner = selected || placeholder
  const next = value.slice(0, start) + before + inner + after + value.slice(end)
  const innerStart = start + before.length
  return { value: next, start: innerStart, end: innerStart + inner.length }
}

/** 行首前缀开关：列表 / 引用 / 标题。全部行都有时去掉，否则补上（有序列表自动重编号） */
export function toggleLinePrefix(
  value: string,
  start: number,
  end: number,
  prefix: string,
  options: { numbered?: boolean } = {},
): TextEdit {
  const { lineStart, lineEnd } = lineBounds(value, start, end)
  const lines = value.slice(lineStart, lineEnd).split('\n')
  const marker = options.numbered ? /^\d+\.\s+/ : null
  const matches = (line: string) =>
    marker ? marker.test(line) : line.startsWith(prefix)
  const allPrefixed = lines.every((line) => matches(line) || line.trim() === '')

  const nextLines = lines.map((line, index) => {
    if (allPrefixed) {
      if (marker) return line.replace(marker, '')
      return line.startsWith(prefix) ? line.slice(prefix.length) : line
    }
    if (marker) return `${index + 1}. ${line}`
    return `${prefix}${line}`
  })

  const nextBlock = nextLines.join('\n')
  const delta = nextBlock.length - (lineEnd - lineStart)
  return { value: value.slice(0, lineStart) + nextBlock + value.slice(lineEnd), start, end: end + delta }
}

/** 插入独占一行的块（代码块、分割线）：前后各留空行，避免和上下文粘成一段 */
export function insertBlock(value: string, start: number, end: number, block: string, cursorOffset?: number): TextEdit {
  const prefix = start === 0 || value.slice(0, start).endsWith('\n\n') ? '' : value.slice(0, start).endsWith('\n') ? '\n' : '\n\n'
  const suffix = value.slice(end).startsWith('\n\n') ? '' : value.slice(end).startsWith('\n') ? '\n' : '\n\n'
  const next = value.slice(0, start) + prefix + block + suffix + value.slice(end)
  const blockStart = start + prefix.length
  const cursor = cursorOffset === undefined ? blockStart + block.length : blockStart + cursorOffset
  return { value: next, start: cursor, end: cursor }
}

/** 链接：有选中文本时把选中内容当标题并选中 URL；没有选中时插入占位标题并选中标题 */
export function applyLink(value: string, start: number, end: number, urlPlaceholder = 'https://'): TextEdit {
  const selected = value.slice(start, end)
  if (selected) {
    const next = `${value.slice(0, start)}[${selected}](${urlPlaceholder})${value.slice(end)}`
    const urlStart = start + selected.length + 3
    return { value: next, start: urlStart, end: urlStart + urlPlaceholder.length }
  }
  const label = '链接文字'
  const next = `${value.slice(0, start)}[${label}](${urlPlaceholder})${value.slice(end)}`
  return { value: next, start: start + 1, end: start + 1 + label.length }
}
