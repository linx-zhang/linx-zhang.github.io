// 构建 docs/ 产物。
// 为什么不直接 `vite build --outDir docs`：这台 Windows 上 docs/assets/index-*.js
// 这个位置曾被安全软件锁过（写同名文件一律 Access denied / os error 5），
// 所以先生成到临时目录 docs_build，再整目录替换，避免撞上被锁的文件名。
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const STAGE = join(ROOT, 'docs_build');
const TARGET = join(ROOT, 'docs');
const TRASH = join(ROOT, '.docs-trash');

function run(args) {
  const result = spawnSync(process.execPath, args, { cwd: ROOT, stdio: 'inherit' });
  if (result.status !== 0) {
    throw new Error(`命令失败: node ${args.join(' ')}`);
  }
}

function check(relPath) {
  const full = join(STAGE, relPath);
  if (!existsSync(full)) throw new Error(`临时产物缺少 ${relPath}`);
  return full;
}

try {
  run([join('scripts', 'build-wiki.mjs')]);
  run([
    join('node_modules', 'vite', 'bin', 'vite.js'),
    'build',
    '--outDir',
    'docs_build',
    '--emptyOutDir',
  ]);

  check('index.html');
  check(join('wiki', 'index.json'));
  const assets = join(STAGE, 'assets');
  if (!existsSync(assets)) throw new Error('临时产物缺少 assets/');
  if (!existsSync(join(STAGE, 'wiki'))) throw new Error('临时产物缺少 wiki/');

  // GitHub Pages 对没有 index.html 的目录会直接返回同名静态文件（/wiki → wiki/index.json），
  // 所以把 SPA 入口复制成 docs/wiki/index.html，让 /wiki 正常进 React。
  copyFileSync(join(STAGE, 'index.html'), join(STAGE, 'wiki', 'index.html'));
  console.log('  ✓ docs/wiki/index.html ← docs/index.html');

  if (existsSync(TRASH)) rmSync(TRASH, { recursive: true, force: true });
  if (existsSync(TARGET)) renameSync(TARGET, TRASH);
  renameSync(STAGE, TARGET);
  try {
    rmSync(TRASH, { recursive: true, force: true });
  } catch {
    console.warn('  ! 旧产物目录未删净（有文件被占用），已保留为 .docs-trash，可稍后手动删除');
  }

  console.log('  ✓ docs/ 已更新');
} catch (error) {
  console.error('构建 docs/ 失败:', error.message);
  process.exit(1);
}
