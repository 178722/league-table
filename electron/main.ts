import { app, BrowserWindow } from 'electron';
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
    port = await findFreePort();
    serverHandle = startNextServer(port, app.getPath('userData'));
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
