// 构建 docs/ 产物。
// 为什么不直接 `vite build --outDir docs`：这台 Windows 上 docs/assets/index-*.js
// 这个位置曾被安全软件锁过（写同名文件一律 Access denied / os error 5），
// 所以先生成到临时目录 docs_build，再整目录替换，避免撞上被锁的文件名。
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, renameSync, rmSync, writeFileSync } from 'node:fs';
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

/** 同步小睡：脚本是顺序执行的，这里不需要异步重排 */
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

/**
 * 目录重命名的重试封装。
 * Windows 上只要还有进程（dev server 的 watcher、杀毒扫描）开着目录里的文件，
 * rename 就会抛 EPERM/EBUSY；等它松手比让构建整体失败更划算。
 */
function renameWithRetry(from, to, attempts = 10) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      renameSync(from, to);
      return;
    } catch (error) {
      const retryable = ['EPERM', 'EBUSY', 'EACCES', 'ENOTEMPTY'].includes(error.code);
      if (!retryable) throw error;
      lastError = error;
      sleep(150 * (attempt + 1));
    }
  }
  throw lastError;
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

  // GitHub Pages 默认会跑 Jekyll，把 docs/wiki 下的 .md 再渲染成 .html（同名 URL 会命中 Jekyll 版本，
  // 排版和站内不一致，还多出一份产物）。.nojekyll 关掉 Jekyll，让站点只发原始静态文件。
  writeFileSync(join(STAGE, '.nojekyll'), '');
  console.log('  ✓ docs/.nojekyll');

  if (existsSync(TRASH)) rmSync(TRASH, { recursive: true, force: true });

  // dev server 开着时它 watch 着 docs/，目录重命名会偶发 EPERM；
  // 所以每一次替换都带重试，并且「旧目录已挪走、新目录没接上」时一定还原，
  // 绝不让仓库停在没有 docs/ 的状态（docs/ 是提交进仓的产物）。
  let movedOld = false;
  if (existsSync(TARGET)) {
    renameWithRetry(TARGET, TRASH);
    movedOld = true;
  }
  try {
    renameWithRetry(STAGE, TARGET);
  } catch (error) {
    if (movedOld) {
      try {
        renameWithRetry(TRASH, TARGET);
        console.warn('  ! 新产物就位失败，已还原上一版 docs/');
      } catch {
        console.warn('  ! 新产物就位失败，旧产物留在 .docs-trash，需手工恢复');
      }
    }
    throw error;
  }
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
