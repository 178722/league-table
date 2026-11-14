import { test, expect } from '@playwright/test';
import { createTournament } from './helpers';

// 認証は共有セッションの影響を避けるため、全テストで専用の未認証コンテキストを使う
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('認証（要件定義書4章セキュリティ）', () => {
  test('I-AUTH-01: シードされた正しいID/パスワードでログインできる', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#login-id', 'TakunishiSC');
    await page.fill('#login-password', '0962778801');
    await page.click('button:has-text("ログイン")');
    await page.waitForURL('**/tournaments');
    await expect(page).toHaveURL(/\/tournaments$/);

    // セッションはサーバー側でグローバルに1つのみ保持される設計のため、このテストが発行した
    // 新しいセッションCookieを共有のstorageStateへ書き戻し、他の結合テストが古いCookieで失敗しないようにする
    await page.context().storageState({ path: 'tests/integration/.auth/admin.json' });
  });

  test('I-AUTH-02: 誤ったID/パスワードではログインできない', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#login-id', 'TakunishiSC');
    await page.fill('#login-password', 'wrong-password');
    await page.click('button:has-text("ログイン")');
    await expect(page.locator('text=IDまたはパスワードが正しくありません')).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('I-AUTH-03: 未認証状態で管理者向けAPIを呼び出すと401が返る', async ({ request }) => {
    const res = await request.post('/api/tournaments', {
      data: { name: '不正アクセス大会', date: '2026-01-01', location: '会場', categories: [] },
    });
    expect(res.status()).toBe(401);
  });

  test('I-AUTH-03b: 未認証状態で管理者向け画面にアクセスするとログイン画面へリダイレクトされる', async ({
    page,
  }) => {
    await page.goto('/tournaments');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('I-AUTH-04: パスワードはハッシュ化（bcrypt系）されてストアに保存されている', async () => {
    const fs = await import('node:fs');
    const store = JSON.parse(fs.readFileSync('.data/store.json', 'utf-8'));
    expect(store.auth.passwordHash).not.toBe('0962778801');
    expect(store.auth.passwordHash).toMatch(/^\$2[aby]\$/); // bcrypt形式のハッシュ
  });

  test('I-AUTH-05: 参加者向け画面（P1）はログインなしでアクセスできる', async ({ page, playwright }) => {
    // このdescribe内は未認証コンテキストのため、I-AUTH-01で保存済みの管理者セッションを使って
    // 別のAPIRequestContextから大会を作成する（P1画面確認用）
    const adminRequest = await playwright.request.newContext({
      baseURL: 'http://localhost:3500',
      storageState: 'tests/integration/.auth/admin.json',
    });
    const createRes = await adminRequest.post('/api/tournaments', {
      data: {
        name: `P1画面確認用-${Date.now()}`,
        date: '2026-01-01',
        location: '検証会場',
        categories: [{ key: 'A', name: 'フリー' }],
      },
    });
    const { data: tournament } = await createRes.json();
    await adminRequest.dispose();

    const res = await page.goto(`/t/${tournament.id}`);
    expect(res?.status()).toBe(200);
    await expect(page).toHaveURL(new RegExp(`/t/${tournament.id}$`));
  });

  test('I-AUTH-06: 閲覧モードはID・パスワードなしで入れるが書き込み系操作はできない', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.click('text=閲覧モードで見る');
    await page.waitForURL('**/tournaments');

    // 画面上は書き込み系ボタンがdisabledになる
    await expect(page.getByRole('button', { name: '+ 新規作成' })).toBeDisabled();

    // APIレベルでも書き込みは拒否される（閲覧用のGETは拒否しない）
    const writeRes = await page.request.post('/api/tournaments', {
      data: { name: '不正大会', date: '2026-01-01', location: '会場', categories: [] },
    });
    expect(writeRes.status()).toBe(403);

    // セッションはサーバー側でグローバルに1つのみ保持される設計のため、このテストが発行した
    // 閲覧モードセッションを後続の結合テストへ引き継がないよう、管理者で再ログインして
    // 共有のstorageStateを書き戻す
    await page.goto('/login');
    await page.fill('#login-id', 'TakunishiSC');
    await page.fill('#login-password', '0962778801');
    await page.click('button:has-text("ログイン")');
    await page.waitForURL('**/tournaments');
    await page.context().storageState({ path: 'tests/integration/.auth/admin.json' });
  });

  test('I-AUTH-07: 閲覧モードでは進行中の大会も「大会を閲覧する」(有効)/「大会を終了する」(無効)になり、未生成時はエラーダイアログを表示する', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.fill('#login-id', 'TakunishiSC');
    await page.fill('#login-password', '0962778801');
    await page.click('button:has-text("ログイン")');
    await page.waitForURL('**/tournaments');

    const name = `閲覧モード検証-${Date.now()}`;
    const tid = await createTournament(page, { name });

    await page.goto('/login');
    await page.click('text=閲覧モードで見る');
    await page.waitForURL('**/tournaments');

    await page.goto(`/tournaments/${tid}`);
    await expect(page.getByRole('button', { name: '大会を閲覧する' })).toBeEnabled();
    await expect(page.getByRole('button', { name: '大会を終了する' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'リーグ表を作成する' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '大会を開催する' })).toHaveCount(0);

    // まだリーグ表が生成されていないため、押下するとエラーダイアログが表示される（画面遷移しない）
    await page.getByRole('button', { name: '大会を閲覧する' }).click();
    await expect(page.locator('text=まだリーグ表が生成されていません')).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/tournaments/${tid}$`));
    await page.getByRole('button', { name: '閉じる' }).click();

    // セッションはサーバー側でグローバルに1つのみ保持される設計のため、このテストが発行した
    // 閲覧モードセッションを後続の結合テストへ引き継がないよう、管理者で再ログインして
    // 共有のstorageStateを書き戻す
    await page.goto('/login');
    await page.fill('#login-id', 'TakunishiSC');
    await page.fill('#login-password', '0962778801');
    await page.click('button:has-text("ログイン")');
    await page.waitForURL('**/tournaments');
    await page.context().storageState({ path: 'tests/integration/.auth/admin.json' });
  });
});
