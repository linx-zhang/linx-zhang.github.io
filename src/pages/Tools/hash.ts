import type { IHasher } from 'hash-wasm'

/** 一次读多少字节。8MB 在慢盘上单次读取约几十毫秒，够细的进度粒度又不至于把主线程切碎 */
export const CHUNK_SIZE = 8 * 1024 * 1024

export const HASH_ALGORITHMS = [
  { value: 'md5', label: 'MD5', hexLength: 32 },
  { value: 'sha1', label: 'SHA-1', hexLength: 40 },
  { value: 'sha256', label: 'SHA-256', hexLength: 64 },
  { value: 'sha512', label: 'SHA-512', hexLength: 128 },
] as const

export type HashAlgorithm = (typeof HASH_ALGORITHMS)[number]['value']

export type HashResults = Partial<Record<HashAlgorithm, string>>

/** hash-wasm 按需加载：本工具自己就是懒加载分块，但 WASM 仍然等真正算哈希时才拉 */
let wasmModule: Promise<typeof import('hash-wasm')> | null = null

function loadHashWasm(): Promise<typeof import('hash-wasm')> {
  wasmModule ??= import('hash-wasm')
  return wasmModule
}

async function createHasher(algorithm: HashAlgorithm): Promise<IHasher> {
  const w = await loadHashWasm()
  const hasher = await (algorithm === 'md5'
    ? w.createMD5()
    : algorithm === 'sha1'
      ? w.createSHA1()
      : algorithm === 'sha256'
        ? w.createSHA256()
        : w.createSHA512())
  // hash-wasm 的 hasher 需要显式 init，否则空文件 / 首次 update 前的状态不可靠
  return hasher.init()
}

export interface HashOptions {
  chunkSize?: number
  signal?: AbortSignal
  onProgress?: (ratio: number) => void
}

/**
 * 流式计算文件哈希：按 CHUNK_SIZE 切片读取，逐块喂给所有算法。
 * 不把整个文件读进内存，几百 MB 到几 GB 的文件内存占用都一样。
 */
export async function hashFile(
  file: File,
  algorithms: readonly HashAlgorithm[],
  options: HashOptions = {},
): Promise<HashResults> {
  const results: HashResults = {}
  if (!algorithms.length) return results

  const chunkSize = options.chunkSize ?? CHUNK_SIZE
  const hashers = await Promise.all(algorithms.map(createHasher))
  const size = file.size
  let offset = 0

  if (size === 0) {
    // 空文件：不用进循环，直接出值（d41d8cd9… 这类是校验里最常见的对照样本）
    options.onProgress?.(1)
  }

  while (offset < size) {
    if (options.signal?.aborted) {
      throw new DOMException('已取消', 'AbortError')
    }
    const end = Math.min(offset + chunkSize, size)
    const buffer = await file.slice(offset, end).arrayBuffer()
    const bytes = new Uint8Array(buffer)
    for (const hasher of hashers) hasher.update(bytes)
    offset = end
    options.onProgress?.(offset / size)
  }

  algorithms.forEach((algorithm, index) => {
    results[algorithm] = hashers[index].digest('hex')
  })
  return results
}

/** 118.4 MB / 512 B：三位有效数字就够看，再多反而干扰朗读 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value >= 100 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`
}

const pad = (value: number): string => String(value).padStart(2, '0')

/** 文件修改时间按本地时区展示；站内存储口径仍是 UTC，这里只是给人的可读时间 */
export function formatFileTime(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '未知'
  const date = new Date(ms)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/**
 * 把用户粘进来的各种哈希格式洗成一个纯小写十六进制串。
 * 认得的写法：`e3b0…`、`SHA256: e3b0…`、`e3b0…  file.zip`、`e3b0… *file.zip`、
 * certutil 那种每两个字符带空格的输出。
 */
export function normalizeHash(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  const squeezed = trimmed.replace(/\s+/g, '').replace(/^\*/, '').toLowerCase()
  const knownLength = HASH_ALGORITHMS.some((item) => item.hexLength === squeezed.length)
  if (/^[0-9a-f]+$/.test(squeezed) && knownLength) return squeezed

  const firstToken = trimmed.split(/\s+/).find((token) => /^[0-9a-fA-F]{16,}$/.test(token.replace(/^\*/, '')))
  return firstToken ? firstToken.replace(/^\*/, '').toLowerCase() : ''
}

export interface VerifyHit {
  algorithm: HashAlgorithm
  label: string
}

/** 拿粘贴的哈希去比对一个文件的结果；返回命中的算法（没命中返回 null） */
export function verifyHash(raw: string, results: HashResults): VerifyHit | null {
  const wanted = normalizeHash(raw)
  if (!wanted) return null
  for (const item of HASH_ALGORITHMS) {
    if (results[item.value] && results[item.value] === wanted) {
      return { algorithm: item.value, label: item.label }
    }
  }
  return null
}
