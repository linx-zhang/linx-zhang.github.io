export interface AvatarUser {
  nickname?: string | null
  first_name?: string | null
  last_name?: string | null
  email?: string | null
  avatar_url?: string | null
}

/**
 * 展示名优先级：昵称 → 「名 姓」→ 邮箱。
 * 头像首字母取同一个显示名的首字符，保证各处一致。
 */
export function displayName(user: AvatarUser | null | undefined): string {
  if (!user) return ''
  const nickname = user.nickname?.trim()
  if (nickname) return nickname
  const fullName = [user.first_name, user.last_name]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(' ')
  if (fullName) return fullName
  return user.email?.trim() ?? ''
}

export function initialOf(value: string | null | undefined): string {
  const trimmed = value?.trim() ?? ''
  return trimmed ? trimmed.charAt(0).toUpperCase() : '?'
}
