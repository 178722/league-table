import { expect, type Page } from '@playwright/test';

/** A3新規作成フォームから大会を作成し、作成された大会IDを返す */
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

/** A3編集モードで指定カテゴリ(B〜J)を有効化し、名称を設定して保存する */
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

  // 保存ボタン押下によるPUTの完了（成功）を明示的に待つ。レスポンスを確認せず進むと、
  // サーバー側が何らかの理由でエラーを返した場合にカテゴリが実際には有効化されないまま
  // 後続の操作（例：当該カテゴリへの選手登録）が実行され、原因の分かりにくいタイムアウトに
  // つながるため（結合テストの診断性向上のための対応）
  const [response] = await Promise.all([
    page.waitForResponse(
      (res) => res.url().includes(`/api/tournaments/${tournamentId}`) && res.request().method() === 'PUT',
    ),
    page.click('button:has-text("保存")'),
  ]);
  expect(response.ok(), `カテゴリ${key}の有効化PUTが失敗しました（status: ${response.status()}）`).toBe(true);
  await page.waitForTimeout(300);
}

/** A6で選手(チーム)を1件登録し、保存ボタンでサーバーへ反映する。登録された選手(チーム)のIDを返す */
export async function addEntrant(
  page: Page,
  tournamentId: string,
  name: string,
  opts?: { categoryLabel?: string },
): Promise<string> {
  await page.goto(`/tournaments/${tournamentId}/players`);
  await page.click('button:has-text("+ 新規登録")');
  const dialog = page.locator('[role="dialog"]');
  await dialog.waitFor({ state: 'visible' });
  await dialog.locator('#name').fill(name);
  if (opts?.categoryLabel) {
    await dialog.locator('#categoryId').selectOption({ label: opts.categoryLabel });
  }
  // 選手(チーム)登録ダイアログには「保存して次へ」ボタンも存在するため、厳密一致で区別する
  await dialog.getByRole('button', { name: '保存', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });

  const [response] = await Promise.all([
    page.waitForResponse(
      (res) => res.url().includes(`/api/tournaments/${tournamentId}/entrants`) && res.request().method() === 'POST',
    ),
    page.getByRole('button', { name: '保存', exact: true }).first().click(),
  ]);
  await page.waitForTimeout(300);
  const body = await response.json();
  return body.data.id as string;
}

/** 設定保存ボタン押下によるPUTの完了を明示的に待つ（結合テストの診断性・安定性向上のための共通処理）。
 *  待たずに後続操作へ進むと、サーバー側の反映前に次のページ遷移でリクエストが打ち切られ、
 *  見た目上は古い設定のまま処理が進んでしまう（結果が食い違う原因の分かりにくいレースにつながる） */
async function clickSaveAndWaitForSettingsPut(
  page: Page,
  tournamentId: string,
  categoryId: string,
): Promise<void> {
  const [response] = await Promise.all([
    page.waitForResponse(
      (res) =>
        res.url().includes(`/tournaments/${tournamentId}/categories/${categoryId}/settings`) &&
        res.request().method() === 'PUT',
    ),
    page.getByRole('button', { name: '保存' }).click(),
  ]);
  expect(response.ok(), `競技情報設定PUTが失敗しました（status: ${response.status()}）`).toBe(true);
  await page.waitForTimeout(300);
}

/** A5でコート数・リーグ形式（独立リーグ／単一リーグ）を設定して保存する */
export async function setLeagueFormat(
  page: Page,
  tournamentId: string,
  categoryId: string,
  opts: { courtCount: number; singleLeague: boolean },
): Promise<void> {
  await page.goto(`/tournaments/${tournamentId}/categories/${categoryId}/settings`);
  await page.locator('#courtCount').selectOption(String(opts.courtCount));
  const checkbox = page.locator('#leagueFormat');
  if ((await checkbox.isChecked()) !== opts.singleLeague) {
    await checkbox.click();
  }
  await clickSaveAndWaitForSettingsPut(page, tournamentId, categoryId);
}

/** A4競技情報編集画面で、セット数・順位決定方式・勝点・コート数・1コート最大選手(チーム)数・リーグ形式をまとめて設定して保存する */
export async function setCategorySettings(
  page: Page,
  tournamentId: string,
  categoryId: string,
  opts: {
    setCount?: number;
    rankingMethod?: '勝敗方式' | '勝点方式';
    winPoints?: number;
    drawPoints?: number;
    losePoints?: number;
    courtCount?: number;
    maxEntrantsPerCourt?: number;
    singleLeague?: boolean;
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
  if (opts.rankingMethod === '勝点方式') {
    if (opts.winPoints !== undefined) await page.locator('#winPoints').fill(String(opts.winPoints));
    if (opts.drawPoints !== undefined) await page.locator('#drawPoints').fill(String(opts.drawPoints));
    if (opts.losePoints !== undefined) await page.locator('#losePoints').fill(String(opts.losePoints));
  }
  if (opts.maxEntrantsPerCourt !== undefined) {
    await page.locator('#maxEntrantsPerCourt').selectOption(String(opts.maxEntrantsPerCourt));
  }
  if (opts.singleLeague !== undefined) {
    const checkbox = page.locator('#leagueFormat');
    if ((await checkbox.isChecked()) !== opts.singleLeague) {
      await checkbox.click();
    }
  }

  await clickSaveAndWaitForSettingsPut(page, tournamentId, categoryId);
}

/** A3「リーグ表を作成する」から指定カテゴリ名を選択して生成を実行する */
export async function generateCategories(page: Page, tournamentId: string, categoryLabels: string[]) {
  await page.goto(`/tournaments/${tournamentId}`);
  await page.click('button:has-text("リーグ表を作成する")');
  await page.waitForSelector('text=リーグ表を作成する対象を選択してください');
  for (const label of categoryLabels) {
    await page.locator('label', { hasText: label }).locator('input[type=checkbox]').check();
  }
  const dialog = page.locator('[role="dialog"]');

  // 固定のwaitForTimeoutだけに頼ると、生成POSTの完了前に後続の操作（page.goto等）が走り、
  // ブラウザ側からは未完了のままリクエストが打ち切られる（サーバー側は裏で処理を続け、
  // 後から見ると生成が完了しているように見える）レースが発生しうるため、レスポンスを明示的に待つ
  const [response] = await Promise.all([
    page.waitForResponse(
      (res) => res.url().includes(`/tournaments/${tournamentId}/generate`) && res.request().method() === 'POST',
    ),
    dialog.getByRole('button', { name: '作成する', exact: true }).click(),
  ]);
  expect(response.ok(), `リーグ表生成POSTが失敗しました（status: ${response.status()}）`).toBe(true);
  await page.waitForTimeout(400);
}

/** [A6]試合・順位表画面で先頭のマスをクリックし、結果（セットスコア）を1件登録する */
export async function registerFirstMatchResult(
  page: Page,
  tournamentId: string,
  categoryId: string,
): Promise<void> {
  await page.goto(`/tournaments/${tournamentId}/categories/${categoryId}/matches`);
  await page.locator('td.cursor-pointer').first().click();
  const dialog = page.locator('[role="dialog"]');
  await dialog.waitFor({ state: 'visible' });
  await dialog.locator('input[type=number]').first().fill('25');
  await dialog.locator('input[type=number]').nth(1).fill('20');
  await dialog.getByRole('button', { name: '保存' }).click();
  await dialog.waitFor({ state: 'hidden' });
}
