import { test, expect } from '@playwright/test';
import { addEntrant, createTournament, enableCategory, generateCategories } from './helpers';

test.describe('自動生成の一括実行（要件定義書3.4〜3.6）', () => {
  test('I-GEN-01: 選択したカテゴリのリーグ表・試合順・審判順が生成される', async ({ page }) => {
    const name = `生成検証-${Date.now()}`;
    const tid = await createTournament(page, { name });
    await addEntrant(page, tid, '選手A');
    await addEntrant(page, tid, '選手B');
    await addEntrant(page, tid, '選手C');
    await generateCategories(page, tid, ['カテゴリA']);

    await page.goto(`/tournaments/${tid}/categories/${tid}-A/matches`);
    await expect(page.locator('text=リーグ表・勝敗表')).toBeVisible();
    const matchRows = page.locator('table').last().locator('tbody tr');
    await expect(matchRows).toHaveCount(3); // N=3 → 3試合
  });

  test('I-GEN-02: 条件を満たさないカテゴリはスキップされ、理由が詳しく表示される', async ({
    page,
  }) => {
    const name = `生成スキップ検証-${Date.now()}`;
    const tid = await createTournament(page, { name });
    await addEntrant(page, tid, '一人だけ');
    await generateCategories(page, tid, ['カテゴリA']);

    await expect(
      page.locator('text=条件を満たさないため生成をスキップしたカテゴリがあります'),
    ).toBeVisible();
    await expect(page.locator('[role="dialog"]')).toContainText('参加選手(チーム)数が1名のため作成できません');
  });

  test('I-GEN-03: 生成済みカテゴリを再選択すると警告が表示され、再実行で上書きされる', async ({
    page,
  }) => {
    const name = `再生成検証-${Date.now()}`;
    const tid = await createTournament(page, { name });
    await addEntrant(page, tid, '選手A');
    await addEntrant(page, tid, '選手B');
    await generateCategories(page, tid, ['カテゴリA']);

    await page.goto(`/tournaments/${tid}`);
    await page.click('button:has-text("リーグ表を作成する")');
    await page.waitForSelector('text=リーグ表を作成する対象を選択してください');
    await page.locator('label', { hasText: 'カテゴリA' }).locator('input[type=checkbox]').check();
    await expect(page.locator('text=既に生成済みの対象が含まれています')).toBeVisible();
    await page.locator('[role="dialog"]').getByRole('button', { name: '作成する', exact: true }).click();
    await page.waitForTimeout(300);

    await page.goto(`/tournaments/${tid}/categories/${tid}-A/matches`);
    await expect(page.locator('text=リーグ表・勝敗表')).toBeVisible();
  });

  test('I-GEN-04: 1つでも生成済みカテゴリがあれば「大会を開催する」が有効になる', async ({ page }) => {
    const name = `開催ボタン検証-${Date.now()}`;
    const tid = await createTournament(page, { name });
    await enableCategory(page, tid, 'B', '初級');
    await addEntrant(page, tid, '選手A');
    await addEntrant(page, tid, '選手B');
    await addEntrant(page, tid, 'B選手A', { categoryLabel: 'カテゴリB：初級' });
    await addEntrant(page, tid, 'B選手B', { categoryLabel: 'カテゴリB：初級' });

    await page.goto(`/tournaments/${tid}`);
    await expect(page.getByRole('button', { name: '大会を開催する' })).toBeDisabled();

    // カテゴリAのみ生成した時点（カテゴリBは未生成のまま）で、既に有効になる
    await generateCategories(page, tid, ['カテゴリA']);
    await page.goto(`/tournaments/${tid}`);
    await expect(page.getByRole('button', { name: '大会を開催する' })).toBeEnabled();
  });

  test('I-GEN-05: A6画面には生成・再生成に相当するUI要素が存在しない', async ({ page }) => {
    const name = `A6生成UI検証-${Date.now()}`;
    const tid = await createTournament(page, { name });
    await addEntrant(page, tid, '選手A');
    await addEntrant(page, tid, '選手B');
    await generateCategories(page, tid, ['カテゴリA']);

    await page.goto(`/tournaments/${tid}/categories/${tid}-A/matches`);
    await expect(page.locator('button:has-text("リーグ表を作成する")')).toHaveCount(0);
    await expect(page.locator('button:has-text("再生成")')).toHaveCount(0);
  });
});
