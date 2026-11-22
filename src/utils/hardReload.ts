/**
 * 「重新加载」要真的换掉旧资源，而不是把缓存里的旧 HTML/CSS 再放一遍。
 *
 * 浏览器不给脚本清 HTTP 磁盘缓存的权限，所以这里做两件能做的事：
 * 1. 清 Cache Storage（Service Worker / 离线缓存留下的那份）；
 * 2. 在 URL 上加一次性参数再 replace，让 HTML 走新请求，
 *    hash 化的 JS/CSS 自然跟着换成新版本。
 *
 * 不动 localStorage / cookie，登录态不会因此丢失。
 */
export function buildHardReloadUrl(href: string, stamp: number): string {
  const url = new URL(href)
  url.searchParams.set('_r', stamp.toString(36))
  return url.toString()
}

async function clearRuntimeCaches(): Promise<void> {
  if (!('caches' in window)) return
  try {
    const keys = await caches.keys()
    await Promise.all(keys.map((key) => caches.delete(key)))
  } catch {
    // 清缓存失败也不能挡着重载：URL 上的 _r 仍然能绕开 HTML 缓存
  }
}

export function hardReload(): void {
  void clearRuntimeCaches().finally(() => {
    window.location.replace(buildHardReloadUrl(window.location.href, Date.now()))
  })
}
