import { test, expect } from '@playwright/test';
import ExcelJS from 'exceljs';

test.describe('データ出力（要件定義書3.9）', () => {
  test('I-EXP-01: データ出力ボタン押下でExcel（.xlsx）ファイルが生成される', async ({
    request,
  }) => {
    const res = await request.get('/api/tournaments/volleyball/export/xlsx');
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
    // 生成済みのカテゴリ（volleyball-A・volleyball-C）のリーグ表シートがシート4以降に含まれる
    expect(sheetNames.length).toBeGreaterThan(3);
  });

  test('I-EXP-02: データ出力ボタンは将来対応として一旦保留中のため共通ヘッダーに表示されない', async ({
    page,
  }) => {
    await page.goto('/tournaments');
    await expect(page.locator('a:has-text("データ出力"), button:has-text("データ出力")')).toHaveCount(0);

    await page.goto('/settings/backup');
    await expect(page.locator('a:has-text("データ出力"), button:has-text("データ出力")')).toHaveCount(0);

    await page.goto('/tournaments/volleyball');
    await expect(page.locator('a:has-text("データ出力"), button:has-text("データ出力")')).toHaveCount(0);
  });
});
