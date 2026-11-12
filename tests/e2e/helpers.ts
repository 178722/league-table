import { expect, type Page } from '@playwright/test';

/** [A1]ログイン画面からシードされた管理者認証情報でログインする（docs/E2Eテスト.md シナリオ1 Step1） */
export async function login(page: Page): Promise<void> {
  await page.goto('/login');
  await page.fill('#login-id', 'TakunishiSC');
  await page.fill('#login-password', '0962778801');
  await page.click('button:has-text("ログイン")');
  await page.waitForURL('**/tournaments');
}

/** [A3新規作成]フォームから大会を作成し、作成された大会IDを返す（シナリオ1 Step2〜3） */
export async function createTournament(
  page: Page,
  opts: { name: string; location?: string; categoryAName?: string },
): Promise<string> {
  await page.goto('/tournaments/new');
  await page.fill('#name', opts.name);
  await page.fill('#location', opts.location ?? '検証会場');
  await page.fill('#category-A', opts.categoryAName ?? 'フリー');
  await page.click('button:has-text("保存")');
  await page.waitForURL(/\/tournaments\/tournament-/);
  return page.url().split('/').pop()!;
}

/** [A3編集モード]で指定カテゴリ(B〜J)を有効化し、名称を設定して保存する（シナリオ4で複数カテゴリを用意するため） */
export async function enableCategory(
  page: Page,
  tournamentId: string,
  key: string,
  name: string,
): Promise<void> {
  await page.goto(`/tournaments/${tournamentId}`);
  const checkbox = page.getByRole('checkbox', { name: `カテゴリ${key}を有効化` });
  if ((await checkbox.getAttribute('aria-checked')) !== 'true') {
    await checkbox.click();
  }
  await page.fill(`#category-${key}`, name);
  const [response] = await Promise.all([
    page.waitForResponse(
      (res) => res.url().includes(`/api/tournaments/${tournamentId}`) && res.request().method() === 'PUT',
    ),
    page.click('button:has-text("保存")'),
  ]);
  expect(response.ok(), `カテゴリ${key}の有効化が失敗しました（status: ${response.status()}）`).toBe(true);
  await page.waitForTimeout(300);
}

/** [A4競技情報]でセット数・順位決定方式・コート数等を設定して保存する（シナリオ1 Step4） */
export async function setCategorySettings(
  page: Page,
  tournamentId: string,
  categoryId: string,
  opts: {
    setCount?: number;
    rankingMethod?: '勝敗方式' | '勝点方式';
    courtCount?: number;
  },
): Promise<void> {
  await page.goto(`/tournaments/${tournamentId}/categories/${categoryId}/settings`);
  if (opts.courtCount !== undefined) {
    await page.locator('#courtCount').selectOption(String(opts.courtCount));
  }
  if (opts.setCount !== undefined) {
    await page.locator('#setCount').selectOption(String(opts.setCount));
  }
  if (opts.rankingMethod) {
    await page
      .locator('input[name=rankingMethod]')
      .nth(opts.rankingMethod === '勝敗方式' ? 0 : 1)
      .check();
  }

  const [response] = await Promise.all([
    page.waitForResponse(
      (res) =>
        res.url().includes(`/tournaments/${tournamentId}/categories/${categoryId}/settings`) &&
        res.request().method() === 'PUT',
    ),
    page.getByRole('button', { name: '保存' }).click(),
  ]);
  expect(response.ok(), `競技情報設定の保存が失敗しました（status: ${response.status()}）`).toBe(true);
  await page.waitForTimeout(300);
}

/** [A5選手(チーム)]で1件登録する（シナリオ1 Step5） */
export async function addEntrant(
  page: Page,
  tournamentId: string,
  name: string,
  opts?: { categoryLabel?: string },
): Promise<void> {
  await page.goto(`/tournaments/${tournamentId}/players`);
  await page.click('button:has-text("+ 新規登録")');
  const dialog = page.locator('[role="dialog"]');
  await dialog.waitFor({ state: 'visible' });
  await dialog.locator('#name').fill(name);
  if (opts?.categoryLabel) {
    await dialog.locator('#categoryId').selectOption({ label: opts.categoryLabel });
  }
  await dialog.getByRole('button', { name: '保存', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });

  const [response] = await Promise.all([
    page.waitForResponse(
      (res) => res.url().includes(`/api/tournaments/${tournamentId}/entrants`) && res.request().method() === 'POST',
    ),
    page.getByRole('button', { name: '保存', exact: true }).first().click(),
  ]);
  expect(response.ok(), `選手(チーム)「${name}」の登録が失敗しました（status: ${response.status()}）`).toBe(true);
  await page.waitForTimeout(300);
}

/** [A3大会情報]「リーグ表を作成する」から指定カテゴリ名を選択して生成を実行する（シナリオ1 Step6） */
export async function generateCategories(
  page: Page,
  tournamentId: string,
  categoryLabels: string[],
): Promise<void> {
  await page.goto(`/tournaments/${tournamentId}`);
  await page.click('button:has-text("リーグ表を作成する")');
  await page.waitForSelector('text=リーグ表を作成する対象を選択してください');
  for (const label of categoryLabels) {
    await page.locator('label', { hasText: label }).locator('input[type=checkbox]').check();
  }
  const dialog = page.locator('[role="dialog"]');
  const [response] = await Promise.all([
    page.waitForResponse(
      (res) => res.url().includes(`/tournaments/${tournamentId}/generate`) && res.request().method() === 'POST',
    ),
    dialog.getByRole('button', { name: '作成する', exact: true }).click(),
  ]);
  expect(response.ok(), `リーグ表生成が失敗しました（status: ${response.status()}）`).toBe(true);
  await page.waitForTimeout(400);
}

/** [A6試合・順位表]で、対戦カードに指定した2名を含む行（対戦者の表記順は問わない）を開き、結果を入力する（シナリオ1 Step8〜10・シナリオ2 Step1） */
export async function enterMatchResultByName(
  page: Page,
  tournamentId: string,
  categoryId: string,
  nameA: string,
  nameB: string,
  scoreForA: string,
  scoreForB: string,
): Promise<void> {
  await page.goto(`/tournaments/${tournamentId}/categories/${categoryId}/matches`);
  const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`${escape(nameA)} - ${escape(nameB)}|${escape(nameB)} - ${escape(nameA)}`);
  const row = page.locator('tr', { hasText: pattern });
  const rowText = await row.innerText();
  const aIsLeftSide = rowText.indexOf(nameA) < rowText.indexOf(nameB);
  await row.click();

  const dialog = page.locator('[role="dialog"]');
  await dialog.waitFor({ state: 'visible' });
  const [scoreA, scoreB] = aIsLeftSide ? [scoreForA, scoreForB] : [scoreForB, scoreForA];
  await dialog.locator('input[type=number]').first().fill(scoreA);
  await dialog.locator('input[type=number]').nth(1).fill(scoreB);

  const [response] = await Promise.all([
    page.waitForResponse(
      (res) =>
        res.url().includes(`/categories/${categoryId}/matches/`) && res.request().method() === 'PUT',
    ),
    dialog.getByRole('button', { name: '保存' }).click(),
  ]);
  expect(response.ok(), '試合結果の保存が失敗しました').toBe(true);
  await dialog.waitFor({ state: 'hidden' });
}
