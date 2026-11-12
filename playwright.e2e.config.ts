import { defineConfig, devices } from '@playwright/test';

// E2Eテスト（docs/E2Eテスト.md）実行用設定。結合テスト（tests/integration）とは異なり、
// 事前ログイン済みのstorageStateは使わず、各シナリオが「ログイン」自体を手順の一部として検証する。
// 開発サーバーを結合テストとは別ポートで起動し、同時実行時のポート競合・データ競合を避ける。
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:3600',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'e2e', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev -- -p 3600',
    url: 'http://localhost:3600/login',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
