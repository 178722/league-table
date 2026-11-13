import { app, BrowserWindow, dialog } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import {
  findFreePort,
  startNextServer,
  stopNextServer,
  waitForServerReady,
  type NextServerHandle,
} from './server';

let mainWindow: BrowserWindow | null = null;
let serverHandle: NextServerHandle | null = null;

// 開発時はnpm run electron:devが別途next devを起動し、そのポートをここで受け取る
const DEV_SERVER_PORT = process.env.LEAGUE_TABLE_DEV_PORT
  ? Number(process.env.LEAGUE_TABLE_DEV_PORT)
  : null;

const LOADING_HTML =
  'data:text/html;charset=utf-8,' +
  encodeURIComponent(
    '<!doctype html><meta charset="utf-8">' +
      '<body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;' +
      'height:100vh;margin:0;color:#444;">起動しています…</body>',
  );

/**
 * 同一PCの複数OSユーザー間でデータを共有するため、per-userな`userData`ではなく
 * マシン単位の共有ディレクトリ（Windows: ProgramData、mac: /Library/Application Support）を使う。
 * 配布対象外のOS（開発コンテナ等）では従来通りuserDataにフォールバックする。
 */
function resolveSharedDataDir(): string {
  if (process.platform === 'win32') {
    const base = process.env.ProgramData ?? 'C:\\ProgramData';
    return path.join(base, app.getName());
  }
  if (process.platform === 'darwin') {
    return path.join('/Library/Application Support', app.getName());
  }
  return app.getPath('userData');
}

/** 旧バージョン（userData配下）のデータが存在し、共有ディレクトリ側がまだ空の場合のみ一度だけ移行する */
function migrateLegacyDataDirIfNeeded(sharedDir: string): void {
  const legacyDir = app.getPath('userData');
  if (legacyDir === sharedDir) return;

  const legacyDataDir = path.join(legacyDir, '.data');
  const sharedDataDir = path.join(sharedDir, '.data');
  if (fs.existsSync(path.join(sharedDataDir, 'store.json'))) return;
  if (!fs.existsSync(path.join(legacyDataDir, 'store.json'))) return;

  fs.mkdirSync(sharedDir, { recursive: true });
  fs.cpSync(legacyDataDir, sharedDataDir, { recursive: true });
}

async function createWindow(): Promise<BrowserWindow> {
  const win = new BrowserWindow({ width: 1280, height: 800, show: true });
  await win.loadURL(LOADING_HTML);
  return win;
}

function stopServer(): void {
  stopNextServer(serverHandle);
  serverHandle = null;
}

async function start(): Promise<void> {
  mainWindow = await createWindow();

  let port: number;
  if (DEV_SERVER_PORT) {
    port = DEV_SERVER_PORT;
  } else {
    const dataDir = resolveSharedDataDir();
    try {
      migrateLegacyDataDirIfNeeded(dataDir);
      fs.mkdirSync(dataDir, { recursive: true });
    } catch {
      dialog.showErrorBox(
        '起動できません',
        `共有データフォルダ（${dataDir}）を作成できませんでした。\n` +
          '管理者権限のあるアカウントで一度起動してから、再度お試しください。',
      );
      app.quit();
      return;
    }

    port = await findFreePort();
    serverHandle = startNextServer(port, dataDir);
  }

  const ready = await waitForServerReady(port);
  if (!ready) {
    throw new Error(`Next.jsサーバーの起動確認がタイムアウトしました（port=${port}）`);
  }

  // 起動待ち中にユーザーがウィンドウを閉じていた場合は何もしない
  if (!mainWindow || mainWindow.isDestroyed()) return;
  await mainWindow.loadURL(`http://localhost:${port}`);
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() =>
    start().catch((err) => {
      console.error(err);
      app.quit();
    }),
  );

  app.on('window-all-closed', () => {
    stopServer();
    app.quit();
  });

  app.on('before-quit', () => {
    stopServer();
  });
}
