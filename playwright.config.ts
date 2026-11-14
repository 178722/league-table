import { defineConfig, devices } from '@playwright/test';

// 結合テスト（docs/結合テスト.md）実行用設定。開発サーバーに対して実際のAPI・画面を操作して検証する
export default defineConfig({
  testDir: './tests/integration',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:3500',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    {
      name: 'integration',
      use: { ...devices['Desktop Chrome'], storageState: 'tests/integration/.auth/admin.json' },
      dependencies: ['setup'],
    },
  ],
  webServer: {
    command: 'npm run dev -- -p 3500',
    url: 'http://localhost:3500/login',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
