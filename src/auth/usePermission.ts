import { useAuth } from '@/auth/AuthProvider'

export interface PermissionApi {
  /** 当前账号的权限码（未登录或后端未下发时为空数组） */
  permissions: string[]
  /** 是否拥有某个权限码 */
  has: (code: string) => boolean
  /** 是否拥有其中任意一个权限码 */
  hasAny: (...codes: string[]) => boolean
}

/** 权限判断统一出口：只认后端下发的 permissions，不在前端推断角色 */
export function usePermission(): PermissionApi {
  const { permissions } = useAuth()

  return {
    permissions,
    has: (code: string) => permissions.includes(code),
    hasAny: (...codes: string[]) => codes.some((code) => permissions.includes(code)),
  }
}
