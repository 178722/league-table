import { test, expect } from '@playwright/test';
import ExcelJS from 'exceljs';
import { addEntrant, createTournament, generateCategories } from './helpers';

test.describe('データ出力（要件定義書3.9）', () => {
  test('I-EXP-01: データ出力ボタン押下でExcel（.xlsx）ファイルが生成される', async ({
    page,
    request,
  }) => {
    const tid = await createTournament(page, { name: `データ出力検証-${Date.now()}` });
    await addEntrant(page, tid, '選手A');
    await addEntrant(page, tid, '選手B');
    await generateCategories(page, tid, ['カテゴリA']);

    const res = await request.get(`/api/tournaments/${tid}/export/xlsx`);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(res.headers()['content-disposition']).toContain('.xlsx');

    const body = await res.body();
    // xlsxはZIP形式のため、ZIPマジックナンバー（プレースホルダー・ダミーファイルではない実ファイルであることの確認）
    expect(body.subarray(0, 2).toString()).toBe('PK');

    const workbook = new ExcelJS.Workbook();
    // exceljsが依存する@fast-csv経由の古い@types/nodeとBuffer型が食い違うための型キャスト
    await workbook.xlsx.load(Buffer.from(body) as unknown as Parameters<
      typeof workbook.xlsx.load
    >[0]);
    const sheetNames = workbook.worksheets.map((sheet) => sheet.name);
    expect(sheetNames[0]).toBe('大会情報');
    expect(sheetNames[1]).toBe('競技情報');
    expect(sheetNames[2]).toBe('選手(チーム)');
    // 生成済みのカテゴリAのリーグ表シートがシート4以降に含まれる
    expect(sheetNames.length).toBeGreaterThan(3);
  });

  test('I-EXP-02: データ出力ボタンは将来対応として一旦保留中のため共通ヘッダーに表示されない', async ({
    page,
  }) => {
    const tid = await createTournament(page, { name: `データ出力非表示検証-${Date.now()}` });

    await page.goto('/tournaments');
    await expect(page.locator('a:has-text("データ出力"), button:has-text("データ出力")')).toHaveCount(0);

    await page.goto('/settings/backup');
    await expect(page.locator('a:has-text("データ出力"), button:has-text("データ出力")')).toHaveCount(0);

    await page.goto(`/tournaments/${tid}`);
    await expect(page.locator('a:has-text("データ出力"), button:has-text("データ出力")')).toHaveCount(0);
  });
});
