import type { Match } from '@/types/domain';

export interface MatrixCell {
  matchId: string;
  /** 行選手(チーム)から見た勝敗マーク（◯：勝ち、●：負け、ー：引分、空欄：未入力） */
  mark: string;
  /** セットごとの「行選手(チーム)の得点-列選手(チーム)の得点」。未入力セットは'-' */
  setLines: string[];
  /** 行選手(チーム)から見たセット取得数の要約（例："2-0"）。未対戦なら undefined */
  summary?: string;
}

function findMatchBetween(matches: Match[], aId: string, bId: string): Match | undefined {
  return matches.find(
    (m) =>
      (m.entrantAId === aId && m.entrantBId === bId) ||
      (m.entrantAId === bId && m.entrantBId === aId),
  );
}

// A6・P1共通：リーグ表（総当たり対戦表）の1マス分の表示内容を、行選手(チーム)視点で組み立てる
export function buildMatrixCell(
  matches: Match[],
  rowEntrantId: string,
  columnEntrantId: string,
): MatrixCell | null {
  const match = findMatchBetween(matches, rowEntrantId, columnEntrantId);
  if (!match) return null;

  const rowIsA = match.entrantAId === rowEntrantId;
  const setLines = match.sets.map((set) => {
    if (set.scoreA === null || set.scoreB === null) return '-';
    const rowScore = rowIsA ? set.scoreA : set.scoreB;
    const columnScore = rowIsA ? set.scoreB : set.scoreA;
    return `${rowScore}-${columnScore}`;
  });

  const playedSets = match.sets.filter((s) => s.scoreA !== null && s.scoreB !== null);
  if (playedSets.length === 0) {
    return { matchId: match.id, mark: '', setLines };
  }

  const rowSetWins = playedSets.filter((s) =>
    rowIsA ? (s.scoreA ?? 0) > (s.scoreB ?? 0) : (s.scoreB ?? 0) > (s.scoreA ?? 0),
  ).length;
  const columnSetWins = playedSets.filter((s) =>
    rowIsA ? (s.scoreB ?? 0) > (s.scoreA ?? 0) : (s.scoreA ?? 0) > (s.scoreB ?? 0),
  ).length;

  const mark = rowSetWins === columnSetWins ? 'ー' : rowSetWins > columnSetWins ? '◯' : '●';

  return { matchId: match.id, mark, setLines, summary: `${rowSetWins}-${columnSetWins}` };
}
