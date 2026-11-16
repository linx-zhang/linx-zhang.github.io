import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// 与 vite.config.ts 共用同一套别名，测试里引用 `@/...` 和线上代码一致。
// 单独成文件而不是塞进 vite.config.ts：构建配置要尽量少，别让测试环境的东西
// 混进 `npm run build` 的解析路径。
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
