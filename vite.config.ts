import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    }
  },
  base: '/',
  build: {
    outDir: 'docs',
    emptyOutDir: true,
  },
  server: {
    // docs/ 与中转目录都是构建产物，dev server 不该盯着它们。
    // 不排除的话，构建时「生成 docs_build → 整目录替换 docs」这一步
    // 会撞上 watcher 握着的目录句柄，Windows 直接抛 EPERM（曾把 docs/ 挪空过）。
    watch: {
      ignored: ['**/docs/**', '**/docs_build/**', '**/.docs-trash/**', '**/.cache/**'],
    },
  },
})
