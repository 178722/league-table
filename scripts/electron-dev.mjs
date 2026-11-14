// Electronの開発用起動スクリプト。
// `next dev`をバックグラウンドで起動し、起動確認後にElectronをそのポートに向けて起動する。
// concurrently等の追加パッケージを使わず、子プロセスの起動・終了連携のみで完結させる。
import { spawn } from 'node:child_process';
import net from 'node:net';
import electronPath from 'electron';

function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function waitForServerReady(port, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`http://localhost:${port}/login`);
      if (res.status) return true;
    } catch {
      // まだ起動していない
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

const port = await findFreePort();
console.log(`[electron-dev] next dev を port ${port} で起動します`);

const nextDev = spawn('npx', ['next', 'dev', '-p', String(port)], {
  stdio: 'inherit',
  env: { ...process.env },
});

function shutdown(code) {
  nextDev.kill('SIGTERM');
  process.exit(code);
}

const ready = await waitForServerReady(port);
if (!ready) {
  console.error('[electron-dev] next dev の起動確認がタイムアウトしました');
  shutdown(1);
}

console.log('[electron-dev] Electron を起動します');
const electronProcess = spawn(electronPath, ['dist-electron/main.js'], {
  stdio: 'inherit',
  env: { ...process.env, LEAGUE_TABLE_DEV_PORT: String(port) },
});

electronProcess.on('exit', (code) => shutdown(code ?? 0));
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
