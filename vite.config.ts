import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// Vite 8 底层为 Rolldown：旧的 build.rollupOptions.output.manualChunks 已废弃，
// 且实测会把 react 并入 markdown 分组，这里用等价的 output.codeSplitting.groups 分包。
const reactCoreTest = /node_modules[\\/](react|react-dom|scheduler)[\\/]/
const routerTest = /node_modules[\\/]react-router(-dom)?[\\/]/
const printTest = /node_modules[\\/]react-to-print[\\/]/
const prismTest = /node_modules[\\/](refractor|rehype-prism-plus|parse-numeric-range)[\\/]/
const markdownTest =
  /node_modules[\\/](react-markdown|remark-|hast-util|hastscript|unified|micromark|mdast-|unist-|vfile|trim-lines|devlop|bail|trough|is-plain-obj|zwitch|longest-streak|decode-named-character-reference|character-entities|entities|parse5|property-information|space-separated-tokens|comma-separated-tokens|html-url-attributes|style-to-object|inline-style-parser)[\\/]/
const vendorTest = /node_modules[\\/]/

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
    // 语法高亮链路（refractor 内置全量语言）单块约 620 kB，且仅文档页按需加载
    chunkSizeWarningLimit: 700,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'react-core', test: reactCoreTest, priority: 100 },
            { name: 'router', test: routerTest, priority: 90 },
            { name: 'print', test: printTest, priority: 80 },
            { name: 'prism', test: prismTest, priority: 70 },
            { name: 'markdown', test: markdownTest, priority: 60 },
            { name: 'vendor', test: vendorTest, priority: 10 },
          ],
        },
      },
    },
  }
})
