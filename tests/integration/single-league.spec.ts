import { test, expect } from '@playwright/test';
import {
  addEntrant,
  createTournament,
  generateCategories,
  registerFirstMatchResult,
  setLeagueFormat,
} from './helpers';

test.describe('単一リーグ・複数コート対応（要件定義書5章）', () => {
  test('I-SGL-01: 単一リーグ生成後、コートタブが非表示になり統合順位表・コート別列を持つ試合順表・運営スタッフ表示になる', async ({
    page,
  }) => {
    const name = `単一リーグ検証-${Date.now()}`;
    const tid = await createTournament(page, { name });
    const categoryId = `${tid}-A`;

    await setLeagueFormat(page, tid, categoryId, { courtCount: 2, singleLeague: true });

    // N=4・コート2で全選手(チーム)が常に同時出場するため、全試合で審判が「運営スタッフ」表示になる
    await addEntrant(page, tid, '選手A');
    await addEntrant(page, tid, '選手B');
    await addEntrant(page, tid, '選手C');
    await addEntrant(page, tid, '選手D');
    await generateCategories(page, tid, ['カテゴリA']);

    await page.goto(`/tournaments/${tid}/categories/${categoryId}/matches`);

    // コートタブ（「コート1」「コート2」のリンク）が表示されない
    await expect(page.locator('a:has-text("コート1")')).toHaveCount(0);
    await expect(page.locator('a:has-text("コート2")')).toHaveCount(0);

    // 統合されたリーグ表・勝敗表が1つだけ表示される
    await expect(page.locator('text=リーグ表・勝敗表')).toBeVisible();

    // 試合順表は1つの表にまとまり、試合順列を共有しつつコート毎に見出し（th）で列が分かれる
    await expect(page.locator('th:has-text("コート1")')).toBeVisible();
    await expect(page.locator('th:has-text("コート2")')).toBeVisible();
    await expect(page.locator('th:has-text("試合順")')).toHaveCount(1);

    // N=4・コート2の総当たり6試合は、同一試合順（同時進行）が2コート分横に並ぶため3行に収まる
    const matchOrderTable = page.locator('table', { has: page.locator('th:has-text("コート1")') });
    await expect(matchOrderTable.locator('tbody tr')).toHaveCount(3);
    await expect(page.getByRole('button', { name: '未入力' })).toHaveCount(6);

    // 審判が割り当てられず「運営スタッフ」が赤字表示される
    await expect(page.locator('text=運営スタッフ').first()).toBeVisible();
  });

  test('I-SGL-02: 単一リーグで結果入力後、統合された勝敗表（勝ち数等）が再集計される', async ({
    page,
  }) => {
    const name = `単一リーグ再集計検証-${Date.now()}`;
    const tid = await createTournament(page, { name });
    const categoryId = `${tid}-A`;

    await setLeagueFormat(page, tid, categoryId, { courtCount: 2, singleLeague: true });

    await addEntrant(page, tid, '選手A');
    await addEntrant(page, tid, '選手B');
    await addEntrant(page, tid, '選手C');
    await addEntrant(page, tid, '選手D');
    await generateCategories(page, tid, ['カテゴリA']);

    // リーグ表の行・列はリーグ表生成時にランダムな順序で決定されるため、先頭行の選手(チーム)名は
    // 固定できない。結果入力前に先頭行の名前を読み取り、その行が再集計されることを確認する
    await page.goto(`/tournaments/${tid}/categories/${categoryId}/matches`);
    const matrixTable = page.locator('table').first();
    const firstRowName = await matrixTable.locator('tbody tr').first().locator('th').first().innerText();

    // コート別（categoryId:court）ではなく統合キー（categoryId:0）が正しく再集計されるかを検証する
    // （修正前は結果入力後も統合勝敗表の勝ち数等が0のまま更新されない不具合があった）
    // 先頭行×先頭の対戦相手列（最初にクリック可能なマス）の試合で、先頭行の選手(チーム)が勝つように入力する
    await registerFirstMatchResult(page, tid, categoryId);

    const winnerRow = matrixTable.locator('tr', { has: page.locator('th', { hasText: firstRowName }) });
    await expect(winnerRow.locator('td').nth(4)).toHaveText('1'); // 試合数
    await expect(winnerRow.locator('td').nth(5)).toHaveText('1'); // 勝ち数
  });
});
