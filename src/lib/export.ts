// A7. データ出力画面：大会全体のExcel（.xlsx）生成（要件定義書3.9）

import ExcelJS from 'exceljs';
import {
  getCategoryMatches,
  getEnabledCategories,
  getEntrants,
  getMatches,
  getStandings,
  getTournament,
  sortByDisplayOrder,
} from '@/lib/mock-data';
import { renderLeagueTableImage } from '@/lib/league-image';
import { formatDate } from '@/lib/format';
import type { Category, Entrant, Match, StandingRow } from '@/types/domain';

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFEFEFEF' },
};

function applyHeaderStyle(row: ExcelJS.Row): void {
  row.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = { bold: true };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin' },
      bottom: { style: 'thin' },
      left: { style: 'thin' },
      right: { style: 'thin' },
    };
  });
}

function borderAllCells(sheet: ExcelJS.Worksheet, fromRow: number, toRow: number): void {
  for (let r = fromRow; r <= toRow; r += 1) {
    sheet.getRow(r).eachCell({ includeEmpty: true }, (cell) => {
      cell.border = {
        top: { style: 'thin' },
        bottom: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' },
      };
    });
  }
}

/** シート1：大会情報 */
function buildTournamentSheet(
  workbook: ExcelJS.Workbook,
  tournamentId: string,
  categories: Category[],
): void {
  const tournament = getTournament(tournamentId);
  if (!tournament) throw new Error('tournament not found');

  const sheet = workbook.addWorksheet('大会情報');
  sheet.columns = [{ width: 16 }, { width: 40 }];
  sheet.addRow(['大会名', tournament.name]);
  sheet.addRow(['開催日', formatDate(tournament.date)]);
  sheet.addRow(['開催場所', tournament.location]);
  sheet.addRow(['ステータス', tournament.status]);
  sheet.addRow([
    'カテゴリ',
    categories.map((c) => `カテゴリ${c.key}：${c.name}`).join('、'),
  ]);
  sheet.eachRow((row) => {
    row.getCell(1).font = { bold: true };
    row.getCell(1).fill = HEADER_FILL;
  });
  borderAllCells(sheet, 1, sheet.rowCount);
}

/** シート2：競技情報（縦軸：カテゴリ、横軸：設定内容） */
function buildCategoriesSheet(workbook: ExcelJS.Workbook, categories: Category[]): void {
  const sheet = workbook.addWorksheet('競技情報');
  const header = [
    'カテゴリ',
    'セット数',
    '順位決定方式',
    '勝利勝点',
    '引分勝点',
    '敗北勝点',
    'コート数',
    '1コート最大選手(チーム)数',
    'リーグ形式',
  ];
  sheet.columns = header.map((title) => ({ header: title, width: Math.max(title.length + 2, 10) }));
  applyHeaderStyle(sheet.getRow(1));

  for (const category of categories) {
    const s = category.settings;
    sheet.addRow([
      `カテゴリ${category.key}：${category.name}`,
      s.setCount,
      s.rankingMethod,
      s.rankingMethod === '勝点方式' ? (s.winPoints ?? '') : '',
      s.rankingMethod === '勝点方式' ? (s.drawPoints ?? '') : '',
      s.rankingMethod === '勝点方式' ? (s.losePoints ?? '') : '',
      s.courtCount,
      s.maxEntrantsPerCourt,
      s.leagueFormat,
    ]);
  }
  borderAllCells(sheet, 1, sheet.rowCount);
}

/** シート3：選手(チーム) */
function buildEntrantsSheet(
  workbook: ExcelJS.Workbook,
  tournamentId: string,
  categories: Category[],
): void {
  const sheet = workbook.addWorksheet('選手(チーム)');
  const header = ['選手(チーム)名', '所属', 'カテゴリ'];
  sheet.columns = header.map((title) => ({ header: title, width: Math.max(title.length + 2, 12) }));
  applyHeaderStyle(sheet.getRow(1));

  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const entrants = getEntrants(tournamentId);
  for (const entrant of entrants) {
    const category = categoryById.get(entrant.categoryId);
    sheet.addRow([
      entrant.name,
      entrant.affiliation ?? '',
      category ? `カテゴリ${category.key}：${category.name}` : '',
    ]);
  }
  borderAllCells(sheet, 1, sheet.rowCount);
}

function courtEntrants(tournamentId: string, category: Category, court: number): Entrant[] {
  const all = getEntrants(tournamentId, category.id);
  return sortByDisplayOrder(
    category.settings.courtCount < 2 ? all : all.filter((e) => e.courtNumber === court),
  );
}

/**
 * シート名はExcelの制約（31文字以内・一部記号不可）に合わせてサニタイズする。
 * カテゴリ名が長い場合、末尾のコート番号表記が切り捨てられて複数シートが同名になり
 * （Excelはシート名の重複を許可しないためエラーになる）生成に失敗するのを防ぐため、
 * 「カテゴリX：」の接頭辞と「(コートN)」の接尾辞は必ず残し、カテゴリ名部分のみを短縮する
 */
function sheetTitle(category: Category, suffix: string): string {
  const prefix = `カテゴリ${category.key}：`;
  const maxNameLength = 31 - prefix.length - suffix.length;
  const name =
    category.name.length > maxNameLength
      ? `${category.name.slice(0, Math.max(0, maxNameLength - 1))}…`
      : category.name;
  return `${prefix}${name}${suffix}`.replace(/[[\]*/\\?:]/g, '_');
}

/** シート4以降：カテゴリ（・独立リーグの場合はコート）毎のリーグ表・勝敗表（順位表）。文字の表ではなく画像として埋め込む */
function buildLeagueSheet(
  workbook: ExcelJS.Workbook,
  title: string,
  entrants: Entrant[],
  matches: Match[],
  standings: StandingRow[],
  category: Category,
): void {
  const sheet = workbook.addWorksheet(title, {
    pageSetup: { fitToPage: false, orientation: 'landscape' },
  });

  const { buffer, width, height } = renderLeagueTableImage({
    title,
    entrants,
    matches,
    standings,
    category,
  });

  // 画像のみでセルが空のままだとdimensionが極端に小さくなるため、画像の大きさに合わせて実際のセル領域を確保する
  // （Excelの列幅は概ね1単位=7px、行の高さはポイント単位＝1px=0.75pt換算）
  sheet.getColumn(1).width = Math.ceil(width / 7);
  sheet.getRow(1).height = Math.ceil(height * 0.75);

  // exceljsの型定義が独自にBufferを再宣言しており、Node標準のBuffer型と構造的に一致しないため、ここでのみキャストする
  const imageId = workbook.addImage({ buffer, extension: 'png' } as unknown as ExcelJS.Image);
  sheet.addImage(imageId, { tl: { col: 0, row: 0 }, ext: { width, height } });
}

/** 大会全体のデータをExcelブック（.xlsx）として生成する（要件定義書3.9） */
export async function buildTournamentWorkbook(tournamentId: string): Promise<ExcelJS.Buffer> {
  const workbook = new ExcelJS.Workbook();
  const categories = getEnabledCategories(tournamentId);

  buildTournamentSheet(workbook, tournamentId, categories);
  buildCategoriesSheet(workbook, categories);
  buildEntrantsSheet(workbook, tournamentId, categories);

  for (const category of categories) {
    if (category.generationStatus !== '生成済み') continue;

    if (category.settings.leagueFormat === '単一リーグ') {
      const entrants = sortByDisplayOrder(getEntrants(tournamentId, category.id));
      const matches = getCategoryMatches(category.id, category.settings.courtCount);
      const standings = getStandings(category.id, 0);
      buildLeagueSheet(workbook, sheetTitle(category, ''), entrants, matches, standings, category);
      continue;
    }

    const courts = Array.from({ length: category.settings.courtCount }, (_, i) => i + 1);
    for (const court of courts) {
      const entrants = courtEntrants(tournamentId, category, court);
      const matches = getMatches(category.id, court);
      const standings = getStandings(category.id, court);
      const suffix = category.settings.courtCount >= 2 ? `(コート${court})` : '';
      buildLeagueSheet(
        workbook,
        sheetTitle(category, suffix),
        entrants,
        matches,
        standings,
        category,
      );
    }
  }

  return workbook.xlsx.writeBuffer();
}

/** データ出力ファイル名（例：リーグ戦しようよ_大会名_20261110.xlsx） */
export function buildExportFileName(tournamentId: string): string {
  const tournament = getTournament(tournamentId);
  const safeName = (tournament?.name ?? tournamentId).replace(/[\\/:*?"<>|]/g, '_');
  const dateStamp = formatDate(new Date().toISOString()).replace(/\//g, '');
  return `リーグ戦しようよ_${safeName}_${dateStamp}.xlsx`;
}
