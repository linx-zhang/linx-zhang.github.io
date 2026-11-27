/** 正则工具的全部计算都在这里：组件只负责输入、展示和复制。 */

export const REGEX_FLAGS = [
  { value: 'g', label: 'g', hint: '全局匹配' },
  { value: 'i', label: 'i', hint: '忽略大小写' },
  { value: 'm', label: 'm', hint: '多行模式' },
  { value: 's', label: 's', hint: '点号匹配换行' },
  { value: 'u', label: 'u', hint: 'Unicode 模式' },
] as const

export type RegexFlag = (typeof REGEX_FLAGS)[number]['value']

export interface RegexGroup {
  index: number
  name?: string
  value: string | undefined
}

export interface RegexMatch {
  index: number
  end: number
  value: string
  groups: RegexGroup[]
}

export interface RegexResult {
  matches: RegexMatch[]
  truncated: boolean
}

export interface HighlightPart {
  text: string
  matchIndex?: number
}

export const MATCH_LIMIT = 2000
/** 结果列表只渲染前 100 条，避免一次塞几千个 DOM 节点 */
export const MATCH_DISPLAY_LIMIT = 100
/** 超过这个长度就不做高亮片段：几十万个 span 会把页面拖垮 */
export const HIGHLIGHT_TEXT_MAX = 100_000

/** 把浏览器那句英文正则报错压成一句中文，保留冒号后面的具体原因 */
export function explainRegexError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  const reason = message.replace(/^Invalid regular expression:\s*/i, '').replace(/^\/.*\/:\s*/, '')
  return reason && reason !== message ? `正则语法有误：${reason}` : `正则语法有误：${message}`
}

export function compileRegex(pattern: string, flags: string): RegExp {
  if (!pattern) throw new Error('先输入正则表达式')
  return new RegExp(pattern, flags)
}

/**
 * 逐条匹配。零宽匹配（`a*`、`^`）必须手动推进 lastIndex，
 * 否则 exec 会永远停在同一个位置。上限用来防止灾难性回溯式的输入把页面卡住。
 */
export function findMatches(
  pattern: string,
  flags: string,
  text: string,
  limit = MATCH_LIMIT,
): RegexResult {
  const regex = compileRegex(pattern, flags)
  const matches: RegexMatch[] = []
  let truncated = false
  let match: RegExpExecArray | null

  if (!regex.global) {
    match = regex.exec(text)
    if (match) matches.push(toMatch(match))
    return { matches, truncated }
  }

  while ((match = regex.exec(text)) !== null) {
    matches.push(toMatch(match))
    if (matches.length >= limit) {
      truncated = true
      break
    }
    if (match[0].length === 0) {
      regex.lastIndex += 1
      // sticky/unicode 组合在末尾可能越过长度，交给下一轮 exec 返回 null
      if (regex.lastIndex > text.length) break
    }
  }

  return { matches, truncated }
}

function toMatch(match: RegExpExecArray): RegexMatch {
  const groups: RegexGroup[] = []
  for (let index = 1; index < match.length; index += 1) {
    groups.push({ index, value: match[index] })
  }
  if (match.groups) {
    for (const [name, value] of Object.entries(match.groups)) {
      groups.push({ index: groups.length + 1, name, value })
    }
  }
  return {
    index: match.index,
    end: match.index + match[0].length,
    value: match[0],
    groups,
  }
}

/** 按匹配位置切段，交给 React 渲染成普通 span，不用 dangerouslySetInnerHTML */
export function highlightParts(text: string, matches: readonly RegexMatch[]): HighlightPart[] {
  const parts: HighlightPart[] = []
  let cursor = 0
  for (let index = 0; index < matches.length; index += 1) {
    const item = matches[index]
    if (item.index < cursor) continue
    if (item.index > cursor) parts.push({ text: text.slice(cursor, item.index) })
    // 零宽匹配没有可见文本，但仍要留一个标记，否则用户不知道它命中在哪
    parts.push({ text: item.value || '∅', matchIndex: index })
    cursor = item.end
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor) })
  return parts
}

/** 替换预览：没勾 g 时只替换第一处，和浏览器 String.replace 的行为一致 */
export function replacePreview(
  pattern: string,
  flags: string,
  text: string,
  replacement: string,
): string {
  const regex = compileRegex(pattern, flags)
  return text.replace(regex, replacement)
}

/** 把匹配列表拼成一段可复制的文本，组之间用制表符隔开 */
export function matchesToText(matches: readonly RegexMatch[]): string {
  return matches
    .map((match, index) => {
      const groups = match.groups
        .filter((group) => group.value !== undefined)
        .map((group) => `${group.name ? `${group.name}=` : ''}${group.value}`)
        .join('\t')
      return `${index + 1}\t${match.index}\t${match.value}${groups ? `\t${groups}` : ''}`
    })
    .join('\n')
}
