/**
 * 「能进管理后台」的判据。
 *
 * 管理后台是一个容器，里面的分区各管各的：文章、用户、日志、分析、邀请码分别校验
 * 自己的权限码。所以进入后台不能绑在某一个分区上——早先这里挂的是
 * `invite_code:read:any`，只要出现一个「能管用户、管不了邀请码」的角色，前台连
 * 「管理后台」这个入口都不会出现，后台也就进不去。
 *
 * 这里列出的是后台里**真正能管到东西**的码：拥有其中任意一个，就有事可做。
 * 各分区的可见性仍由 Admin 的 TABS 表逐个判断，服务端另有权威校验。
 */
export const ADMIN_AREA_PERMISSIONS = [
  'post:update:any',
  'post:delete:any',
  'user:read:any',
  'activity:read:any',
  'invite_code:read:any',
  'resume:manage:any',
] as const
