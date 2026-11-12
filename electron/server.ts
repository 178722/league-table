import path from 'node:path';
import net from 'node:net';
import { app, utilityProcess, type UtilityProcess } from 'electron';

export interface NextServerHandle {
  port: number;
  process: UtilityProcess;
}

/** OSに空いているポートを1つ問い合わせて確保する（固定ポートの衝突を避ける） */
export function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

/** パッケージ後（electron-builderのextraResources配下）か、開発時（リポジトリ直下）かで切り替える */
export function resolveAppDir(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'app');
  }
  return process.cwd();
}

/**
 * Next.jsのCLI（`next start`）を子プロセスとして起動する。
 * システムにNode.jsが入っていない端末でも動くよう、Electronに同梱されたNodeランタイムで
 * 実行されるutilityProcess.forkを用いる（system nodeコマンドの有無に依存しない）。
 */
export function startNextServer(port: number, dataDir: string): NextServerHandle {
  const appDir = resolveAppDir();
  const nextBin = path.join(appDir, 'node_modules', 'next', 'dist', 'bin', 'next');

  const child = utilityProcess.fork(nextBin, ['start', '-p', String(port)], {
    cwd: appDir,
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: 'production',
      LEAGUE_TABLE_DATA_DIR: dataDir,
    },
    stdio: 'inherit',
  });

  return { port, process: child };
}

/** `/login`への応答が返るまで起動完了をポーリングで待つ */
export async function waitForServerReady(port: number, timeoutMs = 20000): Promise<boolean> {
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

export function stopNextServer(handle: NextServerHandle | null): void {
  handle?.process.kill();
}
