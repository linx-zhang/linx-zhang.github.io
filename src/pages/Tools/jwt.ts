/** JWT 只做解码展示，不校验签名、不访问网络。 */

export interface JwtParts {
  header: unknown
  payload: unknown
  signature: string
  headerText: string
  payloadText: string
}

export interface JwtTimes {
  issuedAt?: Date
  notBefore?: Date
  expiresAt?: Date
  expired: boolean
  notYetValid: boolean
  remainingMs?: number
}

export const JWT_SAMPLE =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkZW1vLXVzZXIiLCJuYW1lIjoiTGluIFpoYW5nIiwiaXNzIjoibGlu' +
  'eC16aGFuZy5naXRodWIuaW8iLCJyb2xlIjoiYmFja2VuZCIsImlhdCI6MTcwMDAwMDAwMCwiZXhwIjoxNzAwMDAzNjAwfQ.demo-signature'

const NAMED_CLAIMS: Array<{ key: string; label: string; time?: boolean }> = [
  { key: 'iss', label: '签发方 iss' },
  { key: 'sub', label: '主体 sub' },
  { key: 'aud', label: '受众 aud' },
  { key: 'iat', label: '签发时间 iat', time: true },
  { key: 'nbf', label: '生效时间 nbf', time: true },
  { key: 'exp', label: '过期时间 exp', time: true },
  { key: 'jti', label: '编号 jti' },
]

function decodeBase64Url(part: string): string {
  const normalized = part.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
}

function parseJsonObject(text: string, label: string): unknown {
  try {
    return JSON.parse(text) as unknown
  } catch (err) {
    throw new Error(`${label} 不是合法 JSON：${err instanceof Error ? err.message : String(err)}`)
  }
}

/** 去掉 Bearer 前缀和空白，避免用户从 Authorization 头里整段粘过来时被拒 */
export function cleanToken(raw: string): string {
  return raw.trim().replace(/^Bearer\s+/i, '').replace(/\s+/g, '')
}

export function decodeJwt(raw: string): JwtParts {
  const token = cleanToken(raw)
  if (!token) throw new Error('先粘一个 JWT')
  const segments = token.split('.')
  if (segments.length === 5) {
    throw new Error('这是 JWE（5 段加密令牌），这里只解析普通 JWT 的 3 段结构')
  }
  if (segments.length !== 3) {
    throw new Error(`JWT 应该是 3 段、用点分隔，现在有 ${segments.length} 段`)
  }

  const [headerPart, payloadPart, signature] = segments
  const headerText = decodeBase64Url(headerPart)
  const payloadText = decodeBase64Url(payloadPart)
  return {
    header: parseJsonObject(headerText, 'Header'),
    payload: parseJsonObject(payloadText, 'Payload'),
    headerText,
    payloadText,
    signature,
  }
}

export function prettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

/** 只读 claim 的数字；JWT 规范里这些字段是「秒」而不是毫秒 */
function claimSeconds(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

export function claimTimes(payload: unknown, now = Date.now()): JwtTimes {
  const claims =
    payload && typeof payload === 'object' && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : {}
  const iat = claimSeconds(claims.iat)
  const nbf = claimSeconds(claims.nbf)
  const exp = claimSeconds(claims.exp)
  const issuedAt = iat === undefined ? undefined : new Date(iat * 1000)
  const notBefore = nbf === undefined ? undefined : new Date(nbf * 1000)
  const expiresAt = exp === undefined ? undefined : new Date(exp * 1000)
  return {
    issuedAt,
    notBefore,
    expiresAt,
    expired: expiresAt ? expiresAt.getTime() <= now : false,
    notYetValid: notBefore ? notBefore.getTime() > now : false,
    remainingMs: expiresAt ? expiresAt.getTime() - now : undefined,
  }
}

export function claimRows(payload: unknown): Array<{ key: string; label: string; value: string; time?: boolean }> {
  const claims =
    payload && typeof payload === 'object' && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : {}
  return NAMED_CLAIMS.filter((item) => claims[item.key] !== undefined).map((item) => ({
    ...item,
    value: formatClaim(claims[item.key]),
  }))
}

export function formatClaim(value: unknown): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) return value.map((item) => formatClaim(item)).join(', ')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

const pad = (value: number) => String(value).padStart(2, '0')

export function formatLocalTime(date: Date | undefined): string {
  if (!date || Number.isNaN(date.getTime())) return '—'
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

export function remainingText(ms: number | undefined): string {
  if (ms === undefined) return '没有 exp（不会按过期时间失效）'
  if (ms <= 0) return '已过期'
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 60) return `还剩 ${minutes} 分钟`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `还剩 ${hours} 小时`
  return `还剩 ${Math.floor(hours / 24)} 天`
}
