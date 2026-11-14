/**
 * 前后端共用的契约常量：前端只在这里写一次，页面与组件统一引用。
 *
 * 每一条都对应后端的一处约束（api-worker: src/api/models.py / deps.py / routers/*）。
 * 改这里之前先确认后端已改，否则会出现「前端放行、后端 422」或「前端截断、后端没收」的静默不一致。
 */

/** 列表分页大小；与后端 deps 的分页默认值保持 20 */
export const PAGE_SIZE = 20

/** 备忘录正文上限：backend MEMO_BODY_MAX */
export const MEMO_BODY_MAX = 2000

/** 文章标题上限：backend PostTitle */
export const POST_TITLE_MAX = 200

/** 评论正文上限：backend CommentBody */
export const COMMENT_BODY_MAX = 5000

/** 共享剪切板：标题 / 正文上限（backend clips router） */
export const CLIP_TITLE_MAX = 80
export const CLIP_BODY_MAX = 20_000

/** 活跃事件批量上限：登录端点 50（backend MAX_BATCH），匿名端点 20 */
export const ACTIVITY_MAX_BATCH = 50
export const ACTIVITY_MAX_VISITOR_BATCH = 20
/** 心跳间隔 */
export const ACTIVITY_HEARTBEAT_MS = 60_000
/** 匿名写入窗口；与 backend VISITOR_RATE_LIMIT_SECONDS 一致 */
export const ACTIVITY_VISITOR_WINDOW_MS = 30_000

/** 批量删除单次最大条数（backend batch-delete 上限） */
export const BATCH_DELETE_MAX = 50
