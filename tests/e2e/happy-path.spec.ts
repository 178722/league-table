import { test, expect } from '@playwright/test';
import {
  addEntrant,
  createTournament,
  enterMatchResultByName,
  generateCategories,
  login,
  setCategorySettings,
} from './helpers';

// シナリオ1：ハッピーパス（大会作成から結果入力・データ出力まで、docs/E2Eテスト.md参照）
test('シナリオ1: 大会作成〜競技情報・選手登録〜リーグ表生成〜結果入力〜データ出力の一連の流れ', async ({ page }) => {
  // Step 1: ログイン
  await login(page);
  await expect(page).toHaveURL(/\/tournaments$/);

  // Step 2〜3: 大会を新規作成
  const name = `E2Eハッピーパス-${Date.now()}`;
  const tid = await createTournament(page, { name });
  const categoryId = `${tid}-A`;
  await expect(page.getByRole('link', { name: '大会情報' })).toBeVisible();

  // Step 4: 競技情報を設定
  await setCategorySettings(page, tid, categoryId, { setCount: 3, rankingMethod: '勝敗方式' });

  // Step 5: 選手(チーム)を4件登録
  const names = ['エース', 'ビショップ', 'シーザー', 'ダイヤ'];
  for (const n of names) {
    await addEntrant(page, tid, n);
  }
  await page.goto(`/tournaments/${tid}/players`);
  for (const n of names) {
    await expect(page.locator('tr', { hasText: n })).toHaveCount(1);
  }

  // Step 6: リーグ表を作成する
  await generateCategories(page, tid, ['カテゴリA']);

  // Step 7: 大会を開催する
  await page.goto(`/tournaments/${tid}`);
  await page.getByRole('button', { name: '大会を開催する' }).click();
  await page.waitForURL(new RegExp(`/tournaments/${tid}/categories/${categoryId}/matches`));
  await expect(page.locator('text=リーグ表・勝敗表')).toBeVisible();

  // Step 8〜10: 総当たり6試合すべてに結果を入力する
  const pairs: Array<[string, string, string, string]> = [
    ['エース', 'ビショップ', '25', '10'],
    ['エース', 'シーザー', '25', '15'],
    ['エース', 'ダイヤ', '25', '20'],
    ['ビショップ', 'シーザー', '25', '10'],
    ['ビショップ', 'ダイヤ', '25', '15'],
    ['シーザー', 'ダイヤ', '25', '10'],
  ];
  for (const [a, b, scoreA, scoreB] of pairs) {
    await enterMatchResultByName(page, tid, categoryId, a, b, scoreA, scoreB);
  }

  await page.goto(`/tournaments/${tid}/categories/${categoryId}/matches`);
  await expect(page.getByRole('button', { name: '未入力' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '入力済' })).toHaveCount(6);

  // Step 11: データ出力画面（共通ヘッダーの「データ出力」ボタンは現状コメントアウトにより非表示のため、
  // URLへ直接遷移する。docs/E2Eテスト.md・docs/画面仕様書.md参照）
  await page.goto(`/tournaments/${tid}/export`);
  await expect(page.getByRole('button', { name: 'データ出力' })).toBeVisible();

  // Step 12: データ出力ボタンを押下する
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'データ出力' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
  await expect(page.locator('text=データ出力が完了しました')).toBeVisible();
});
