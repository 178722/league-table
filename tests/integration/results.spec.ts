import { test, expect } from '@playwright/test';
import { addEntrant, createTournament, generateCategories } from './helpers';

async function enterResult(page: import('@playwright/test').Page, scoreA: string, scoreB: string) {
  const dialog = page.locator('[role="dialog"]');
  await dialog.waitFor({ state: 'visible' });
  await dialog.locator('input[type=number]').first().fill(scoreA);
  await dialog.locator('input[type=number]').nth(1).fill(scoreB);
  await dialog.getByRole('button', { name: '保存' }).click();
  await dialog.waitFor({ state: 'hidden' });
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 試合順表の対戦カード行を名前（順不同）で特定し、指定した選手(チーム)が指定したスコアになるよう結果を入力する。
 * リーグ表の並び順は生成時にランダムに決定されるため、対戦カードは「nameA - nameB」「nameB - nameA」のどちらの
 * 表記にもなりうる。審判欄に片方の名前だけが表示される行と誤って一致しないよう、対戦カード特有の「 - 」区切りの
 * パターンで行を特定したうえで、実際の対戦カードの並び順を読み取ってから各入力欄へスコアを振り分ける
 */
async function enterResultByName(
  page: import('@playwright/test').Page,
  tid: string,
  categoryId: string,
  nameA: string,
  nameB: string,
  scoreForA: string,
  scoreForB: string,
) {
  await page.goto(`/tournaments/${tid}/categories/${categoryId}/matches`);
  const pattern = new RegExp(
    `${escapeRegExp(nameA)} - ${escapeRegExp(nameB)}|${escapeRegExp(nameB)} - ${escapeRegExp(nameA)}`,
  );
  const row = page.locator('tr', { hasText: pattern });
  const rowText = await row.innerText();
  const aIsLeftSide = rowText.indexOf(nameA) < rowText.indexOf(nameB);
  await row.click();
  if (aIsLeftSide) {
    await enterResult(page, scoreForA, scoreForB);
  } else {
    await enterResult(page, scoreForB, scoreForA);
  }
}

test.describe('試合結果の保存と再集計の連動（要件定義書3.7・3.8）', () => {
  test('I-RES-01/02: 結果保存・修正のたびに勝敗表が自動再集計される', async ({ page }) => {
    const name = `結果再集計検証-${Date.now()}`;
    const tid = await createTournament(page, { name });
    await addEntrant(page, tid, '選手A');
    await addEntrant(page, tid, '選手B');
    await generateCategories(page, tid, ['カテゴリA']);

    await page.goto(`/tournaments/${tid}/categories/${tid}-A/matches`);
    await page.locator('td.cursor-pointer').first().click();
    await enterResult(page, '25', '20');

    const matrixTable = page.locator('table').first();
    await expect(matrixTable).toContainText('25-20');
    await expect(matrixTable).toContainText('1-0');

    // 修正：スコアを変える→再集計される
    await page.locator('td.cursor-pointer').first().click();
    await enterResult(page, '10', '25');
    await expect(matrixTable).toContainText('10-25');
    await expect(matrixTable).toContainText('0-1');
  });

  test('I-RES-04: タイが解消されるとじゃんけん待ちフラグが解除される', async ({ page }) => {
    const name = `じゃんけん解消検証-${Date.now()}`;
    const tid = await createTournament(page, { name });
    await addEntrant(page, tid, 'エース');
    await addEntrant(page, tid, 'ビショップ');
    await addEntrant(page, tid, 'シーザー');
    await generateCategories(page, tid, ['カテゴリA']);

    // 試合順表の行（対戦カードが一意）から各試合を開き、全員が同点差（5点差）で1勝1敗の循環（3すくみ）にする
    // 全員の得点率を1.0に揃えることで、得点率による決着を防ぎ、真のタイ（じゃんけん待ち）にする
    await enterResultByName(page, tid, `${tid}-A`, 'エース', 'ビショップ', '25', '20'); // エースの勝ち（+5）
    await enterResultByName(page, tid, `${tid}-A`, 'エース', 'シーザー', '20', '25'); // シーザーの勝ち（エース-5）
    await enterResultByName(page, tid, `${tid}-A`, 'ビショップ', 'シーザー', '25', '20'); // ビショップの勝ち（+5、A→B→C→Aの循環を完成させる）

    await page.goto(`/tournaments/${tid}/categories/${tid}-A/matches`);
    await expect(page.locator('text=じゃんけんの結果を入力してください')).toBeVisible();

    // エースが2戦2勝になるよう修正し、タイを解消する
    await enterResultByName(page, tid, `${tid}-A`, 'エース', 'シーザー', '25', '10'); // エースの勝ちに修正
    await page.goto(`/tournaments/${tid}/categories/${tid}-A/matches`);
    await expect(page.locator('text=じゃんけんの結果を入力してください')).toHaveCount(0);
  });

  test('I-RES-03: 同一試合結果を同時に保存しても排他制御せず最後に完了した保存が勝つ', async ({
    page,
  }) => {
    const name = `同時保存検証-${Date.now()}`;
    const tid = await createTournament(page, { name });
    await addEntrant(page, tid, '選手X');
    await addEntrant(page, tid, '選手Y');
    await generateCategories(page, tid, ['カテゴリA']);
    const categoryId = `${tid}-A`;

    // 画面上には試合一覧取得APIが無いため、結果入力ダイアログを1度開いてPUTリクエストのURLから
    // matchIdを取得する（保存ボタンのfetch先: /api/tournaments/:tid/categories/:categoryId/matches/:matchId）
    await page.goto(`/tournaments/${tid}/categories/${categoryId}/matches`);
    const [putRequest] = await Promise.all([
      page.waitForRequest(
        (req) =>
          req.method() === 'PUT' &&
          req.url().includes(`/categories/${categoryId}/matches/`),
      ),
      (async () => {
        await page.locator('td.cursor-pointer').first().click();
        await enterResult(page, '1', '0'); // matchId採取用の仮保存
      })(),
    ]);
    const matchUrl = putRequest.url();
    const matchId = matchUrl.split('/matches/')[1];
    expect(matchId).toBeTruthy();

    // 2クライアントから異なるスコアをほぼ同時に保存する想定で、2本のPUTリクエストを並行送信する。
    // 後から完了させたい方（レスポンスB）の送信をわずかに遅延させ、「後勝ち」を検証できるようにする。
    const bodyA = { sets: [{ scoreA: 25, scoreB: 10 }] };
    const bodyB = { sets: [{ scoreA: 15, scoreB: 25 }] };

    const sendA = page.request.put(matchUrl, { data: bodyA });
    const sendB = (async () => {
      await page.waitForTimeout(50); // Aより後に完了するよう意図的にずらす
      return page.request.put(matchUrl, { data: bodyB });
    })();

    const [resA, resB] = await Promise.all([sendA, sendB]);

    // 両方とも排他エラー(409等)にならず成功系ステータスであること
    expect(resA.ok()).toBeTruthy();
    expect(resB.ok()).toBeTruthy();

    // 後から保存完了したリクエスト（B）の内容が最終状態として残っていること
    const finalMatch = await resB.json();
    expect(finalMatch.data.sets[0]).toMatchObject({ scoreA: 15, scoreB: 25 });

    await page.goto(`/tournaments/${tid}/categories/${categoryId}/matches`);
    const matrixTable = page.locator('table').first();
    await expect(matrixTable).toContainText('15-25');
  });
});
