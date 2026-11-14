import { test, expect } from '@playwright/test';
import { addEntrant, createTournament, enterMatchResultByName, generateCategories, login } from './helpers';

// シナリオ2：タイが生じてじゃんけん確定が必要になる主要フロー（docs/E2Eテスト.md参照）
test('シナリオ2: 3者タイで決着せず、管理者がじゃんけん結果を手動確定する', async ({ page }) => {
  await login(page);

  const name = `E2Eじゃんけん-${Date.now()}`;
  const tid = await createTournament(page, { name });
  const categoryId = `${tid}-A`;

  const [a, b, c] = ['エース', 'ビショップ', 'シーザー'];
  await addEntrant(page, tid, a);
  await addEntrant(page, tid, b);
  await addEntrant(page, tid, c);
  await generateCategories(page, tid, ['カテゴリA']);

  // Step 1: 3者が互いに1勝1敗の循環（3すくみ）になるよう、同点差（5点差）で結果を入力する。
  // 得点率も全員1.0に揃うため、勝敗・セット率・得点率のいずれでも決着せず「じゃんけん待ち」になる
  await enterMatchResultByName(page, tid, categoryId, a, b, '25', '20');
  await enterMatchResultByName(page, tid, categoryId, a, c, '20', '25');
  await enterMatchResultByName(page, tid, categoryId, b, c, '25', '20');

  await page.goto(`/tournaments/${tid}/categories/${categoryId}/matches`);
  await expect(page.locator('text=じゃんけんの結果を入力してください')).toBeVisible();
  // タイした3名の順位表示に「*」が付く
  await expect(page.locator('td', { hasText: /^1\*$/ })).toHaveCount(3);

  // Step 2: じゃんけん待ちの各選手(チーム)についてプルダウンから確定したい順位を選択する
  const form = page.locator('div', { has: page.locator('text=じゃんけんの結果を入力してください') });
  const selects = form.locator('select');
  await expect(selects).toHaveCount(3);
  await selects.nth(0).selectOption('1');
  await selects.nth(1).selectOption('2');
  await selects.nth(2).selectOption('3');
  await expect(selects.nth(0)).toHaveValue('1');
  await expect(selects.nth(1)).toHaveValue('2');
  await expect(selects.nth(2)).toHaveValue('3');

  // Step 3: 「確定」ボタンを押すと、じゃんけん待ちの注記が消え、指定した順位で確定表示される
  const [response] = await Promise.all([
    page.waitForResponse(
      (res) => res.url().includes(`/categories/${categoryId}/standings/janken`) && res.request().method() === 'PUT',
    ),
    form.getByRole('button', { name: '確定' }).click(),
  ]);
  expect(response.ok()).toBe(true);

  await page.goto(`/tournaments/${tid}/categories/${categoryId}/matches`);
  await expect(page.locator('text=じゃんけんの結果を入力してください')).toHaveCount(0);
  await expect(page.locator('td', { hasText: /^1\*$/ })).toHaveCount(0);
});
