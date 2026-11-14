import { test as setup } from '@playwright/test';

const authFile = 'tests/integration/.auth/admin.json';

// シードされた管理者アカウントでログインし、Cookie状態を保存する（他の結合テストはこれを再利用する）
setup('ログインしてセッションCookieを保存する', async ({ page }) => {
  await page.goto('/login');
  await page.fill('#login-id', 'TakunishiSC');
  await page.fill('#login-password', '0962778801');
  await page.click('button:has-text("ログイン")');
  await page.waitForURL('**/tournaments');
  await page.context().storageState({ path: authFile });
});
