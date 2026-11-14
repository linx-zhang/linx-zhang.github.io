import { ApiError } from '@/api/client'

/**
 * 错误文案的唯一出口。
 *
 * 原则：先看后端返回的 code，再退回 HTTP 状态，绝不按状态猜业务含义。
 * 登录相关的 401 是 invalid_credentials（凭据不对），与 token 失效的 unauthorized 必须分开——
 * 两者混用会让「密码输错」显示成「登录已失效」。
 */

/** 后端业务错误码 → 展示文案；只在 code 稳定且值得定制文案时登记 */
const CODE_MESSAGES: Record<string, string> = {
  invalid_credentials: '邮箱或密码错误',
  unauthorized: '登录状态已失效，请重新登录',
  email_exists: '该邮箱已注册，直接登录即可',
  invalid_email: '邮箱格式不正确',
  invalid_password: '密码长度需为 8–128 个字符',
  invalid_invite_code: '邀请码无效、已过期或已被使用',
  rate_limited: '操作太频繁，请稍后再试',
  validation_error: '提交的内容不符合要求，请检查后重试',
}

/** 网络层失败（DNS / 断网 / CORS 被拦），不是后端返回的业务错误 */
export function isNetworkError(err: unknown): boolean {
  return err instanceof TypeError
}

export function isNotFound(err: unknown): boolean {
  return err instanceof ApiError && err.status === 404
}

/** 页面级错误文案：5xx 统一兜底，403 优先用后端 detail（说明缺哪个权限） */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status >= 500) return '服务暂时不可用，请稍后重试。'
    if (err.code === 'forbidden') return err.detail || '没有权限执行该操作。'
    return err.detail || '请求失败，请稍后重试。'
  }
  if (isNetworkError(err)) return '网络请求失败，请检查连接后重试。'
  return '请求失败，请稍后重试。'
}

/** 登录 / 注册这类「凭据提交」场景：错误码更细，文案要能指导用户下一步动作 */
export function authErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    const mapped = CODE_MESSAGES[err.code]
    if (mapped) return mapped
    if (err.status >= 500) return '服务暂时不可用，请稍后重试'
    return err.detail || '请求失败，请稍后重试'
  }
  if (isNetworkError(err)) return '连不上服务器，请检查网络后重试'
  return '请求失败，请稍后重试'
}
