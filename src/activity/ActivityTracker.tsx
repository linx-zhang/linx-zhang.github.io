import { useActivityTracker } from './useActivityTracker'

/** 挂在 AuthProvider 内部：登录后开始采集页面活跃事件。 */
export default function ActivityTracker() {
  useActivityTracker()
  return null
}
