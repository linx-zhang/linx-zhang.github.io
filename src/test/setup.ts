import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

/**
 * React 要求测试环境显式声明「我在 act 环境里」，否则 renderHook/act 会告警。
 * 这个全局标志只在测试里存在，生产代码不引用。
 */
declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true

/**
 * jsdom 没有实现 scrollIntoView，而下拉面板 / 日历面板打开时会对当前项调用它。
 * 缺了这一步，任何渲染 Select 的用例都会以 TypeError 结束。
 */
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}

afterEach(() => {
  cleanup()
  window.localStorage.clear()
})
