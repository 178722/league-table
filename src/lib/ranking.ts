// 試合結果自動計算・順位決定ロジック（要件定義書3.8）
// 間違えやすいコアロジックのため、要件定義書の記述に忠実に実装する

import type { CategorySettings, Match, StandingRow } from '@/types/domain';

interface MatchOutcome {
  opponentId: string;
  result: 'win' | 'draw' | 'loss';
  setsWon: number;
  setsLost: number;
  pointsFor: number;
  pointsAgainst: number;
}

function outcomeFor(match: Match, entrantId: string): MatchOutcome | null {
  const isA = match.entrantAId === entrantId;
  const isB = match.entrantBId === entrantId;
  if (!isA && !isB) return null;

  const opponentId = isA ? match.entrantBId : match.entrantAId;
  const playedSets = match.sets.filter((s) => s.scoreA !== null && s.scoreB !== null);

  let setsWon = 0;
  let setsLost = 0;
  let pointsFor = 0;
  let pointsAgainst = 0;

  for (const set of playedSets) {
    const own = isA ? (set.scoreA ?? 0) : (set.scoreB ?? 0);
    const opp = isA ? (set.scoreB ?? 0) : (set.scoreA ?? 0);
    pointsFor += own;
    pointsAgainst += opp;
    if (own > opp) setsWon += 1;
    else if (own < opp) setsLost += 1;
  }

  const result: MatchOutcome['result'] =
    setsWon === setsLost ? 'draw' : setsWon > setsLost ? 'win' : 'loss';

  return { opponentId, result, setsWon, setsLost, pointsFor, pointsAgainst };
}

interface Accumulated {
  entrantId: string;
  wins: number;
  draws: number;
  losses: number;
  setsWon: number;
  setsLost: number;
  pointsFor: number;
  pointsAgainst: number;
  outcomesByOpponent: Map<string, MatchOutcome>;
}

function accumulate(entrantIds: string[], matches: Match[]): Map<string, Accumulated> {
  const table = new Map<string, Accumulated>(
    entrantIds.map((id) => [
      id,
      {
        entrantId: id,
        wins: 0,
        draws: 0,
        losses: 0,
        setsWon: 0,
        setsLost: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        outcomesByOpponent: new Map(),
      },
    ]),
  );

  const decidedMatches = matches.filter((m) => m.status === '入力済み');
  for (const match of decidedMatches) {
    for (const entrantId of [match.entrantAId, match.entrantBId]) {
      const row = table.get(entrantId);
      const outcome = outcomeFor(match, entrantId);
      if (!row || !outcome) continue;
      if (outcome.result === 'win') row.wins += 1;
      else if (outcome.result === 'draw') row.draws += 1;
      else row.losses += 1;
      row.setsWon += outcome.setsWon;
      row.setsLost += outcome.setsLost;
      row.pointsFor += outcome.pointsFor;
      row.pointsAgainst += outcome.pointsAgainst;
      row.outcomesByOpponent.set(outcome.opponentId, outcome);
    }
  }

  return table;
}

/**
 * 比率（セット率＝得セット数÷失セット数、得点率＝得点÷失点）を算出する。
 * 分母が0の場合、分子が正ならInfinity（無敗/無失点）、分子も0なら試合未実施として0を返す
 */
function computeRate(numerator: number, denominator: number): number {
  if (denominator > 0) return numerator / denominator;
  return numerator > 0 ? Infinity : 0;
}

function toStandingRow(
  row: Accumulated,
  settings: CategorySettings,
): Omit<StandingRow, 'rank' | 'isTie' | 'jankenPending'> {
  const points =
    settings.rankingMethod === '勝点方式'
      ? row.wins * (settings.winPoints ?? 0) +
        row.draws * (settings.drawPoints ?? 0) +
        row.losses * (settings.losePoints ?? 0)
      : undefined;

  return {
    entrantId: row.entrantId,
    wins: row.wins,
    draws: row.draws,
    losses: row.losses,
    setsWon: row.setsWon,
    setsLost: row.setsLost,
    setRate: computeRate(row.setsWon, row.setsLost),
    pointsFor: row.pointsFor,
    pointsAgainst: row.pointsAgainst,
    pointRate: computeRate(row.pointsFor, row.pointsAgainst),
    points,
  };
}

function primaryScore(
  row: Omit<StandingRow, 'rank' | 'isTie' | 'jankenPending'>,
  settings: CategorySettings,
): number {
  return settings.rankingMethod === '勝点方式' ? (row.points ?? 0) : row.wins;
}

function sortKey(
  row: Omit<StandingRow, 'rank' | 'isTie' | 'jankenPending'>,
  settings: CategorySettings,
): [number, number, number] {
  return [primaryScore(row, settings), row.setRate, row.pointRate];
}

function sameKey(a: [number, number, number], b: [number, number, number]): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

/** 降順比較。双方Infinity（無敗同士等）はtieとして扱い、NaNを生じさせない */
function compareDesc(a: number, b: number): number {
  if (a === b) return 0;
  if (a === Infinity) return -1;
  if (b === Infinity) return 1;
  return b - a;
}

/**
 * 同成績でタイしたグループに対し、直接対決（2者）またはミニリーグ（3者以上）で再集計を試み、
 * それでも決着しない場合はじゃんけん待ちとする。
 */
function resolveTieGroup(
  group: Array<Omit<StandingRow, 'rank' | 'isTie' | 'jankenPending'>>,
  accByEntrant: Map<string, Accumulated>,
  settings: CategorySettings,
): Array<{ row: Omit<StandingRow, 'rank' | 'isTie' | 'jankenPending'>; jankenPending: boolean }> {
  if (group.length < 2) return group.map((row) => ({ row, jankenPending: false }));

  const groupIds = new Set(group.map((r) => r.entrantId));

  // タイした者同士の対戦結果のみを抽出したミニリーグとして再集計する
  const miniTable = new Map<
    string,
    {
      wins: number;
      draws: number;
      losses: number;
      setRate: number;
      pointRate: number;
      points: number;
    }
  >();
  for (const row of group) {
    const acc = accByEntrant.get(row.entrantId);
    let wins = 0;
    let draws = 0;
    let losses = 0;
    let setsWon = 0;
    let setsLost = 0;
    let pointsFor = 0;
    let pointsAgainst = 0;
    if (acc) {
      for (const [opponentId, outcome] of acc.outcomesByOpponent) {
        if (!groupIds.has(opponentId)) continue;
        if (outcome.result === 'win') wins += 1;
        else if (outcome.result === 'draw') draws += 1;
        else losses += 1;
        setsWon += outcome.setsWon;
        setsLost += outcome.setsLost;
        pointsFor += outcome.pointsFor;
        pointsAgainst += outcome.pointsAgainst;
      }
    }
    const points =
      settings.rankingMethod === '勝点方式'
        ? wins * (settings.winPoints ?? 0) +
          draws * (settings.drawPoints ?? 0) +
          losses * (settings.losePoints ?? 0)
        : wins;
    miniTable.set(row.entrantId, {
      wins,
      draws,
      losses,
      setRate: computeRate(setsWon, setsLost),
      pointRate: computeRate(pointsFor, pointsAgainst),
      points,
    });
  }

  const miniKey = (entrantId: string): [number, number, number] => {
    const mini = miniTable.get(entrantId);
    return mini ? [mini.points, mini.setRate, mini.pointRate] : [0, 0, 0];
  };

  const sorted = [...group].sort((a, b) => {
    const ka = miniKey(a.entrantId);
    const kb = miniKey(b.entrantId);
    return compareDesc(ka[0], kb[0]) || compareDesc(ka[1], kb[1]) || compareDesc(ka[2], kb[2]);
  });

  const result: Array<{
    row: Omit<StandingRow, 'rank' | 'isTie' | 'jankenPending'>;
    jankenPending: boolean;
  }> = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i + 1;
    while (j < sorted.length && sameKey(miniKey(sorted[i].entrantId), miniKey(sorted[j].entrantId)))
      j += 1;
    const stillTied = j - i >= 2;
    for (let k = i; k < j; k += 1) {
      result.push({ row: sorted[k], jankenPending: stillTied });
    }
    i = j;
  }
  return result;
}

export function computeStandings(
  entrantIds: string[],
  matches: Match[],
  settings: CategorySettings,
): StandingRow[] {
  const accTable = accumulate(entrantIds, matches);
  const rows = entrantIds.map((id) => toStandingRow(accTable.get(id)!, settings));

  const sorted = [...rows].sort((a, b) => {
    const ka = sortKey(a, settings);
    const kb = sortKey(b, settings);
    return compareDesc(ka[0], kb[0]) || compareDesc(ka[1], kb[1]) || compareDesc(ka[2], kb[2]);
  });

  const result: StandingRow[] = [];
  let rank = 1;
  let i = 0;
  while (i < sorted.length) {
    let j = i + 1;
    while (j < sorted.length && sameKey(sortKey(sorted[i], settings), sortKey(sorted[j], settings)))
      j += 1;
    const group = sorted.slice(i, j);
    const resolved = resolveTieGroup(group, accTable, settings);
    const isTie = group.length >= 2;
    for (const { row, jankenPending } of resolved) {
      result.push({
        ...row,
        rank,
        isTie,
        jankenPending: isTie && jankenPending ? true : undefined,
      });
    }
    rank += group.length;
    i = j;
  }

  return result;
}
