// データアクセス・制御ロジック層
// 実体は src/lib/store.ts のJSONファイルストア（本番の正式なデータ永続化方式。CLAUDE.md参照）。

import type {
  Category,
  CategoryKey,
  CourtSelection,
  Entrant,
  LeagueFormat,
  Match,
  RankingMethod,
  StandingRow,
  Tournament,
  TournamentStatus,
} from '@/types/domain';
import { loadStore, saveStore, type Store } from '@/lib/store';
import {
  assignCourts,
  assignReferees,
  assignRefereesForSingleLeague,
  generateRoundRobinOrder,
  scheduleSingleLeagueMatches,
  shuffle,
} from '@/lib/scheduling';
import { computeStandings } from '@/lib/ranking';
import { validateEntrantAgainst } from '@/lib/entrant-validation';

const CATEGORY_KEYS: CategoryKey[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

export function getTournaments(): Tournament[] {
  return loadStore().tournaments;
}

export function getTournament(tournamentId: string): Tournament | undefined {
  return loadStore().tournaments.find((t) => t.id === tournamentId);
}

/** 大会情報画面（A3）のカテゴリA〜J欄を描画するため、有効/無効を問わず全キー分を返す */
export function getAllCategorySlots(
  tournamentId: string,
): Array<Category | { key: CategoryKey; enabled: false }> {
  const existing = loadStore().categories.filter((c) => c.tournamentId === tournamentId);
  return CATEGORY_KEYS.map(
    (key) => existing.find((c) => c.key === key) ?? { key, enabled: false as const },
  );
}

/** 選手(チーム)情報または試合結果が登録済みで、チェックを外せない（＝実質削除できない）カテゴリか（要件定義書3.2） */
export function isCategoryLocked(categoryId: string): boolean {
  const store = loadStore();
  const hasEntrants = store.entrants.some((e) => e.categoryId === categoryId);
  const hasResults = store.matches.some(
    (m) => m.categoryId === categoryId && m.status === '入力済み',
  );
  return hasEntrants || hasResults;
}

export function getEnabledCategories(tournamentId: string): Category[] {
  return loadStore().categories.filter((c) => c.tournamentId === tournamentId && c.enabled);
}

export function getCategory(categoryId: string): Category | undefined {
  return loadStore().categories.find((c) => c.id === categoryId);
}

export function getEntrants(tournamentId: string, categoryId?: string): Entrant[] {
  return loadStore().entrants.filter(
    (e) => e.tournamentId === tournamentId && (categoryId ? e.categoryId === categoryId : true),
  );
}

export function getEntrant(entrantId: string): Entrant | undefined {
  return loadStore().entrants.find((e) => e.id === entrantId);
}

/**
 * リーグ表・試合順表（および出力物）の並び順として、リーグ表自動生成時にランダムに決定した
 * displayOrderで並べ替える（要件定義書3.4）。生成前（displayOrder未設定）は元の順序のまま返す
 */
export function sortByDisplayOrder(entrants: Entrant[]): Entrant[] {
  return [...entrants].sort((a, b) => (a.displayOrder ?? Infinity) - (b.displayOrder ?? Infinity));
}

export function getEntrantName(entrantId: string | null): string {
  if (!entrantId) return '―';
  return getEntrant(entrantId)?.name ?? '―';
}

export function getMatches(categoryId: string, courtNumber: number): Match[] {
  return loadStore()
    .matches.filter((m) => m.categoryId === categoryId && m.courtNumber === courtNumber)
    .sort((a, b) => a.order - b.order);
}

export function getMatch(categoryId: string, matchId: string): Match | undefined {
  return loadStore().matches.find((m) => m.categoryId === categoryId && m.id === matchId);
}

/**
 * カテゴリ内の全コート分の試合を、試合順（単一リーグの場合は同時進行の試合も含む）でまとめて取得する。
 * 独立リーグ・単一リーグのいずれでも、物理コート番号はMatch.courtNumberに実値が入っているため利用できる。
 */
export function getCategoryMatches(categoryId: string, courtCount: number): Match[] {
  return Array.from({ length: courtCount }, (_, i) => i + 1)
    .flatMap((courtNumber) => getMatches(categoryId, courtNumber))
    .sort((a, b) => a.order - b.order || a.courtNumber - b.courtNumber);
}

export function getStandings(categoryId: string, courtNumber: number): StandingRow[] {
  return loadStore().standings[`${categoryId}:${courtNumber}`] ?? [];
}

export function getBackups() {
  return loadStore().backups;
}

export type ResultInputStatus = '未着手' | '入力中' | '全試合終了' | '-';

export function getResultInputStatus(category: Category): ResultInputStatus {
  if (category.generationStatus === '未生成') return '-';

  const matches = getCategoryMatches(category.id, category.settings.courtCount);
  if (matches.length === 0) return '未着手';

  const inputCount = matches.filter((m) => m.status === '入力済み').length;
  if (inputCount === 0) return '未着手';
  if (inputCount === matches.length) return '全試合終了';
  return '入力中';
}

// ──────────────────────────────────────────────────────────
// 制御ロジック（画面のボタン操作から呼び出される、実際のデータ変更処理）
// ──────────────────────────────────────────────────────────

/**
 * 大会名・開催場所・カテゴリ名の文字数上限（要件定義書3.1「MAX：全角n文字」）および
 * 同一大会内でのカテゴリ名重複禁止を検証する（純粋関数のため単体テストで直接検証できる。U-VAL-01〜03対応）
 */
export function validateTournamentInput(input: {
  name: string;
  location: string;
  categories: Array<{ name: string }>;
}): string | undefined {
  if (!input.name || input.name.length > 50) {
    return '大会名は1〜50文字で入力してください';
  }
  if (!input.location || input.location.length > 50) {
    return '開催場所は1〜50文字で入力してください';
  }
  for (const category of input.categories) {
    if (!category.name || category.name.length > 25) {
      return 'カテゴリ名は1〜25文字で入力してください';
    }
  }
  const names = input.categories.map((c) => c.name);
  if (new Set(names).size !== names.length) {
    return '同一大会内でカテゴリ名を重複させることはできません';
  }
  return undefined;
}

export interface CreateTournamentInput {
  name: string;
  date: string;
  location: string;
  /** カテゴリA〜Jのうち、有効化するものだけを含める（Aは必須） */
  categories: Array<{ key: CategoryKey; name: string }>;
}

export type CreateTournamentResult =
  | { ok: true; tournament: Tournament }
  | { ok: false; message: string };

/** 大会情報画面（A3）の新規作成フォーム保存時に呼び出す（要件定義書3.1） */
export function createTournament(input: CreateTournamentInput): CreateTournamentResult {
  const message = validateTournamentInput(input);
  if (message) return { ok: false, message };

  const store = loadStore();
  const tournamentId = `tournament-${crypto.randomUUID()}`;

  const tournament: Tournament = {
    id: tournamentId,
    name: input.name,
    date: input.date,
    location: input.location,
    status: '進行中',
  };
  store.tournaments.push(tournament);

  for (const category of input.categories) {
    store.categories.push({
      id: `${tournamentId}-${category.key}`,
      tournamentId,
      key: category.key,
      name: category.name,
      enabled: true,
      generationStatus: '未生成',
      settings: {
        setCount: 1,
        rankingMethod: '勝敗方式',
        courtCount: 1,
        maxEntrantsPerCourt: 5,
        leagueFormat: '独立リーグ',
      },
    });
  }

  saveStore(store);
  return { ok: true, tournament };
}

export interface UpdateTournamentInput {
  name: string;
  date: string;
  location: string;
  /** カテゴリA〜J全スロット分の有効/名称。無効化はロック中（settings変更済み/選手登録済み/試合結果あり）の場合サーバー側でも無視する */
  categories: Array<{ key: CategoryKey; name: string; enabled: boolean }>;
}

export type UpdateTournamentResult =
  | { ok: true; tournament: Tournament }
  | { ok: false; code: 'NOT_FOUND' | 'TOURNAMENT_FINISHED' | 'VALIDATION_ERROR'; message?: string };

/** 大会情報画面（A3）の編集フォーム保存時に呼び出す（要件定義書3.1） */
export function updateTournament(
  tournamentId: string,
  input: UpdateTournamentInput,
): UpdateTournamentResult {
  const store = loadStore();
  const tournament = store.tournaments.find((t) => t.id === tournamentId);
  if (!tournament) return { ok: false, code: 'NOT_FOUND' };
  if (tournament.status === '終了') return { ok: false, code: 'TOURNAMENT_FINISHED' };

  const message = validateTournamentInput({
    name: input.name,
    location: input.location,
    categories: input.categories.filter((c) => c.enabled),
  });
  if (message) return { ok: false, code: 'VALIDATION_ERROR', message };

  tournament.name = input.name;
  tournament.date = input.date;
  tournament.location = input.location;

  for (const input_ of input.categories) {
    const existing = store.categories.find(
      (c) => c.tournamentId === tournamentId && c.key === input_.key,
    );
    const hasEntrants = store.entrants.some((e) => e.categoryId === existing?.id);
    const hasResults = store.matches.some(
      (m) => m.categoryId === existing?.id && m.status === '入力済み',
    );
    const locked = hasEntrants || hasResults;

    if (existing && !input_.enabled && !locked) {
      // A4の削除ボタンは廃止し、A3のカテゴリチェックボックス（無効化）のみでカテゴリのライフサイクルを管理する
      // （チェックを外して保存＝実削除。再度チェックすれば未使用スロットとして新規作成される）
      store.categories = store.categories.filter((c) => c.id !== existing.id);
      store.matches = store.matches.filter((m) => m.categoryId !== existing.id);
      for (const key of Object.keys(store.standings)) {
        if (key.startsWith(`${existing.id}:`)) delete store.standings[key];
      }
      continue;
    }

    if (existing) {
      existing.name = input_.name;
    } else if (input_.enabled) {
      store.categories.push({
        id: `${tournamentId}-${input_.key}`,
        tournamentId,
        key: input_.key,
        name: input_.name,
        enabled: true,
        generationStatus: '未生成',
        settings: {
          setCount: 1,
          rankingMethod: '勝敗方式',
          courtCount: 1,
          maxEntrantsPerCourt: 5,
          leagueFormat: '独立リーグ',
        },
      });
    }
  }

  saveStore(store);
  return { ok: true, tournament };
}

/** 大会を削除し、紐づく競技情報・選手(チーム)情報・試合・試合結果をカスケード削除する（要件定義書2.1） */
export function deleteTournament(tournamentId: string): void {
  const store = loadStore();
  const categoryIds = new Set(
    store.categories.filter((c) => c.tournamentId === tournamentId).map((c) => c.id),
  );

  store.tournaments = store.tournaments.filter((t) => t.id !== tournamentId);
  store.categories = store.categories.filter((c) => c.tournamentId !== tournamentId);
  store.entrants = store.entrants.filter((e) => e.tournamentId !== tournamentId);
  store.matches = store.matches.filter((m) => !categoryIds.has(m.categoryId));
  for (const key of Object.keys(store.standings)) {
    const categoryId = key.split(':')[0];
    if (categoryIds.has(categoryId)) delete store.standings[key];
  }

  saveStore(store);
}

export function setTournamentStatus(
  tournamentId: string,
  status: TournamentStatus,
): Tournament | undefined {
  const store = loadStore();
  const tournament = store.tournaments.find((t) => t.id === tournamentId);
  if (!tournament) return undefined;
  tournament.status = status;
  saveStore(store);
  return tournament;
}

export interface UpdateCategorySettingsInput {
  setCount: number;
  rankingMethod: RankingMethod;
  winPoints?: number;
  drawPoints?: number;
  losePoints?: number;
  courtCount: number;
  maxEntrantsPerCourt: number;
  leagueFormat: LeagueFormat;
}

export type UpdateCategorySettingsResult =
  | { ok: true; category: Category }
  | { ok: false; code: 'NOT_FOUND' | 'TOURNAMENT_FINISHED' | 'HAS_RESULTS' | 'VALIDATION_ERROR' };

/** 競技情報登録の入力バリデーション（要件定義書3.2）。純粋関数のため単体テストで直接検証できる */
export function validateCategorySettingsInput(input: UpdateCategorySettingsInput): boolean {
  if (input.setCount < 1 || input.setCount > 5) return false;
  if (input.courtCount < 1 || input.courtCount > 5) return false;
  if (input.maxEntrantsPerCourt < 2 || input.maxEntrantsPerCourt > 10) return false;
  if (input.leagueFormat !== '独立リーグ' && input.leagueFormat !== '単一リーグ') return false;
  if (input.rankingMethod === '勝点方式') {
    const { winPoints, drawPoints, losePoints } = input;
    if (winPoints === undefined || drawPoints === undefined || losePoints === undefined) {
      return false;
    }
    if ([winPoints, drawPoints, losePoints].some((p) => p < 0 || p > 5)) return false;
    if (!(winPoints > drawPoints && drawPoints > losePoints)) return false;
  }
  return true;
}

/** 競技情報（A4）の保存時に呼び出す（要件定義書3.2）。試合結果登録済み・大会終了時は変更をブロックする */
export function updateCategorySettings(
  categoryId: string,
  input: UpdateCategorySettingsInput,
): UpdateCategorySettingsResult {
  const store = loadStore();
  const category = store.categories.find((c) => c.id === categoryId);
  if (!category) return { ok: false, code: 'NOT_FOUND' };

  const tournament = store.tournaments.find((t) => t.id === category.tournamentId);
  if (!tournament || tournament.status === '終了') {
    return { ok: false, code: 'TOURNAMENT_FINISHED' };
  }

  const hasResults = store.matches.some(
    (m) => m.categoryId === categoryId && m.status === '入力済み',
  );
  if (hasResults) return { ok: false, code: 'HAS_RESULTS' };

  if (!validateCategorySettingsInput(input)) return { ok: false, code: 'VALIDATION_ERROR' };

  category.settings = {
    setCount: input.setCount,
    rankingMethod: input.rankingMethod,
    winPoints: input.rankingMethod === '勝点方式' ? input.winPoints : undefined,
    drawPoints: input.rankingMethod === '勝点方式' ? input.drawPoints : undefined,
    losePoints: input.rankingMethod === '勝点方式' ? input.losePoints : undefined,
    courtCount: input.courtCount,
    maxEntrantsPerCourt: input.maxEntrantsPerCourt,
    leagueFormat: input.courtCount >= 2 ? input.leagueFormat : '独立リーグ',
  };

  saveStore(store);
  return { ok: true, category };
}

export interface GenerateSkipped {
  categoryKey: string;
  categoryName: string;
  reason: string;
}

export interface GenerateResult {
  generatedCategoryKeys: string[];
  skipped: GenerateSkipped[];
}

export interface GenerateTarget {
  categoryId: string;
}

type GenerateOutcome =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * カテゴリ単位でリーグ表・試合順・審判順を生成する（要件定義書3.4〜3.6）。
 * カテゴリ内の全コートへの選手(チーム)自動振り分けは一体の処理のため、コート単位では生成・再生成しない。
 */
function generateCategory(store: Store, category: Category): GenerateOutcome {
  // リーグ表の並び順は登録順ではなくランダムに決定する（要件定義書3.4）。以降の処理は全てこの順序を使う
  const entrants = shuffle(store.entrants.filter((e) => e.categoryId === category.id));
  if (entrants.length < 2) {
    return {
      ok: false,
      reason: `参加選手(チーム)数が${entrants.length}名のため作成できません（2名以上必要です）`,
    };
  }

  const hasExistingResult = store.matches.some(
    (m) => m.categoryId === category.id && m.status === '入力済み',
  );
  if (hasExistingResult) {
    return {
      ok: false,
      reason: '試合結果が入力されています。\n試合結果を削除して下さい。',
    };
  }

  const isSingleLeague = category.settings.leagueFormat === '単一リーグ';

  // 単一リーグ分岐で使う値。独立リーグの場合はコート別の事前バリデーションのみに使う
  let courtOf: Map<string, number> | undefined;
  let entrantsByCourt: Map<number, string[]> | undefined;
  let targetCourts: number[] = [];

  if (!isSingleLeague) {
    const capacity = category.settings.courtCount * category.settings.maxEntrantsPerCourt;
    if (entrants.length > capacity) {
      return {
        ok: false,
        reason:
          '想定を超える選手(チーム)が登録されています。\n競技情報のコート数、または、１コート最大選手(チーム)数を変更して下さい。',
      };
    }

    courtOf = assignCourts(
      entrants.map((e) => ({
        id: e.id,
        courtSelection: e.courtSelection,
        courtNumber: e.courtNumber,
      })),
      category.settings.courtCount,
    );

    entrantsByCourt = new Map<number, string[]>();
    for (const entrant of entrants) {
      const court = courtOf.get(entrant.id) ?? 1;
      entrantsByCourt.set(court, [...(entrantsByCourt.get(court) ?? []), entrant.id]);
    }

    targetCourts = Array.from({ length: category.settings.courtCount }, (_, i) => i + 1);
    for (const court of targetCourts) {
      const count = entrantsByCourt.get(court)?.length ?? 0;
      if (count < 2) {
        return {
          ok: false,
          reason:
            category.settings.courtCount >= 2
              ? `コート${court}の割当人数が${count}名のため作成できません（各コート2名以上必要です）`
              : `参加選手(チーム)数が${count}名のため作成できません（2名以上必要です）`,
        };
      }
    }
  }

  // ここまでの事前チェックをすべて通過した場合のみ、既存の試合・勝敗表を削除して再生成する
  // （独立リーグ⇔単一リーグの切替後の再生成で前回モードの残存キーが残らないよう、勝敗表は一旦すべて削除する）
  for (const key of Object.keys(store.standings)) {
    if (key.startsWith(`${category.id}:`)) delete store.standings[key];
  }
  store.matches = store.matches.filter((m) => m.categoryId !== category.id);

  if (isSingleLeague) {
    const entrantIds = entrants.map((e) => e.id);
    const schedule = scheduleSingleLeagueMatches(entrantIds, category.settings.courtCount);
    const referees = assignRefereesForSingleLeague(schedule, entrantIds);
    const matches: Match[] = schedule.map(({ entrantAId, entrantBId, slot, court }, index) => ({
      id: `${category.id}-m${index + 1}`,
      categoryId: category.id,
      courtNumber: court,
      order: slot,
      entrantAId,
      entrantBId,
      refereeEntrantId: referees[index],
      sets: Array.from({ length: category.settings.setCount }, () => ({
        scoreA: null,
        scoreB: null,
      })),
      status: '未入力' as const,
    }));
    store.matches.push(...matches);
    store.standings[`${category.id}:0`] = computeStandings(entrantIds, matches, category.settings);

    entrantIds.forEach((id, index) => {
      const entrant = store.entrants.find((e) => e.id === id);
      if (entrant) entrant.displayOrder = index + 1;
    });
    for (const entrant of entrants) entrant.hasResult = false;

    category.generationStatus = '生成済み';
    return { ok: true };
  }

  // 「自動」選択の選手(チーム)は、この時点で決まったコート番号をentrant.courtNumberへ反映する
  // （未反映のままだとリーグ表・試合順・データ出力のコート別絞り込みで表示されなくなるため）
  for (const entrant of entrants) {
    entrant.courtNumber = courtOf!.get(entrant.id) ?? 1;
  }

  for (const court of targetCourts) {
    const entrantIds = entrantsByCourt!.get(court) ?? [];
    const order = generateRoundRobinOrder(entrantIds);
    const referees = assignReferees(order, entrantIds);
    const courtMatches: Match[] = order.map(([entrantAId, entrantBId], index) => ({
      id: `${category.id}-c${court}-m${index + 1}`,
      categoryId: category.id,
      courtNumber: court,
      order: index + 1,
      entrantAId,
      entrantBId,
      refereeEntrantId: referees[index],
      sets: Array.from({ length: category.settings.setCount }, () => ({
        scoreA: null,
        scoreB: null,
      })),
      status: '未入力' as const,
    }));
    store.matches.push(...courtMatches);
    store.standings[`${category.id}:${court}`] = computeStandings(
      entrantIds,
      courtMatches,
      category.settings,
    );

    entrantIds.forEach((entrantId, index) => {
      const entrant = store.entrants.find((e) => e.id === entrantId);
      if (entrant) {
        entrant.hasResult = false;
        entrant.displayOrder = index + 1;
      }
    });
  }

  category.generationStatus = targetCourts.every((court) =>
    store.matches.some((m) => m.categoryId === category.id && m.courtNumber === court),
  )
    ? '生成済み'
    : '未生成';

  return { ok: true };
}

/**
 * 大会内の有効カテゴリすべてについて、リーグ表・試合順・審判順を一括生成する（要件定義書3.4〜3.6）。
 * 条件を満たさないカテゴリはスキップし、どのカテゴリが生成できたかを返す。
 */
export function generateForTournament(tournamentId: string): GenerateResult {
  const store = loadStore();
  const categories = store.categories.filter((c) => c.tournamentId === tournamentId && c.enabled);
  const targets: GenerateTarget[] = categories.map((c) => ({ categoryId: c.id }));
  return applyGenerateTargets(store, categories, targets);
}

/** 選択されたカテゴリのみを対象にリーグ表等を生成する（A3「リーグ表を作成する」の選択ダイアログ用） */
export function generateSelected(tournamentId: string, targets: GenerateTarget[]): GenerateResult {
  const store = loadStore();
  const categories = store.categories.filter((c) => c.tournamentId === tournamentId && c.enabled);
  return applyGenerateTargets(store, categories, targets);
}

function applyGenerateTargets(
  store: Store,
  categories: Category[],
  targets: GenerateTarget[],
): GenerateResult {
  const generatedCategoryKeys: string[] = [];
  const skipped: GenerateSkipped[] = [];

  for (const target of targets) {
    const category = categories.find((c) => c.id === target.categoryId);
    if (!category) continue;

    const outcome = generateCategory(store, category);
    if (outcome.ok) generatedCategoryKeys.push(category.key);
    else skipped.push({ categoryKey: category.key, categoryName: category.name, reason: outcome.reason });
  }

  saveStore(store);
  return { generatedCategoryKeys, skipped };
}

/** 試合結果（セットスコア）を保存し、勝敗表（順位表）を自動再集計する（要件定義書3.7・3.8） */
export function saveMatchResult(
  categoryId: string,
  matchId: string,
  sets: Match['sets'],
): Match | undefined {
  const store = loadStore();
  const match = store.matches.find((m) => m.categoryId === categoryId && m.id === matchId);
  const category = store.categories.find((c) => c.id === categoryId);
  if (!match || !category) return undefined;

  match.sets = sets;
  match.status = sets.some((s) => s.scoreA !== null && s.scoreB !== null) ? '入力済み' : '未入力';

  // 単一リーグはコートをまたいで1つの勝敗表（categoryId:0）に統合するため、再集計もカテゴリ全体の試合を対象にする
  const isSingleLeague = category.settings.leagueFormat === '単一リーグ';
  const courtMatches = isSingleLeague
    ? store.matches.filter((m) => m.categoryId === categoryId)
    : store.matches.filter(
        (m) => m.categoryId === categoryId && m.courtNumber === match.courtNumber,
      );
  const entrantIds = Array.from(new Set(courtMatches.flatMap((m) => [m.entrantAId, m.entrantBId])));

  // 結果削除（セットを全てnullに戻す）でhasResultも正しく未登録状態へ戻るよう、保存の都度再集計する
  for (const entrantId of [match.entrantAId, match.entrantBId]) {
    const entrant = store.entrants.find((e) => e.id === entrantId);
    if (entrant) {
      entrant.hasResult = courtMatches.some(
        (m) =>
          (m.entrantAId === entrantId || m.entrantBId === entrantId) && m.status === '入力済み',
      );
    }
  }
  const standingsKey = isSingleLeague ? `${categoryId}:0` : `${categoryId}:${match.courtNumber}`;
  store.standings[standingsKey] = computeStandings(entrantIds, courtMatches, category.settings);

  saveStore(store);
  return match;
}

export type JankenConfirmResult = { ok: true } | { ok: false; message: string };

/**
 * じゃんけん待ちの組について、管理者が確定した最終順位を勝敗表（順位表）へ反映する（要件定義書3.8）。
 * 対象はcomputeStandingsが現時点でjankenPending=trueとしている組のみで、
 * 指定された順位はその組の元のrank〜rank+組人数-1の範囲内で重複なく埋める必要がある
 */
export function confirmJankenRanks(
  categoryId: string,
  court: number,
  ranks: Array<{ entrantId: string; rank: number }>,
): JankenConfirmResult {
  const store = loadStore();
  const key = `${categoryId}:${court}`;
  const standings = store.standings[key];
  if (!standings) return { ok: false, message: '勝敗表が見つかりません' };

  const targetIds = new Set(ranks.map((r) => r.entrantId));
  const targetRows = standings.filter((row) => targetIds.has(row.entrantId));
  if (targetRows.length !== ranks.length || !targetRows.every((row) => row.jankenPending)) {
    return { ok: false, message: 'じゃんけん待ちの組と対象が一致しません' };
  }

  const baseRank = Math.min(...targetRows.map((row) => row.rank));
  const expectedRanks = Array.from({ length: targetRows.length }, (_, i) => baseRank + i);
  const givenRanks = [...ranks.map((r) => r.rank)].sort((a, b) => a - b);
  const isValidPermutation = expectedRanks.every((r, i) => r === givenRanks[i]);
  if (!isValidPermutation) {
    return { ok: false, message: '順位はタイした人数分の範囲で重複なく指定してください' };
  }

  const rankByEntrantId = new Map(ranks.map((r) => [r.entrantId, r.rank]));
  for (const row of standings) {
    const rank = rankByEntrantId.get(row.entrantId);
    if (rank === undefined) continue;
    row.rank = rank;
    row.isTie = false;
    row.jankenPending = undefined;
  }

  saveStore(store);
  return { ok: true };
}

export interface EntrantInput {
  categoryId: string;
  name: string;
  affiliation?: string;
  courtSelection?: CourtSelection;
  courtNumber?: number;
}

export type EntrantMutationErrorCode =
  | 'NOT_FOUND'
  | 'TOURNAMENT_FINISHED'
  | 'HAS_RESULT'
  | 'VALIDATION_ERROR';

export type EntrantMutationResult =
  | { ok: true; entrant: Entrant }
  | { ok: false; code: EntrantMutationErrorCode; message: string };

/** 選手(チーム)情報登録の入力バリデーション（要件定義書3.3）。excludeEntrantIdは編集時に自分自身を重複判定から除外するために使う */
export function validateEntrantInput(
  store: Store,
  category: Category,
  input: EntrantInput,
  excludeEntrantId?: string,
): string | undefined {
  const others = store.entrants.filter(
    (e) => e.categoryId === category.id && e.id !== excludeEntrantId,
  );
  return validateEntrantAgainst(category, others, input);
}

/** 選手(チーム)の新規登録（要件定義書3.3） */
export function createEntrant(tournamentId: string, input: EntrantInput): EntrantMutationResult {
  const store = loadStore();
  const tournament = store.tournaments.find((t) => t.id === tournamentId);
  if (!tournament) return { ok: false, code: 'NOT_FOUND', message: '大会が見つかりません' };
  if (tournament.status === '終了') {
    return {
      ok: false,
      code: 'TOURNAMENT_FINISHED',
      message: '大会が終了しているため登録できません',
    };
  }

  const category = store.categories.find(
    (c) => c.id === input.categoryId && c.tournamentId === tournamentId,
  );
  if (!category) return { ok: false, code: 'NOT_FOUND', message: '競技情報が見つかりません' };

  const validationError = validateEntrantInput(store, category, input);
  if (validationError) {
    return { ok: false, code: 'VALIDATION_ERROR', message: validationError };
  }

  const entrant: Entrant = {
    id: `entrant-${crypto.randomUUID()}`,
    tournamentId,
    categoryId: input.categoryId,
    name: input.name,
    affiliation: input.affiliation,
    courtSelection: input.courtSelection,
    courtNumber: input.courtNumber,
    hasResult: false,
  };
  store.entrants.push(entrant);
  saveStore(store);
  return { ok: true, entrant };
}

/** 選手(チーム)の編集（要件定義書3.3）。試合結果登録済みの場合は変更をブロックする */
export function updateEntrant(entrantId: string, input: EntrantInput): EntrantMutationResult {
  const store = loadStore();
  const entrant = store.entrants.find((e) => e.id === entrantId);
  if (!entrant) return { ok: false, code: 'NOT_FOUND', message: '選手(チーム)が見つかりません' };

  const tournament = store.tournaments.find((t) => t.id === entrant.tournamentId);
  if (!tournament) return { ok: false, code: 'NOT_FOUND', message: '大会が見つかりません' };
  if (tournament.status === '終了') {
    return {
      ok: false,
      code: 'TOURNAMENT_FINISHED',
      message: '大会が終了しているため変更できません',
    };
  }
  if (entrant.hasResult) {
    return {
      ok: false,
      code: 'HAS_RESULT',
      message: '試合結果が登録されている選手(チーム)は変更できません',
    };
  }

  const category = store.categories.find(
    (c) => c.id === input.categoryId && c.tournamentId === entrant.tournamentId,
  );
  if (!category) return { ok: false, code: 'NOT_FOUND', message: '競技情報が見つかりません' };

  const validationError = validateEntrantInput(store, category, input, entrantId);
  if (validationError) {
    return { ok: false, code: 'VALIDATION_ERROR', message: validationError };
  }

  entrant.categoryId = input.categoryId;
  entrant.name = input.name;
  entrant.affiliation = input.affiliation;
  entrant.courtSelection = input.courtSelection;
  entrant.courtNumber = input.courtNumber;
  saveStore(store);
  return { ok: true, entrant };
}

/** 選手(チーム)の削除。試合結果登録済みの場合は削除をブロックする（要件定義書3.3） */
export function deleteEntrant(
  entrantId: string,
): { ok: true } | { ok: false; code: EntrantMutationErrorCode; message: string } {
  const store = loadStore();
  const entrant = store.entrants.find((e) => e.id === entrantId);
  if (!entrant) return { ok: false, code: 'NOT_FOUND', message: '選手(チーム)が見つかりません' };

  const tournament = store.tournaments.find((t) => t.id === entrant.tournamentId);
  if (!tournament) return { ok: false, code: 'NOT_FOUND', message: '大会が見つかりません' };
  if (tournament.status === '終了') {
    return {
      ok: false,
      code: 'TOURNAMENT_FINISHED',
      message: '大会が終了しているため削除できません',
    };
  }
  if (entrant.hasResult) {
    return {
      ok: false,
      code: 'HAS_RESULT',
      message: '試合結果が登録されている選手(チーム)は削除できません',
    };
  }

  store.entrants = store.entrants.filter((e) => e.id !== entrantId);
  saveStore(store);
  return { ok: true };
}
