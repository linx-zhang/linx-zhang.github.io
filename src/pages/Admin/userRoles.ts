import type { UserRole } from '@/api/admin'

export const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'user', label: '普通用户（user）' },
  { value: 'internal', label: '内部用户（internal）' },
  { value: 'admin', label: '管理员（admin）' },
]

export const FILTER_OPTIONS = [{ value: '', label: '全部角色' }, ...ROLE_OPTIONS]

export function roleLabel(role: string): string {
  return ROLE_OPTIONS.find((item) => item.value === role)?.label ?? role
}
