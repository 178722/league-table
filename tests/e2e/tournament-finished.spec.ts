import { test, expect } from '@playwright/test';
import { addEntrant, createTournament, generateCategories, login } from './helpers';

// シナリオ3：大会終了後は編集不可であることの確認（簡潔、docs/E2Eテスト.md参照）
test('シナリオ3: 大会を終了すると全画面が閲覧専用になる', async ({ page }) => {
  await login(page);

  const name = `E2E終了確認-${Date.now()}`;
  const tid = await createTournament(page, { name });
  const categoryId = `${tid}-A`;
  await addEntrant(page, tid, '選手A');
  await addEntrant(page, tid, '選手B');
  await generateCategories(page, tid, ['カテゴリA']);

  // Step 1: 「大会を終了する」をクリックし、確認ダイアログを承認する
  await page.goto(`/tournaments/${tid}`);
  await page.click('button:has-text("大会を終了する")');
  const [response] = await Promise.all([
    page.waitForResponse(
      (res) => res.url().includes(`/api/tournaments/${tid}/status`) && res.request().method() === 'PUT',
    ),
    page.getByRole('button', { name: '終了する', exact: true }).click(),
  ]);
  expect(response.ok()).toBe(true);
  await page.waitForTimeout(300);
  await page.goto(`/tournaments/${tid}`);
  await expect(page.locator('text=進行中')).toHaveCount(0);

  // Step 2: 「競技情報」「選手(チーム)」タブが編集不可（disabled）表示になっている
  await page.goto(`/tournaments/${tid}/categories/${categoryId}/settings`);
  await expect(page.locator('#setCount')).toBeDisabled();
  await page.goto(`/tournaments/${tid}/players`);
  await expect(page.getByRole('button', { name: '+ 新規登録' })).toBeDisabled();

  // Step 3: [A2]に戻り、当該大会の行をクリックすると[A3]が閲覧専用で開く
  await page.goto('/tournaments');
  await page.locator('tr', { hasText: name }).click();
  await page.waitForURL(new RegExp(`/tournaments/${tid}$`));
  await expect(page.locator('#name')).toBeDisabled();
  await expect(page.getByRole('button', { name: '大会を閲覧する' })).toBeVisible();
  await expect(page.getByRole('button', { name: '大会を再開する' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'リーグ表を作成する' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '大会を開催する' })).toHaveCount(0);

  // Step 4: 「大会を閲覧する」をクリックすると[A6]が開き、結果入力・生成系の操作がすべて不可になる
  await page.getByRole('button', { name: '大会を閲覧する' }).click();
  await page.waitForURL(new RegExp(`/tournaments/${tid}/categories/${categoryId}/matches`));
  await expect(page.locator('table').first().locator('td.cursor-pointer')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'リーグ表を作成する' })).toHaveCount(0);
});
