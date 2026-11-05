export const APP_ROUTES = {
  home: '/',
  wiki: '/wiki',
  profile: '/profile',
  lab: '/lab',
} as const

/** 判断路径是否属于需要从 404 兜底中恢复的应用内深链 */
export function isKnownDeepLink(path: string): boolean {
  return (
    path === APP_ROUTES.wiki ||
    path.startsWith(`${APP_ROUTES.wiki}/`) ||
    path === APP_ROUTES.profile ||
    path === APP_ROUTES.lab
  )
}
