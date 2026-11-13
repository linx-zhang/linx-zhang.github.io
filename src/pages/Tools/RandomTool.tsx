import { useCallback, useMemo, useState } from 'react'

/** 取 [0, max) 的随机整数：拒绝采样，避免取模偏斜 */
function randomBelow(max: number): number {
  if (max <= 1) return 0
  const buf = new Uint32Array(1)
  const limit = Math.floor(0x100000000 / max) * max
  let value = 0
  do {
    crypto.getRandomValues(buf)
    value = buf[0]
  } while (value >= limit)
  return value % max
}

const HEX = '0123456789abcdef'

function uuidV4(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  return formatUuid(bytes)
}

/** UUIDv7：前 48 位是毫秒时间戳，天然按时间排序，适合做 DB 主键 */
function uuidV7(): string {
  const bytes = new Uint8Array(16)
  const now = Date.now()
  let rest = now
  for (let i = 5; i >= 0; i -= 1) {
    bytes[i] = rest % 256
    rest = Math.floor(rest / 256)
  }
  const random = crypto.getRandomValues(new Uint8Array(10))
  bytes[6] = (random[0] & 0x0f) | 0x70
  bytes[7] = random[1]
  bytes[8] = (random[2] & 0x3f) | 0x80
  for (let i = 9; i < 16; i += 1) bytes[i] = random[i - 6]
  return formatUuid(bytes)
}

function formatUuid(bytes: Uint8Array): string {
  let hex = ''
  for (let i = 0; i < bytes.length; i += 1) {
    hex += HEX[bytes[i] >> 4] + HEX[bytes[i] & 0x0f]
  }
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

const PASSWORD_SETS = {
  lower: { label: '小写 a-z', chars: 'abcdefghijklmnopqrstuvwxyz' },
  upper: { label: '大写 A-Z', chars: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' },
  digits: { label: '数字 0-9', chars: '0123456789' },
  symbols: { label: '符号 !@#$%', chars: '!@#$%^&*()-_=+[]{};:,.?/' },
} as const

type SetKey = keyof typeof PASSWORD_SETS

/** 容易被认错的字符：0/O、1/l/I、5/S、2/Z、8/B，再加上引号类符号 */
const AMBIGUOUS = '0Oo1lI|5S2Z8B`\'"~'

interface PasswordOptions {
  length: number
  sets: Record<SetKey, boolean>
  avoidAmbiguous: boolean
  requireEach: boolean
}

function buildPassword(options: PasswordOptions): { password: string; poolSize: number; chars: string[] } {
  const chars: string[] = []
  const required: string[] = []

  for (const key of Object.keys(PASSWORD_SETS) as SetKey[]) {
    if (!options.sets[key]) continue
    const filtered = [...PASSWORD_SETS[key].chars].filter(
      (ch) => !options.avoidAmbiguous || !AMBIGUOUS.includes(ch),
    )
    if (filtered.length === 0) continue
    chars.push(...filtered)
    required.push(filtered[randomBelow(filtered.length)])
  }

  if (chars.length === 0) return { password: '', poolSize: 0, chars }

  const length = Math.max(options.length, options.requireEach ? required.length : 0)
  const password: string[] = options.requireEach ? [...required] : []
  while (password.length < length) password.push(chars[randomBelow(chars.length)])

  // 洗一遍，免得必选字符总堆在开头
  for (let i = password.length - 1; i > 0; i -= 1) {
    const j = randomBelow(i + 1)
    const tmp = password[i]
    password[i] = password[j]
    password[j] = tmp
  }

  return { password: password.join(''), poolSize: chars.length, chars }
}

function strengthOf(length: number, poolSize: number): { label: string; bits: number } {
  if (poolSize <= 1) return { label: '空', bits: 0 }
  const bits = Math.round(length * Math.log2(poolSize))
  if (bits < 45) return { label: '弱', bits }
  if (bits < 80) return { label: '中', bits }
  if (bits < 120) return { label: '强', bits }
  return { label: '很强', bits }
}

export default function RandomTool() {
  const [version, setVersion] = useState<'v4' | 'v7'>('v4')
  const [count, setCount] = useState(3)
  const [uppercase, setUppercase] = useState(false)
  const [hyphenless, setHyphenless] = useState(false)
  const [uuids, setUuids] = useState<string[]>(() => [uuidV4(), uuidV4(), uuidV4()])
  const [uuidCopied, setUuidCopied] = useState('')

  const [length, setLength] = useState(16)
  const [sets, setSets] = useState<Record<SetKey, boolean>>({
    lower: true,
    upper: true,
    digits: true,
    symbols: false,
  })
  const [avoidAmbiguous, setAvoidAmbiguous] = useState(true)
  const [requireEach, setRequireEach] = useState(true)
  const [password, setPassword] = useState('')
  const [poolSize, setPoolSize] = useState(0)
  const [pwCopied, setPwCopied] = useState(false)
  const [pwNote, setPwNote] = useState('')

  const genUuid = useCallback(() => {
    const maker = version === 'v7' ? uuidV7 : uuidV4
    const list = Array.from({ length: count }, () => maker())
    setUuids(list)
  }, [count, version])

  const displayUuids = uuids.map((id) => {
    let shown = hyphenless ? id.replace(/-/g, '') : id
    if (uppercase) shown = shown.toUpperCase()
    return shown
  })

  const genPassword = () => {
    const options: PasswordOptions = { length, sets, avoidAmbiguous, requireEach }
    if (!Object.values(sets).some(Boolean)) {
      setPassword('')
      setPoolSize(0)
      setPwNote('至少勾一个字符集，不然没东西可挑。')
      return
    }
    const result = buildPassword(options)
    setPassword(result.password)
    setPoolSize(result.poolSize)
    setPwNote(
      avoidAmbiguous
        ? `已排除 0/O、1/l/I、5/S、2/Z、8/B 这类易混字符，可选字符 ${result.poolSize} 个。`
        : `可选字符 ${result.poolSize} 个。`,
    )
  }

  const strength = useMemo(() => strengthOf(password.length, poolSize), [password.length, poolSize])
  const canCopyUuid = displayUuids.length > 0

  const copyText = async (text: string, done: () => void) => {
    try {
      await navigator.clipboard.writeText(text)
      done()
      window.setTimeout(() => {
        setUuidCopied('')
        setPwCopied(false)
      }, 1600)
    } catch {
      /* 浏览器不给写剪贴板时，用户仍可手动选中 */
    }
  }

  return (
    <div className="tool tool-stack">
      <section className="tool-block">
        <div className="tool-block-head">
          <h2>UUID</h2>
          <p>按标准格式生成，v4 完全随机；v7 前段带毫秒时间戳，按时间递增，建表当主键更友好。</p>
        </div>

        <div className="tool-bar">
          <label className="tool-inline">
            版本
            <select
              className="tool-select"
              value={version}
              onChange={(event) => setVersion(event.target.value === 'v7' ? 'v7' : 'v4')}
            >
              <option value="v4">v4 · 随机</option>
              <option value="v7">v7 · 时间有序</option>
            </select>
          </label>
          <label className="tool-inline">
            数量
            <select
              className="tool-select"
              value={count}
              onChange={(event) => setCount(Number(event.target.value))}
            >
              {[1, 3, 5, 10].map((value) => (
                <option key={value} value={value}>
                  {value} 个
                </option>
              ))}
            </select>
          </label>
          <label className="tool-check">
            <input
              type="checkbox"
              checked={uppercase}
              onChange={(event) => setUppercase(event.target.checked)}
            />
            大写
          </label>
          <label className="tool-check">
            <input
              type="checkbox"
              checked={hyphenless}
              onChange={(event) => setHyphenless(event.target.checked)}
            />
            去掉连字符
          </label>
          <button type="button" className="tool-button tool-button-primary" onClick={genUuid}>
            生成
          </button>
          <button
            type="button"
            className={uuidCopied === 'all' ? 'tool-button tool-copy is-copied' : 'tool-button tool-copy'}
            disabled={!canCopyUuid}
            onClick={() => copyText(displayUuids.join('\n'), () => setUuidCopied('all'))}
          >
            {uuidCopied === 'all' ? '已复制' : '复制全部'}
          </button>
        </div>

        <ul className="rand-list">
          {displayUuids.map((id, index) => (
            <li key={`${id}-${index}`} className="rand-row">
              <code>{id}</code>
              <button
                type="button"
                className={uuidCopied === `${index}` ? 'tool-mini is-copied' : 'tool-mini'}
                onClick={() => copyText(id, () => setUuidCopied(`${index}`))}
              >
                {uuidCopied === `${index}` ? '已复制' : '复制'}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="tool-block">
        <div className="tool-block-head">
          <h2>密码</h2>
          <p>字符集自己挑，易混字符可以一键排掉；勾了「每类至少一个」，生成结果里每一类都会现身。</p>
        </div>

        <div className="tool-bar">
          <label className="tool-inline">
            长度
            <input
              className="tool-number"
              type="number"
              min={4}
              max={128}
              value={length}
              onChange={(event) => {
                const next = Number(event.target.value)
                setLength(Number.isFinite(next) ? Math.min(128, Math.max(4, next)) : 16)
              }}
            />
          </label>
          {(Object.keys(PASSWORD_SETS) as SetKey[]).map((key) => (
            <label key={key} className="tool-check">
              <input
                type="checkbox"
                checked={sets[key]}
                onChange={(event) => setSets((prev) => ({ ...prev, [key]: event.target.checked }))}
              />
              {PASSWORD_SETS[key].label}
            </label>
          ))}
          <label className="tool-check">
            <input
              type="checkbox"
              checked={avoidAmbiguous}
              onChange={(event) => setAvoidAmbiguous(event.target.checked)}
            />
            排除易混字符
          </label>
          <label className="tool-check">
            <input
              type="checkbox"
              checked={requireEach}
              onChange={(event) => setRequireEach(event.target.checked)}
            />
            每类至少一个
          </label>
          <button type="button" className="tool-button tool-button-primary" onClick={genPassword}>
            生成密码
          </button>
        </div>

        {pwNote && <p className="tool-note">{pwNote}</p>}

        {password && (
          <div className="pw-output">
            <code>{password}</code>
            <div className="pw-side">
              <span className={`pw-strength pw-strength-${strength.label}`}>
                {strength.label} · 约 {strength.bits} bit
              </span>
              <button
                type="button"
                className={pwCopied ? 'tool-button tool-copy is-copied' : 'tool-button tool-copy'}
                onClick={() =>
                  copyText(password, () => {
                    setPwCopied(true)
                  })
                }
              >
                {pwCopied ? '已复制' : '复制密码'}
              </button>
            </div>
          </div>
        )}

        {!password && (
          <p className="tool-empty">
            上面勾好字符集，点「生成密码」。第一次点之前这里是空的，因为不想替你随机一个不能用的。
          </p>
        )}
      </section>
    </div>
  )
}
