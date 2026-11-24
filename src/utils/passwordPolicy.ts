/**
 * 设置密码时的前端即时检查。
 *
 * 只做能离线判断的规则：长度、全空白、重复/连续字符。常见密码表只放在后端，
 * 避免把 100KB 的字典塞进首屏；真正的最终裁判仍然是后端 `weak_password`。
 */

export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_MAX_LENGTH = 128

export function passwordIssue(password: string): string | undefined {
  if (password.length < PASSWORD_MIN_LENGTH) return `密码至少 ${PASSWORD_MIN_LENGTH} 位`
  if (password.length > PASSWORD_MAX_LENGTH) return `密码最多 ${PASSWORD_MAX_LENGTH} 位`
  if (!password.trim()) return '密码不能全是空白'

  const lower = password.toLowerCase()
  if (new Set(lower).size === 1) return '密码不能是重复字符'

  const diffs = new Set<number>()
  for (let index = 1; index < lower.length; index += 1) {
    diffs.add(lower.charCodeAt(index) - lower.charCodeAt(index - 1))
  }
  if (diffs.size === 1 && (diffs.has(1) || diffs.has(-1))) {
    return '密码不能是连续字符'
  }

  return undefined
}
