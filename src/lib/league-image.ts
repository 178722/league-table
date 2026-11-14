// A7. データ出力画面：リーグ表・勝敗表をテキスト表ではなく画像（PNG）として描画する（カテゴリ・コート毎に1枚）
import path from 'node:path';
import { createCanvas, registerFont, type CanvasRenderingContext2D } from 'canvas';
import { buildMatrixCell } from '@/lib/league-matrix';
import { formatRate } from '@/lib/format';
import type { Category, Entrant, Match, StandingRow } from '@/types/domain';

// OS側に日本語フォントが入っていない端末（Electron配布先の新規端末等）でも文字化けしないよう、
// フォントファイルをリポジトリに同梱し明示的に登録する（assets/fonts/README.md参照）
const BUNDLED_FONT_FAMILY = 'LeagueTable IPAGothic';
registerFont(path.join(process.cwd(), 'assets', 'fonts', 'ipag.ttf'), {
  family: BUNDLED_FONT_FAMILY,
});

const FONT_FAMILY = `"${BUNDLED_FONT_FAMILY}", "IPAGothic", "Noto Sans CJK JP", "Noto Sans JP", sans-serif`;
const FONT_SIZE = 14;
const LINE_HEIGHT = 18;
const CELL_PADDING_X = 8;
const CELL_PADDING_Y = 6;
const MIN_COL_WIDTH = 70;
const TITLE_HEIGHT = 32;

export interface RenderLeagueTableInput {
  title: string;
  entrants: Entrant[];
  matches: Match[];
  standings: StandingRow[];
  category: Category;
}

export interface RenderedTableImage {
  buffer: Buffer;
  width: number;
  height: number;
}

function drawGridRow(
  ctx: CanvasRenderingContext2D,
  colX: number[],
  y: number,
  height: number,
  totalWidth: number,
): void {
  ctx.strokeStyle = '#999999';
  ctx.lineWidth = 1;
  for (const x of colX) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + height);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(0, y + height);
  ctx.lineTo(totalWidth, y + height);
  ctx.stroke();
}

/** リーグ表・勝敗表（順位表）を1枚のPNG画像として描画する */
export function renderLeagueTableImage(input: RenderLeagueTableInput): RenderedTableImage {
  const { title, entrants, matches, standings, category } = input;
  const standingByEntrantId = new Map(standings.map((r) => [r.entrantId, r]));

  const statHeaders = [
    '試合',
    '勝',
    '分',
    '負',
    'セット率',
    '得点',
    '失点',
    '得点率',
    ...(category.settings.rankingMethod === '勝点方式' ? ['勝点'] : []),
    '順位',
  ];

  const matrixCellLines: string[][][] = entrants.map((rowEntrant) =>
    entrants.map((colEntrant) => {
      if (colEntrant.id === rowEntrant.id) return [];
      const cell = buildMatrixCell(matches, rowEntrant.id, colEntrant.id);
      if (!cell) return ['―'];
      const lines: string[] = [];
      const headLine = [cell.mark, cell.summary].filter(Boolean).join('  ');
      if (headLine) lines.push(headLine);
      for (const line of cell.setLines) if (line !== '-') lines.push(line);
      return lines.length > 0 ? lines : ['―'];
    }),
  );

  const statRows: string[][] = entrants.map((rowEntrant) => {
    const standing = standingByEntrantId.get(rowEntrant.id);
    const values = [
      String((standing?.wins ?? 0) + (standing?.draws ?? 0) + (standing?.losses ?? 0)),
      String(standing?.wins ?? 0),
      String(standing?.draws ?? 0),
      String(standing?.losses ?? 0),
      standing ? formatRate(standing.setRate) : '-',
      String(standing?.pointsFor ?? '-'),
      String(standing?.pointsAgainst ?? '-'),
      standing ? formatRate(standing.pointRate) : '-',
    ];
    if (category.settings.rankingMethod === '勝点方式') {
      values.push(String(standing?.points ?? '-'));
    }
    values.push(standing ? `${standing.rank}${standing.isTie ? '*' : ''}` : '-');
    return values;
  });

  const measureCanvas = createCanvas(10, 10);
  const measureCtx = measureCanvas.getContext('2d');
  measureCtx.font = `${FONT_SIZE}px ${FONT_FAMILY}`;
  const measure = (text: string) => measureCtx.measureText(text).width;

  const nameColWidth = Math.max(
    MIN_COL_WIDTH,
    ...entrants.map((e) => measure(e.name) + CELL_PADDING_X * 2),
  );
  const oppColWidths = entrants.map((e) =>
    Math.max(MIN_COL_WIDTH, measure(e.name) + CELL_PADDING_X * 2),
  );
  const statColWidths = statHeaders.map((h) => Math.max(MIN_COL_WIDTH, measure(h) + CELL_PADDING_X * 2));
  const colWidths = [nameColWidth, ...oppColWidths, ...statColWidths];
  const totalWidth = colWidths.reduce((a, b) => a + b, 0);

  const headerRowHeight = LINE_HEIGHT + CELL_PADDING_Y * 2;
  const rowHeights = entrants.map((_, rowIndex) => {
    const maxLines = Math.max(1, ...matrixCellLines[rowIndex].map((lines) => lines.length));
    return maxLines * LINE_HEIGHT + CELL_PADDING_Y * 2;
  });
  const totalHeight = TITLE_HEIGHT + headerRowHeight + rowHeights.reduce((a, b) => a + b, 0) + 1;

  const canvas = createCanvas(totalWidth + 1, totalHeight);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textBaseline = 'middle';

  ctx.fillStyle = '#000000';
  ctx.font = `bold ${FONT_SIZE + 2}px ${FONT_FAMILY}`;
  ctx.textAlign = 'left';
  ctx.fillText(title, CELL_PADDING_X, TITLE_HEIGHT / 2);

  const colX: number[] = [0];
  for (const w of colWidths) colX.push(colX[colX.length - 1] + w);

  const headerLabels = ['', ...entrants.map((e) => e.name), ...statHeaders];

  let y = TITLE_HEIGHT;

  ctx.fillStyle = '#efefef';
  ctx.fillRect(0, y, totalWidth, headerRowHeight);
  ctx.fillStyle = '#000000';
  ctx.font = `bold ${FONT_SIZE}px ${FONT_FAMILY}`;
  ctx.textAlign = 'center';
  headerLabels.forEach((label, i) => {
    const cx = (colX[i] + colX[i + 1]) / 2;
    ctx.fillText(label, cx, y + headerRowHeight / 2);
  });
  drawGridRow(ctx, colX, y, headerRowHeight, totalWidth);
  y += headerRowHeight;

  entrants.forEach((rowEntrant, rowIndex) => {
    const rowHeight = rowHeights[rowIndex];

    ctx.textAlign = 'left';
    ctx.font = `bold ${FONT_SIZE}px ${FONT_FAMILY}`;
    ctx.fillText(rowEntrant.name, colX[0] + CELL_PADDING_X, y + rowHeight / 2);

    ctx.font = `${FONT_SIZE}px ${FONT_FAMILY}`;
    entrants.forEach((colEntrant, colIndex) => {
      const cellX0 = colX[1 + colIndex];
      const cellX1 = colX[2 + colIndex];
      if (colEntrant.id === rowEntrant.id) {
        ctx.beginPath();
        ctx.moveTo(cellX0, y);
        ctx.lineTo(cellX1, y + rowHeight);
        ctx.strokeStyle = '#000000';
        ctx.stroke();
        return;
      }
      const lines = matrixCellLines[rowIndex][colIndex];
      ctx.textAlign = 'center';
      const cx = (cellX0 + cellX1) / 2;
      const linesHeight = lines.length * LINE_HEIGHT;
      const startY = y + rowHeight / 2 - linesHeight / 2 + LINE_HEIGHT / 2;
      lines.forEach((line, li) => {
        ctx.fillText(line, cx, startY + li * LINE_HEIGHT);
      });
    });

    ctx.textAlign = 'center';
    statRows[rowIndex].forEach((value, statIndex) => {
      const cellX0 = colX[1 + entrants.length + statIndex];
      const cellX1 = colX[2 + entrants.length + statIndex];
      const cx = (cellX0 + cellX1) / 2;
      ctx.fillText(value, cx, y + rowHeight / 2);
    });

    drawGridRow(ctx, colX, y, rowHeight, totalWidth);
    y += rowHeight;
  });

  ctx.strokeStyle = '#000000';
  ctx.strokeRect(0, TITLE_HEIGHT, totalWidth, y - TITLE_HEIGHT);

  return { buffer: Buffer.from(canvas.toBuffer('image/png')), width: totalWidth, height: totalHeight };
}
