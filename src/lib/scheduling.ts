// リーグ表・試合順・審判順自動生成ロジック（要件定義書3.4〜3.6）
// 「可能な限り均等にするベストエフォートでよく、厳密な数値基準は設けない」仕様のため、
// 完全最適化ではなく実用的なヒューリスティックで実装する

import type { CourtSelection } from '@/types/domain';

/** Fisher-Yatesで配列をシャッフルする（破壊せず新しい配列を返す） */
export function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export interface SchedulingEntrant {
  id: string;
  courtSelection?: CourtSelection;
  courtNumber?: number;
}

/** 競技情報のコート数に応じて、各選手(チーム)の割当コートを決定する（要件定義書3.4） */
export function assignCourts(
  entrants: SchedulingEntrant[],
  courtCount: number,
): Map<string, number> {
  const assignment = new Map<string, number>();

  if (courtCount < 2) {
    for (const entrant of entrants) assignment.set(entrant.id, 1);
    return assignment;
  }

  const manual = entrants.filter((e) => e.courtSelection === '手動' && e.courtNumber);
  const auto = shuffle(entrants.filter((e) => !(e.courtSelection === '手動' && e.courtNumber)));

  for (const entrant of manual) assignment.set(entrant.id, entrant.courtNumber!);

  const manualCountByCourt = new Map<number, number>();
  for (const entrant of manual) {
    manualCountByCourt.set(
      entrant.courtNumber!,
      (manualCountByCourt.get(entrant.courtNumber!) ?? 0) + 1,
    );
  }

  // 残り枠（1コートの振り分け選手数 = 同一カテゴリの選手数 ÷ コート数、割り切れない場合は前から順に加える）
  const base = Math.floor(entrants.length / courtCount);
  const remainder = entrants.length % courtCount;
  const targetByCourt = new Map<number, number>();
  for (let court = 1; court <= courtCount; court += 1) {
    targetByCourt.set(court, base + (court <= remainder ? 1 : 0));
  }

  let autoIndex = 0;
  for (let court = 1; court <= courtCount; court += 1) {
    const already = manualCountByCourt.get(court) ?? 0;
    const remaining = Math.max(0, (targetByCourt.get(court) ?? 0) - already);
    for (let i = 0; i < remaining && autoIndex < auto.length; i += 1, autoIndex += 1) {
      assignment.set(auto[autoIndex].id, court);
    }
  }
  // 端数等で割り当てきれなかった残りは先頭のコートから順に詰める
  while (autoIndex < auto.length) {
    assignment.set(auto[autoIndex].id, (autoIndex % courtCount) + 1);
    autoIndex += 1;
  }

  return assignment;
}

/**
 * 円卓法（circle method）で総当たりの組合せをラウンド単位で生成する。
 * 各ラウンド内の対戦は全員が重複しない組合せになる（同時に複数コートへ割り振っても衝突しない）。
 * 奇数の場合はBYE（不在）を挿入し、BYEを含む組合せはラウンドから除外する。
 * 対戦カードは常にリーグ表の上位（entrantIdsの先頭側）を左に記載し、
 * 最初のラウンドの最初の試合はリーグ表の上位2者（entrantIds[0]とentrantIds[1]）の対戦から開始する。
 */
export function buildRoundRobinRounds(entrantIds: string[]): Array<Array<[string, string]>> {
  const indexOf = new Map(entrantIds.map((id, i) => [id, i]));
  const ids = [...entrantIds];
  const hasBye = ids.length % 2 !== 0;
  if (hasBye) ids.push('__BYE__');

  const n = ids.length;
  const rounds: Array<Array<[string, string]>> = [];
  const fixed = ids[0];
  let rotating = ids.slice(1);

  for (let round = 0; round < n - 1; round += 1) {
    const roundIds = [fixed, ...rotating];
    const pairs: Array<[string, string]> = [];
    for (let i = 0; i < n / 2; i += 1) {
      const a = roundIds[i];
      const b = roundIds[n - 1 - i];
      if (a !== '__BYE__' && b !== '__BYE__') {
        pairs.push(indexOf.get(a)! <= indexOf.get(b)! ? [a, b] : [b, a]);
      }
    }
    rounds.push(pairs);
    rotating = [rotating[rotating.length - 1], ...rotating.slice(0, -1)];
  }

  if (entrantIds.length >= 2) {
    const [firstId, secondId] = entrantIds;
    const isTopPair = ([a, b]: [string, string]) =>
      (a === firstId && b === secondId) || (a === secondId && b === firstId);

    const roundIndex = rounds.findIndex((pairs) => pairs.some(isTopPair));
    if (roundIndex > 0) {
      const [target] = rounds.splice(roundIndex, 1);
      rounds.unshift(target);
    }

    const firstRound = rounds[0];
    const pairIndex = firstRound.findIndex(isTopPair);
    if (pairIndex > 0) {
      const [pair] = firstRound.splice(pairIndex, 1);
      firstRound.unshift(pair);
    }
  }

  return rounds;
}

/**
 * 円卓法（circle method）で総当たりの組合せを「同一チームが連続しにくい」順序に並べる（独立リーグ用）。
 */
export function generateRoundRobinOrder(entrantIds: string[]): Array<[string, string]> {
  return buildRoundRobinRounds(entrantIds).flat();
}

export interface SingleLeagueMatch {
  entrantAId: string;
  entrantBId: string;
  /** 試合順。同一ラウンド内で複数コートに割り振られた試合は同じ番号を共有する（同時進行） */
  slot: number;
  /** 1始まりの物理コート番号 */
  court: number;
}

/**
 * 複数コートにまたがる単一リーグの試合予定を生成する（要件定義書5章「1リーグ・複数コート」対応）。
 * 円卓法の総当たり順（generateRoundRobinOrder）を先頭から走査し、各対戦を「その時点で空きがあり、
 * かつ両選手(チーム)がまだ入っていない最も早い時間帯（slot）」へ貪欲に詰める（コートを極力空けない
 * 効率的な進行を優先する）。参加チーム数とコート数の組合せによっては、同一選手(チーム)が連続する
 * 時間帯で試合することになりうるが、対戦を効率的に進めるためその条件は緩和する。
 * 同一時間帯に同じ選手(チーム)が重複して入ることだけは、詰める際の判定により常に回避する。
 */
export function scheduleSingleLeagueMatches(
  entrantIds: string[],
  courtCount: number,
): SingleLeagueMatch[] {
  const order = generateRoundRobinOrder(entrantIds);
  const slots: Array<Array<[string, string]>> = [];

  for (const pair of order) {
    const [entrantAId, entrantBId] = pair;
    const openSlot = slots.find(
      (slot) =>
        slot.length < courtCount &&
        !slot.some(([a, b]) => a === entrantAId || b === entrantAId || a === entrantBId || b === entrantBId),
    );
    if (openSlot) {
      openSlot.push(pair);
    } else {
      slots.push([pair]);
    }
  }

  const schedule: SingleLeagueMatch[] = [];
  slots.forEach((slotMatches, slotIndex) => {
    slotMatches.forEach(([entrantAId, entrantBId], courtIndex) => {
      schedule.push({ entrantAId, entrantBId, slot: slotIndex + 1, court: courtIndex + 1 });
    });
  });

  return schedule;
}

/**
 * 各試合の審判を割り当てる（独立リーグ用）。審判はその試合に出場していない同一カテゴリ(コート)の
 * 選手(チーム)が兼務し、担当回数が少ない選手(チーム)を優先、直前の試合と同一審判は避ける（要件定義書3.6）。
 * 対戦者以外に候補がいない場合（参加者2名のみ等）はnullを返す（画面側で「運営スタッフ」の赤字表示に変換する）。
 */
export function assignReferees(
  matches: Array<[string, string]>,
  entrantIds: string[],
): Array<string | null> {
  const refereeCount = new Map(entrantIds.map((id) => [id, 0]));
  const referees: Array<string | null> = [];
  let previousReferee: string | null = null;

  for (const [a, b] of matches) {
    const candidates = entrantIds.filter((id) => id !== a && id !== b);
    const pool =
      candidates.length > 1 ? candidates.filter((id) => id !== previousReferee) : candidates;
    const eligible = pool.length > 0 ? pool : candidates;

    if (eligible.length === 0) {
      referees.push(null);
      previousReferee = null;
      continue;
    }

    const chosen = eligible.reduce((best, id) =>
      (refereeCount.get(id) ?? 0) < (refereeCount.get(best) ?? 0) ? id : best,
    );

    referees.push(chosen);
    refereeCount.set(chosen, (refereeCount.get(chosen) ?? 0) + 1);
    previousReferee = chosen;
  }

  return referees;
}

/**
 * 複数コートにまたがる単一リーグの各試合に審判を割り当てる。
 * 同一時間帯（slot）に他コートで試合している選手(チーム)は、対戦者でなくても審判候補から除外する
 * （「試合＞審判」の優先順位：対戦カードを先に確定し、その時間帯に空いている選手(チーム)から審判を選ぶ）。
 * 同一時間帯内で既に他コートの審判に割り当てた選手(チーム)も、同時に2つの審判を兼任できないため除外する
 * （空き人数が同時進行コート数より少ない場合、一部のコートは審判候補なしとなり得る）。
 * 候補がいない場合はnullを返す（画面側で「運営スタッフ」の赤字表示に変換する）。
 */
export function assignRefereesForSingleLeague(
  schedule: SingleLeagueMatch[],
  entrantIds: string[],
): Array<string | null> {
  const refereeCount = new Map(entrantIds.map((id) => [id, 0]));
  const referees: Array<string | null> = new Array(schedule.length).fill(null);
  let previousReferee: string | null = null;

  const indicesBySlot = new Map<number, number[]>();
  schedule.forEach((match, index) => {
    indicesBySlot.set(match.slot, [...(indicesBySlot.get(match.slot) ?? []), index]);
  });

  const orderedSlots = [...indicesBySlot.keys()].sort((a, b) => a - b);
  for (const slot of orderedSlots) {
    const indices = indicesBySlot.get(slot)!;
    const busy = new Set<string>();
    for (const index of indices) {
      busy.add(schedule[index].entrantAId);
      busy.add(schedule[index].entrantBId);
    }
    const refereedThisSlot = new Set<string>();

    for (const index of indices) {
      const candidates = entrantIds.filter((id) => !busy.has(id) && !refereedThisSlot.has(id));
      const pool =
        candidates.length > 1 ? candidates.filter((id) => id !== previousReferee) : candidates;
      const eligible = pool.length > 0 ? pool : candidates;

      if (eligible.length === 0) {
        referees[index] = null;
        previousReferee = null;
        continue;
      }

      const chosen = eligible.reduce((best, id) =>
        (refereeCount.get(id) ?? 0) < (refereeCount.get(best) ?? 0) ? id : best,
      );

      referees[index] = chosen;
      refereeCount.set(chosen, (refereeCount.get(chosen) ?? 0) + 1);
      refereedThisSlot.add(chosen);
      previousReferee = chosen;
    }
  }

  return referees;
}
