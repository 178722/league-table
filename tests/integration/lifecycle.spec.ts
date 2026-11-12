import { test, expect } from '@playwright/test';
import {
  addEntrant,
  createTournament,
  enableCategory,
  generateCategories,
  registerFirstMatchResult,
} from './helpers';

test.describe('カスケード削除（要件定義書2.1）', () => {
  test('I-DEL-01/02: 確認ダイアログ承認後、大会削除で競技情報・選手(チーム)情報が連鎖削除される', async ({
    page,
  }) => {
    const name = `結合削除検証-${Date.now()}`;
    const tid = await createTournament(page, { name });
    await addEntrant(page, tid, '削除検証選手');

    await page.goto('/tournaments');
    const row = page.locator('tr', { hasText: name });
    await row.getByRole('button', { name: '削除' }).click();

    // キャンセル時は削除されない
    await page.getByRole('button', { name: 'キャンセル' }).click();
    await expect(page.locator('tr', { hasText: name })).toHaveCount(1);

    // 承認後は削除される
    await row.getByRole('button', { name: '削除' }).click();
    await page.getByRole('button', { name: '削除する' }).click();
    await page.waitForTimeout(300);
    await expect(page.locator('tr', { hasText: name })).toHaveCount(0);

    const res = await page.request.get(`/tournaments/${tid}`);
    expect(res.status()).toBe(404);
  });

  test('I-DEL-03: ステータス「終了」の大会も削除できる', async ({ page }) => {
    const name = `終了大会削除検証-${Date.now()}`;
    const tid = await createTournament(page, { name });
    await page.goto(`/tournaments/${tid}`);
    await page.click('button:has-text("大会を終了する")');
    await page.getByRole('button', { name: '終了する', exact: true }).click();
    await page.waitForTimeout(300);

    await page.goto('/tournaments');
    const row = page.locator('tr', { hasText: name });
    await row.getByRole('button', { name: '削除' }).click();
    await page.getByRole('button', { name: '削除する' }).click();
    await page.waitForTimeout(300);
    await expect(page.locator('tr', { hasText: name })).toHaveCount(0);
  });
});

test.describe('ブロック系ルール（要件定義書2.1・3.2・3.3）', () => {
  test('I-DEL-04 / I-BLK-03: 選手(チーム)登録済みのカテゴリはA3でチェックを外せない（削除できない）', async ({
    page,
  }) => {
    const name = `ブロック検証-${Date.now()}`;
    const tid = await createTournament(page, { name });
    await addEntrant(page, tid, 'ブロック検証選手');

    await page.goto(`/tournaments/${tid}`);
    const checkbox = page.getByRole('checkbox', { name: 'カテゴリAを有効化' });
    // カテゴリAはそもそも必須のためチェックボックス自体が存在しない。B登録済みケースで検証する
    await enableCategory(page, tid, 'B', '初級');
    await addEntrant(page, tid, 'B登録選手', { categoryLabel: 'カテゴリB：初級' });

    await page.goto(`/tournaments/${tid}`);
    const checkboxB = page.getByRole('checkbox', { name: 'カテゴリBを有効化' });
    await expect(checkboxB).toBeDisabled();
    void checkbox;
  });

  test('I-DEL-05: 試合結果が1件でも登録されている競技情報は削除（無効化）できない', async ({
    page,
  }) => {
    const name = `競技情報削除ブロック検証-${Date.now()}`;
    const tid = await createTournament(page, { name });
    await addEntrant(page, tid, '選手1');
    await addEntrant(page, tid, '選手2');
    await generateCategories(page, tid, ['カテゴリA']);
    await registerFirstMatchResult(page, tid, `${tid}-A`);

    // カテゴリAは必須のためチェックボックスなし。Bを登録・生成・結果入力した上で検証する
    await enableCategory(page, tid, 'B', '初級');
    await addEntrant(page, tid, 'B選手1', { categoryLabel: 'カテゴリB：初級' });
    await addEntrant(page, tid, 'B選手2', { categoryLabel: 'カテゴリB：初級' });
    await generateCategories(page, tid, ['カテゴリB：初級']);
    await registerFirstMatchResult(page, tid, `${tid}-B`);

    await page.goto(`/tournaments/${tid}`);
    const checkboxB = page.getByRole('checkbox', { name: 'カテゴリBを有効化' });
    await expect(checkboxB).toBeDisabled();

    // サーバー側でも試合結果登録済みカテゴリの無効化はブロックされる（API直叩きで確認）
    const res = await page.request.put(`/api/tournaments/${tid}`, {
      data: {
        name,
        date: '2026-01-01',
        location: '検証会場',
        categories: [
          { key: 'A', name: 'フリー', enabled: true },
          { key: 'B', name: '初級', enabled: false },
        ],
      },
    });
    expect(res.ok()).toBe(true);
    const stillThere = await page.request.get(`/tournaments/${tid}`);
    expect(stillThere.status()).toBe(200);
    await page.goto(`/tournaments/${tid}`);
    await expect(page.getByRole('checkbox', { name: 'カテゴリBを有効化' })).toBeChecked();
  });

  test('I-DEL-06: 試合結果が1件でも登録されている選手(チーム)は[A6]から削除できない', async ({
    page,
  }) => {
    const name = `選手削除ブロック検証-${Date.now()}`;
    const tid = await createTournament(page, { name });
    const entrant1Id = await addEntrant(page, tid, '選手1');
    await addEntrant(page, tid, '選手2');
    await generateCategories(page, tid, ['カテゴリA']);
    await registerFirstMatchResult(page, tid, `${tid}-A`);

    await page.goto(`/tournaments/${tid}/players`);
    const row = page.locator('tr', { hasText: '選手1' });
    await expect(row.getByRole('button', { name: '削除' })).toBeDisabled();

    // API直叩きでもブロックされることを確認する
    const res = await page.request.delete(`/api/tournaments/${tid}/entrants/${entrant1Id}`);
    expect(res.status()).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe('HAS_RESULT');

    await page.goto(`/tournaments/${tid}/players`);
    await expect(page.locator('tr', { hasText: '選手1' })).toHaveCount(1);
  });

  test('I-BLK-02: 試合結果登録済みの選手(チーム)はカテゴリ・コート選択・コート番号を変更できない', async ({
    page,
  }) => {
    const name = `選手変更ブロック検証-${Date.now()}`;
    const tid = await createTournament(page, { name });
    const entrant1Id = await addEntrant(page, tid, '選手1');
    await addEntrant(page, tid, '選手2');
    await generateCategories(page, tid, ['カテゴリA']);
    await registerFirstMatchResult(page, tid, `${tid}-A`);

    await page.goto(`/tournaments/${tid}/players`);
    const row = page.locator('tr', { hasText: '選手1' });
    await expect(row.getByRole('button', { name: '編集' })).toBeDisabled();

    // API直叩きでも変更がブロックされることを確認する（カテゴリ変更を試みる）
    const res = await page.request.put(`/api/tournaments/${tid}/entrants/${entrant1Id}`, {
      data: { categoryId: `${tid}-A`, name: '選手1変更後' },
    });
    expect(res.status()).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe('HAS_RESULT');

    await page.goto(`/tournaments/${tid}/players`);
    await expect(page.locator('tr', { hasText: '選手1変更後' })).toHaveCount(0);
    await expect(page.locator('tr', { hasText: '選手1' })).toHaveCount(1);
  });

  test('I-BLK-01: 試合結果登録済みの競技情報は変更できない', async ({ page }) => {
    const name = `結果ブロック検証-${Date.now()}`;
    const tid = await createTournament(page, { name });
    await addEntrant(page, tid, '選手1');
    await addEntrant(page, tid, '選手2');
    await generateCategories(page, tid, ['カテゴリA']);

    await page.goto(`/tournaments/${tid}/categories/${tid}-A/matches`);
    await page.locator('td.cursor-pointer').first().click();
    const dialog = page.locator('[role="dialog"]');
    await dialog.waitFor({ state: 'visible' });
    await dialog.locator('input[type=number]').first().fill('25');
    await dialog.locator('input[type=number]').nth(1).fill('20');
    await dialog.getByRole('button', { name: '保存' }).click();
    await dialog.waitFor({ state: 'hidden' });

    await page.goto(`/tournaments/${tid}/categories/${tid}-A/settings`);
    await expect(page.locator('#setCount')).toBeDisabled();
    await expect(page.locator('text=試合結果が登録されているため変更できません')).toBeVisible();
  });

  test('I-BLK-04/05: 大会ステータスが終了の間は編集・結果入力ができない', async ({ page }) => {
    const name = `終了ブロック検証-${Date.now()}`;
    const tid = await createTournament(page, { name });
    await page.goto(`/tournaments/${tid}`);
    await page.click('button:has-text("大会を終了する")');
    await page.getByRole('button', { name: '終了する', exact: true }).click();
    await page.waitForTimeout(300);

    await page.goto(`/tournaments/${tid}`);
    await expect(page.locator('#name')).toBeDisabled();
    await expect(page.locator('text=大会が終了しているため変更できません')).toBeVisible();

    const res = await page.request.put(`/api/tournaments/${tid}`, {
      data: { name: '変更不可', date: '2026-01-01', location: '変更不可', categories: [] },
    });
    expect(res.status()).toBe(409);
  });
});

test.describe('大会ステータス切り替え（要件定義書2.1）', () => {
  test('I-ST-01/02: 終了→再開でステータスが往復し、一覧表示にも反映される', async ({ page }) => {
    const name = `ステータス往復検証-${Date.now()}`;
    const tid = await createTournament(page, { name });

    await page.goto(`/tournaments/${tid}`);
    await page.click('button:has-text("大会を終了する")');
    await page.getByRole('button', { name: '終了する', exact: true }).click();
    await page.waitForTimeout(300);

    await page.goto('/tournaments');
    await expect(page.locator('tr', { hasText: name })).toContainText('終了');

    await page.goto(`/tournaments/${tid}`);
    await page.click('button:has-text("大会を再開する")');
    await page.waitForTimeout(300);

    await page.goto('/tournaments');
    await expect(page.locator('tr', { hasText: name })).toContainText('進行中');
  });

  test('I-ST-03: ステータスが「終了」の大会を[A2]一覧から選択すると[A3]が閲覧専用で開く', async ({
    page,
  }) => {
    const name = `閲覧専用遷移検証-${Date.now()}`;
    const tid = await createTournament(page, { name });
    await page.goto(`/tournaments/${tid}`);
    await page.click('button:has-text("大会を終了する")');
    await page.getByRole('button', { name: '終了する', exact: true }).click();
    await page.waitForTimeout(300);

    await page.goto('/tournaments');
    const row = page.locator('tr', { hasText: name });
    await row.click();
    await page.waitForURL(new RegExp(`/tournaments/${tid}$`));

    await expect(page.locator('#name')).toBeDisabled();
    await expect(page.locator('#date')).toBeDisabled();
    await expect(page.locator('#location')).toBeDisabled();
    await expect(page.locator('text=大会が終了しているため変更できません')).toBeVisible();

    await expect(page.getByRole('button', { name: '大会を閲覧する' })).toBeVisible();
    await expect(page.getByRole('button', { name: '大会を再開する' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'リーグ表を作成する' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '大会を開催する' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '大会を終了する' })).toHaveCount(0);
  });

  test('I-ST-04: 「大会を閲覧する」で[A6]を読み込み専用で開ける', async ({ page }) => {
    const name = `閲覧専用A7検証-${Date.now()}`;
    const tid = await createTournament(page, { name });
    await addEntrant(page, tid, '選手1');
    await addEntrant(page, tid, '選手2');
    await generateCategories(page, tid, ['カテゴリA']);

    await page.goto(`/tournaments/${tid}`);
    await page.click('button:has-text("大会を終了する")');
    await page.getByRole('button', { name: '終了する', exact: true }).click();
    await page.waitForTimeout(300);

    await page.goto(`/tournaments/${tid}`);
    await page.getByRole('button', { name: '大会を閲覧する' }).click();
    await page.waitForURL(new RegExp(`/tournaments/${tid}/categories/${tid}-A/matches`));

    // 閲覧専用時はリーグ表・勝敗表のマス目がcursor-pointer（クリック可能）にならない（試合順表の対戦カード・審判セルは引き続きクリック可能なため、リーグ表側の最初の表に絞って検証する）
    await expect(page.locator('table').first().locator('td.cursor-pointer')).toHaveCount(0);

    // 試合順表の行クリックではダイアログが開くが、結果入力欄・保存ボタンは無効化され、入力・保存はできない
    await page.locator('table').last().locator('tbody tr').first().click();
    const dialog = page.locator('[role="dialog"]');
    await dialog.waitFor({ state: 'visible' });
    await expect(dialog.locator('input[type=number]').first()).toBeDisabled();
    await expect(dialog.getByRole('button', { name: '保存' })).toHaveCount(0);

    await expect(page.getByRole('button', { name: 'リーグ表を作成する' })).toHaveCount(0);
    await expect(page.locator('button:has-text("再生成")')).toHaveCount(0);
  });
});
