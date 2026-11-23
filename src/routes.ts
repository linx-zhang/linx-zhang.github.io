export const APP_ROUTES = {
  home: '/',
  wiki: '/wiki',
  blog: '/blog',
  profile: '/profile',
  /** 简历分享短链前缀：/r/<code>，code 由后端签发 */
  resumeShare: '/r',
  space: '/space',
  tools: '/tools',
  admin: '/admin',
} as const

/** 判断路径是否属于需要从 404 兜底中恢复的应用内深链（忽略 query / hash） */
export function isKnownDeepLink(path: string): boolean {
  const pathname = path.split(/[?#]/)[0]
  return (
    pathname === APP_ROUTES.wiki ||
    pathname.startsWith(`${APP_ROUTES.wiki}/`) ||
    pathname === APP_ROUTES.blog ||
    pathname.startsWith(`${APP_ROUTES.blog}/`) ||
    pathname === APP_ROUTES.tools ||
    pathname.startsWith(`${APP_ROUTES.tools}/`) ||
    pathname === APP_ROUTES.admin ||
    pathname === APP_ROUTES.profile ||
    pathname.startsWith(`${APP_ROUTES.resumeShare}/`) ||
    pathname === APP_ROUTES.space ||
    pathname.startsWith(`${APP_ROUTES.space}/`)
  )
}
