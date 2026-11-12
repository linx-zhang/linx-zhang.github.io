// GitHub Pages 对没有 index.html 的目录会直接返回同名静态文件（/wiki → wiki/index.json）。
// 这里把构建好的 SPA 入口复制成 docs/wiki/index.html，让 /wiki 正常进入 React 目录页。
import { copyFile, access } from 'node:fs/promises';

const OUT_DIR = 'docs';

async function main() {
  const entry = `${OUT_DIR}/index.html`;
  const target = `${OUT_DIR}/wiki/index.html`;

  await access(entry);
  await access(`${OUT_DIR}/wiki/index.json`);
  await copyFile(entry, target);
  console.log(`  ✓ ${target} ← ${entry}`);
}

main().catch((error) => {
  console.error('复制 wiki 入口失败:', error);
  process.exit(1);
});
