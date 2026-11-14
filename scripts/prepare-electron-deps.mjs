// electron-builder実行前に、配布アプリに同梱する本番専用のnode_modulesを
// 別ディレクトリ（.electron-deps/）に用意するスクリプト。
//
// リポジトリ直下のnode_modulesにはelectron/electron-builder/vitest等の開発専用
// パッケージが大量に含まれており、そのまま同梱すると配布サイズが無駄に膨らむため、
// package.json/package-lock.jsonだけをコピーした上で`npm ci --omit=dev`を実行し、
// 本番依存のみをインストールし直す。
//
// さらに、canvasパッケージはネイティブアドオンであり、通常のnpm installでは
// システムのNode.js向けにビルド/取得されるが、Electron同梱のNodeはABIが異なるため、
// @electron/rebuildでElectronのバージョンに合わせて再ビルドする。
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const STAGE_DIR = path.resolve('.electron-deps');

fs.rmSync(STAGE_DIR, { recursive: true, force: true });
fs.mkdirSync(STAGE_DIR, { recursive: true });
fs.copyFileSync('package.json', path.join(STAGE_DIR, 'package.json'));
fs.copyFileSync('package-lock.json', path.join(STAGE_DIR, 'package-lock.json'));

console.log('[prepare-electron-deps] npm ci --omit=dev');
execSync('npm ci --omit=dev --no-audit --no-fund', { cwd: STAGE_DIR, stdio: 'inherit' });

const electronVersion = JSON.parse(
  fs.readFileSync(path.join('node_modules', 'electron', 'package.json'), 'utf-8'),
).version;

console.log(`[prepare-electron-deps] canvasをElectron ${electronVersion} 向けに再ビルド`);
execSync(
  `npx electron-rebuild --force --version ${electronVersion} --module-dir ${STAGE_DIR} --which-module canvas`,
  { stdio: 'inherit' },
);

console.log('[prepare-electron-deps] 完了');
