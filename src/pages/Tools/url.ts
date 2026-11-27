/** URL 解析与编解码的纯函数，组件只负责表格编辑和状态。 */

export interface QueryParam {
  key: string
  value: string
  enabled: boolean
}

export interface ParsedUrl {
  base: string
  params: QueryParam[]
  hash: string
  error: string
}

export const EMPTY_PARSE: ParsedUrl = { base: '', params: [], hash: '', error: '' }

/** `+` 在 query 里通常代表空格；解不开的百分号编码原样保留，不替用户猜 */
function decodeQueryPart(raw: string): { value: string; error: string } {
  try {
    return { value: decodeURIComponent(raw.replace(/\+/g, ' ')), error: '' }
  } catch {
    return { value: raw, error: 'URL 里有不完整的百分号编码' }
  }
}

/**
 * 支持三种输入：
 * - 完整 URL：https://host/path?a=1#x
 * - 只有 query：?a=1&b=2 或 a=1&b=2
 * - 只有路径：/path（没有 query 时原样作为 base）
 */
export function parseUrl(raw: string): ParsedUrl {
  const text = raw.trim()
  if (!text) return EMPTY_PARSE

  let hash = ''
  let withoutHash = text
  const hashIndex = text.indexOf('#')
  if (hashIndex >= 0) {
    hash = text.slice(hashIndex + 1)
    withoutHash = text.slice(0, hashIndex)
  }

  let base = ''
  let query = ''
  const questionIndex = withoutHash.indexOf('?')
  if (questionIndex >= 0) {
    base = withoutHash.slice(0, questionIndex)
    query = withoutHash.slice(questionIndex + 1)
  } else if (text.startsWith('?') || withoutHash.includes('=') || withoutHash.includes('&')) {
    // 只粘了一段 query：把整段当参数，base 留空
    base = ''
    query = withoutHash.startsWith('?') ? withoutHash.slice(1) : withoutHash
  } else {
    base = withoutHash
  }

  let error = ''
  const params: QueryParam[] = []
  if (query) {
    for (const pair of query.split('&')) {
      if (!pair) continue
      const equals = pair.indexOf('=')
      const rawKey = equals >= 0 ? pair.slice(0, equals) : pair
      const rawValue = equals >= 0 ? pair.slice(equals + 1) : ''
      const key = decodeQueryPart(rawKey)
      const value = decodeQueryPart(rawValue)
      if (key.error || value.error) error = key.error || value.error
      params.push({ key: key.value, value: value.value, enabled: true })
    }
  }

  return { base, params, hash, error }
}

/** 按 query 规则编码：空格用 %20，保留用户可读性；键值里的 + 会被编码成 %2B */
export function encodeQueryPart(value: string): string {
  return encodeURIComponent(value).replace(/%20/g, '%20')
}

export function buildUrl(parsed: Pick<ParsedUrl, 'base' | 'params' | 'hash'>, includeEmpty = true): string {
  const enabled = parsed.params.filter((param) => param.enabled)
  const query = enabled
    .map((param) => {
      if (!includeEmpty && !param.value) return encodeQueryPart(param.key)
      return `${encodeQueryPart(param.key)}=${encodeQueryPart(param.value)}`
    })
    .join('&')
  const hash = parsed.hash ? `#${parsed.hash}` : ''
  return `${parsed.base}${query ? `?${query}` : ''}${hash}`
}

export type UrlCodecMode = 'component' | 'uri'

export interface CodecResult {
  value: string
  error: string
}

export function encodeText(text: string, mode: UrlCodecMode): CodecResult {
  try {
    return { value: mode === 'component' ? encodeURIComponent(text) : encodeURI(text), error: '' }
  } catch (err) {
    return { value: '', error: `编码失败：${err instanceof Error ? err.message : String(err)}` }
  }
}

export function decodeText(text: string, mode: UrlCodecMode): CodecResult {
  try {
    return { value: mode === 'component' ? decodeURIComponent(text) : decodeURI(text), error: '' }
  } catch (err) {
    return { value: '', error: `解码失败：${err instanceof Error ? err.message : String(err)}` }
  }
}
