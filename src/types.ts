/**
 * 跨层共享的数据契约类型。
 *
 * 放在这里而不是 hooks 里：api 层只依赖契约类型，不依赖具体的 React 状态实现，
 * 避免出现「api → hooks」这种反向依赖（hooks 依赖 api 的数据形状，二者只共享本文件）。
 */

/** 列表状态机：missing 表示接口/资源不存在（404），与真正的失败区分开 */
export type ListStatus = 'loading' | 'ready' | 'error' | 'missing'

/** 列表接口统一形状：服务端多取一条判断 has_next，需要总数的接口再带 total */
export interface Page<T> {
  items: T[]
  has_next: boolean
  total?: number
}
