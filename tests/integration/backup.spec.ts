import { test, expect } from '@playwright/test';

test.describe('バックアップ・リストア（要件定義書4章）', () => {
  test('I-BK-01: 今すぐバックアップでバックアップ履歴に「手動」契機のレコードが追加される', async ({
    page,
  }) => {
    await page.goto('/settings/backup');
    const before = await page.locator('tbody tr').count();
    await page.click('button:has-text("今すぐバックアップ")');
    await page.waitForTimeout(400);
    await expect(page.locator('tbody tr')).toHaveCount(before + 1);
    await expect(page.locator('tbody tr').first()).toContainText('手動');
  });

  test('I-BK-02: ログアウト時に「バックアップする」を選ぶと「ログアウト」契機のレコードが追加される', async ({
    page,
  }) => {
    await page.goto('/tournaments');
    await page.click('button:has-text("ログアウト")');
    await page.getByRole('button', { name: 'ログアウトする' }).click();
    await page.getByRole('button', { name: 'バックアップする' }).click();
    await page.waitForURL('**/login');

    await page.fill('#login-id', 'TakunishiSC');
    await page.fill('#login-password', '0962778801');
    await page.click('button:has-text("ログイン")');
    await page.waitForURL('**/tournaments');

    await page.goto('/settings/backup');
    await expect(page.locator('tbody tr').first()).toContainText('ログアウト');

    // セッションはサーバー側でグローバルに1つのみ保持される設計のため、再ログインで発行された
    // 新しいセッションCookieを共有のstorageStateへ書き戻し、他のテストが古いCookieで失敗しないようにする
    await page.context().storageState({ path: 'tests/integration/.auth/admin.json' });
  });

  test('I-BK-04: バックアップの復元は未認証では実行できない', async ({ playwright }) => {
    // Cookieを持たない素のAPIリクエストコンテキストで直接アクセスする
    const anonymousRequest = await playwright.request.newContext({ storageState: { cookies: [], origins: [] } });
    const res = await anonymousRequest.post('http://localhost:3500/api/backups/restore', {
      data: { backupId: 'bk-1' },
    });
    expect(res.status()).toBe(401);
    await anonymousRequest.dispose();
  });

  test('I-BK-03: リストアはバックアップ選択→復元ボタン→確認ダイアログの順で全データを上書きする', async ({
    page,
  }) => {
    await page.goto('/settings/backup');
    await page.click('button:has-text("今すぐバックアップ")');
    await page.waitForTimeout(400);

    // 1. バックアップデータ（作成日時）の選択
    await page.locator('tbody tr').first().locator('input[type=radio]').check();

    // 2. 復元ボタン押下
    await page.getByRole('button', { name: '復元', exact: true }).click();

    // 3. 復元実行最終確認（ダイアログ）
    await expect(page.locator('text=データを復元しますか？')).toBeVisible();
    await page.getByRole('button', { name: '復元する' }).click();
    await page.waitForTimeout(500);

    // 復元（＝直前に取得した自分自身のスナップショットへのロールバック）後も正常に画面が表示される
    await page.goto('/tournaments');
    await expect(page.locator('table')).toBeVisible();
  });
});
