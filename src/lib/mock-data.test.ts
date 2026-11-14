import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  sortByDisplayOrder,
  validateCategorySettingsInput,
  validateEntrantInput,
  validateTournamentInput,
  type UpdateCategorySettingsInput,
} from '@/lib/mock-data';
import type { Category, Entrant, StandingRow } from '@/types/domain';
import type { Store as StoreType } from '@/lib/store';

function baseSettings(
  overrides: Partial<UpdateCategorySettingsInput> = {},
): UpdateCategorySettingsInput {
  return {
    setCount: 3,
    rankingMethod: '勝敗方式',
    courtCount: 1,
    maxEntrantsPerCourt: 5,
    leagueFormat: '独立リーグ',
    ...overrides,
  };
}

describe('validateCategorySettingsInput（競技情報登録バリデーション・要件定義書3.2）', () => {
  it('U-VAL-05: セット数は範囲1〜5', () => {
    expect(validateCategorySettingsInput(baseSettings({ setCount: 0 }))).toBe(false);
    expect(validateCategorySettingsInput(baseSettings({ setCount: 6 }))).toBe(false);
    expect(validateCategorySettingsInput(baseSettings({ setCount: 1 }))).toBe(true);
    expect(validateCategorySettingsInput(baseSettings({ setCount: 5 }))).toBe(true);
  });

  it('U-VAL-06: コート数は範囲1〜5', () => {
    expect(validateCategorySettingsInput(baseSettings({ courtCount: 0 }))).toBe(false);
    expect(validateCategorySettingsInput(baseSettings({ courtCount: 6 }))).toBe(false);
  });

  it('U-VAL-07: 1コート最大選手(チーム)数は範囲2〜10', () => {
    expect(validateCategorySettingsInput(baseSettings({ maxEntrantsPerCourt: 0 }))).toBe(false);
    expect(validateCategorySettingsInput(baseSettings({ maxEntrantsPerCourt: 1 }))).toBe(false);
    expect(validateCategorySettingsInput(baseSettings({ maxEntrantsPerCourt: 11 }))).toBe(false);
    expect(validateCategorySettingsInput(baseSettings({ maxEntrantsPerCourt: 2 }))).toBe(true);
  });

  it('U-VAL-08: コート数が2以上の場合も1コート最大選手(チーム)数は2以上必須', () => {
    expect(
      validateCategorySettingsInput(baseSettings({ courtCount: 2, maxEntrantsPerCourt: 2 })),
    ).toBe(true);
  });

  it('U-WP-01: 勝利勝点 > 引分勝点 > 敗北勝点 でなければエラー', () => {
    expect(
      validateCategorySettingsInput(
        baseSettings({
          rankingMethod: '勝点方式',
          winPoints: 2,
          drawPoints: 3,
          losePoints: 0,
        }),
      ),
    ).toBe(false);
    expect(
      validateCategorySettingsInput(
        baseSettings({
          rankingMethod: '勝点方式',
          winPoints: 3,
          drawPoints: 1,
          losePoints: 0,
        }),
      ),
    ).toBe(true);
  });

  it('U-WP-02: 勝点方式の各値は範囲0〜5', () => {
    expect(
      validateCategorySettingsInput(
        baseSettings({ rankingMethod: '勝点方式', winPoints: 6, drawPoints: 1, losePoints: 0 }),
      ),
    ).toBe(false);
  });

  it('リーグ形式は独立リーグ／単一リーグのいずれかでなければエラー', () => {
    expect(validateCategorySettingsInput(baseSettings({ leagueFormat: '独立リーグ' }))).toBe(true);
    expect(
      validateCategorySettingsInput(baseSettings({ courtCount: 2, leagueFormat: '単一リーグ' })),
    ).toBe(true);
    expect(
      validateCategorySettingsInput(
        baseSettings({ leagueFormat: '不正な値' as unknown as '独立リーグ' }),
      ),
    ).toBe(false);
  });
});

describe('validateTournamentInput（大会情報登録バリデーション・要件定義書3.1）', () => {
  function baseInput(overrides: Partial<Parameters<typeof validateTournamentInput>[0]> = {}) {
    return {
      name: 'バレーボール大会',
      location: '体育館',
      categories: [{ name: 'フリー' }],
      ...overrides,
    };
  }

  it('U-VAL-01: 大会名は全角50文字まで', () => {
    expect(validateTournamentInput(baseInput({ name: 'あ'.repeat(51) }))).toBeTruthy();
    expect(validateTournamentInput(baseInput({ name: 'あ'.repeat(50) }))).toBeUndefined();
    expect(validateTournamentInput(baseInput({ name: '' }))).toBeTruthy();
  });

  it('U-VAL-02: 開催場所は全角50文字まで', () => {
    expect(validateTournamentInput(baseInput({ location: 'あ'.repeat(51) }))).toBeTruthy();
    expect(validateTournamentInput(baseInput({ location: 'あ'.repeat(50) }))).toBeUndefined();
  });

  it('U-VAL-17: カテゴリ名は全角25文字まで', () => {
    expect(
      validateTournamentInput(baseInput({ categories: [{ name: 'あ'.repeat(26) }] })),
    ).toBeTruthy();
    expect(
      validateTournamentInput(baseInput({ categories: [{ name: 'あ'.repeat(25) }] })),
    ).toBeUndefined();
  });

  it('U-VAL-03: カテゴリ名（A〜J）は同一大会内で重複不可', () => {
    expect(
      validateTournamentInput(
        baseInput({ categories: [{ name: 'フリー' }, { name: 'フリー' }] }),
      ),
    ).toBeTruthy();
    expect(
      validateTournamentInput(
        baseInput({ categories: [{ name: 'フリー' }, { name: '初級' }] }),
      ),
    ).toBeUndefined();
  });
});

function makeCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: 'cat-A',
    tournamentId: 't1',
    key: 'A',
    name: 'フリー',
    enabled: true,
    generationStatus: '未生成',
    settings: { setCount: 3, rankingMethod: '勝敗方式', courtCount: 1, maxEntrantsPerCourt: 5, leagueFormat: '独立リーグ' },
    ...overrides,
  };
}

function makeStore(entrants: Entrant[] = []): StoreType {
  return {
    auth: { id: 'admin', passwordHash: '' },
    session: null,
    tournaments: [],
    categories: [],
    entrants,
    matches: [],
    standings: {},
    backups: [],
  };
}

function makeEntrant(overrides: Partial<Entrant> = {}): Entrant {
  return {
    id: 'e1',
    tournamentId: 't1',
    categoryId: 'cat-A',
    name: '太郎',
    hasResult: false,
    ...overrides,
  };
}

describe('validateEntrantInput（選手(チーム)情報登録バリデーション・要件定義書3.3）', () => {
  it('U-VAL-18: 選手(チーム)名は必須かつ全角10文字まで', () => {
    const store = makeStore();
    const category = makeCategory();
    expect(validateEntrantInput(store, category, { categoryId: 'cat-A', name: '' })).toBeTruthy();
    expect(
      validateEntrantInput(store, category, { categoryId: 'cat-A', name: 'あ'.repeat(11) }),
    ).toBeTruthy();
    expect(
      validateEntrantInput(store, category, { categoryId: 'cat-A', name: 'あ'.repeat(10) }),
    ).toBeUndefined();
  });

  it('U-VAL-19: 所属は任意、全角10文字まで（空欄は許容）', () => {
    const store = makeStore();
    const category = makeCategory();
    expect(
      validateEntrantInput(store, category, { categoryId: 'cat-A', name: '太郎', affiliation: 'あ'.repeat(11) }),
    ).toBeTruthy();
    expect(
      validateEntrantInput(store, category, { categoryId: 'cat-A', name: '太郎', affiliation: 'あ'.repeat(10) }),
    ).toBeUndefined();
    expect(
      validateEntrantInput(store, category, { categoryId: 'cat-A', name: '太郎' }),
    ).toBeUndefined();
  });

  it('U-VAL-09: 選手(チーム)名は同一カテゴリ内で重複不可', () => {
    const store = makeStore([makeEntrant({ id: 'e1', name: 'Aさん' })]);
    const category = makeCategory();
    const error = validateEntrantInput(store, category, { categoryId: 'cat-A', name: 'Aさん' });
    expect(error).toBeTruthy();
  });

  it('U-VAL-10: 別カテゴリであれば同名登録可', () => {
    const store = makeStore([makeEntrant({ id: 'e1', name: 'Aさん', categoryId: 'cat-A' })]);
    const otherCategory = makeCategory({ id: 'cat-B', key: 'B' });
    const error = validateEntrantInput(store, otherCategory, {
      categoryId: 'cat-B',
      name: 'Aさん',
    });
    expect(error).toBeUndefined();
  });

  it('編集時は excludeEntrantId で自分自身を重複判定から除外する', () => {
    const store = makeStore([makeEntrant({ id: 'e1', name: 'Aさん' })]);
    const category = makeCategory();
    const error = validateEntrantInput(
      store,
      category,
      { categoryId: 'cat-A', name: 'Aさん' },
      'e1',
    );
    expect(error).toBeUndefined();
  });

  it('U-VAL-11: 手動コート番号は競技情報のコート数以下', () => {
    const store = makeStore();
    const category = makeCategory({ settings: { setCount: 3, rankingMethod: '勝敗方式', courtCount: 2, maxEntrantsPerCourt: 5, leagueFormat: '独立リーグ' } });
    const error = validateEntrantInput(store, category, {
      categoryId: 'cat-A',
      name: '太郎',
      courtSelection: '手動',
      courtNumber: 3,
    });
    expect(error).toBeTruthy();
  });

  it('U-VAL-12: 手動選択時、同一コート番号の人数は1コート最大選手(チーム)数以下', () => {
    const existing = Array.from({ length: 5 }, (_, i) =>
      makeEntrant({ id: `e${i}`, name: `選手${i}`, courtSelection: '手動', courtNumber: 1 }),
    );
    const store = makeStore(existing);
    const category = makeCategory({
      settings: { setCount: 3, rankingMethod: '勝敗方式', courtCount: 2, maxEntrantsPerCourt: 5, leagueFormat: '独立リーグ' },
    });
    const error = validateEntrantInput(store, category, {
      categoryId: 'cat-A',
      name: '6人目',
      courtSelection: '手動',
      courtNumber: 1,
    });
    expect(error).toBeTruthy();
  });

  it('U-VAL-13: カテゴリの登録選手(チーム)数合計は「コート数×1コート最大選手(チーム)数」を超えられない', () => {
    const existing = Array.from({ length: 10 }, (_, i) => makeEntrant({ id: `e${i}`, name: `選手${i}` }));
    const store = makeStore(existing);
    const category = makeCategory({
      settings: { setCount: 3, rankingMethod: '勝敗方式', courtCount: 2, maxEntrantsPerCourt: 5, leagueFormat: '独立リーグ' },
    });
    const error = validateEntrantInput(store, category, { categoryId: 'cat-A', name: '11人目' });
    expect(error).toBeTruthy();
  });

  it('単一リーグの場合は「1コート最大選手(チーム)数」上限・手動コート指定チェックを行わない', () => {
    const existing = Array.from({ length: 10 }, (_, i) => makeEntrant({ id: `e${i}`, name: `選手${i}` }));
    const store = makeStore(existing);
    const category = makeCategory({
      settings: {
        setCount: 3,
        rankingMethod: '勝敗方式',
        courtCount: 2,
        maxEntrantsPerCourt: 5,
        leagueFormat: '単一リーグ',
      },
    });
    const error = validateEntrantInput(store, category, { categoryId: 'cat-A', name: '11人目' });
    expect(error).toBeUndefined();
  });
});

describe('sortByDisplayOrder（リーグ表の並び順・要件定義書3.4）', () => {
  it('U-LT-11: displayOrderの昇順に並び替える（登録順には依存しない）', () => {
    const entrants = [
      makeEntrant({ id: 'e1', name: 'A', displayOrder: 3 }),
      makeEntrant({ id: 'e2', name: 'B', displayOrder: 1 }),
      makeEntrant({ id: 'e3', name: 'C', displayOrder: 2 }),
    ];
    const sorted = sortByDisplayOrder(entrants);
    expect(sorted.map((e) => e.id)).toEqual(['e2', 'e3', 'e1']);
  });

  it('U-LT-12: displayOrder未設定（生成前）の場合は元の順序のまま返す', () => {
    const entrants = [
      makeEntrant({ id: 'e1', name: 'A' }),
      makeEntrant({ id: 'e2', name: 'B' }),
      makeEntrant({ id: 'e3', name: 'C' }),
    ];
    const sorted = sortByDisplayOrder(entrants);
    expect(sorted.map((e) => e.id)).toEqual(['e1', 'e2', 'e3']);
  });
});

function makeStandingRow(overrides: Partial<StandingRow> = {}): StandingRow {
  return {
    entrantId: 'e1',
    rank: 2,
    isTie: true,
    wins: 1,
    draws: 0,
    losses: 1,
    setsWon: 2,
    setsLost: 2,
    setRate: 1,
    pointsFor: 10,
    pointsAgainst: 10,
    pointRate: 1,
    jankenPending: true,
    ...overrides,
  };
}

describe('confirmJankenRanks（じゃんけん結果の最終順位確定・要件定義書3.8）', () => {
  // loadStore/saveStoreはファイルストア（LEAGUE_TABLE_DATA_DIR）を直接読み書きするため、
  // テストごとに一時ディレクトリへ切り替えてから動的importし直す（モジュール内のDATA_DIR定数は初回import時に確定するため）
  let tmpDir: string;
  let confirmJankenRanks: typeof import('@/lib/mock-data').confirmJankenRanks;
  let loadStore: typeof import('@/lib/store').loadStore;
  let saveStore: typeof import('@/lib/store').saveStore;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'league-table-janken-'));
    process.env.LEAGUE_TABLE_DATA_DIR = tmpDir;
    vi.resetModules();
    const storeModule = await import('@/lib/store');
    const mockDataModule = await import('@/lib/mock-data');
    loadStore = storeModule.loadStore;
    saveStore = storeModule.saveStore;
    confirmJankenRanks = mockDataModule.confirmJankenRanks;
  });

  afterEach(() => {
    delete process.env.LEAGUE_TABLE_DATA_DIR;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('U-JK-02: 管理者が手動で順位を上書きすると、最終順位として確定しjankenPendingが解除される', () => {
    const store = loadStore();
    store.standings['cat-1:1'] = [
      makeStandingRow({ entrantId: 'A', rank: 1, isTie: false, jankenPending: undefined }),
      makeStandingRow({ entrantId: 'B', rank: 2 }),
      makeStandingRow({ entrantId: 'C', rank: 2 }),
    ];
    saveStore(store);

    const result = confirmJankenRanks('cat-1', 1, [
      { entrantId: 'B', rank: 2 },
      { entrantId: 'C', rank: 3 },
    ]);
    expect(result).toEqual({ ok: true });

    const after = loadStore();
    const rows = after.standings['cat-1:1'];
    expect(rows.find((r) => r.entrantId === 'B')!.rank).toBe(2);
    expect(rows.find((r) => r.entrantId === 'C')!.rank).toBe(3);
    expect(rows.find((r) => r.entrantId === 'B')!.jankenPending).toBeUndefined();
    expect(rows.find((r) => r.entrantId === 'C')!.jankenPending).toBeUndefined();
    // タイに関与していないAの順位・状態は影響を受けない
    expect(rows.find((r) => r.entrantId === 'A')!.rank).toBe(1);
  });

  it('U-JK-02: じゃんけん待ちでない選手(チーム)を指定した場合はエラーを返し、ストアを更新しない', () => {
    const store = loadStore();
    store.standings['cat-1:1'] = [
      makeStandingRow({ entrantId: 'A', rank: 1, isTie: false, jankenPending: undefined }),
      makeStandingRow({ entrantId: 'B', rank: 2 }),
      makeStandingRow({ entrantId: 'C', rank: 2 }),
    ];
    saveStore(store);

    // Aはじゃんけん待ちではないため対象として指定できない
    const result = confirmJankenRanks('cat-1', 1, [{ entrantId: 'A', rank: 1 }]);
    expect(result.ok).toBe(false);

    const after = loadStore();
    expect(after.standings['cat-1:1']!.find((r) => r.entrantId === 'A')!.rank).toBe(1);
  });

  it('U-JK-02: 指定順位がタイした人数分の範囲外または重複する場合はエラーを返す', () => {
    const store = loadStore();
    store.standings['cat-1:1'] = [
      makeStandingRow({ entrantId: 'B', rank: 2 }),
      makeStandingRow({ entrantId: 'C', rank: 2 }),
    ];
    saveStore(store);

    // B,Cの2者タイに対し、範囲（2,3）に収まらない重複指定（2,2）
    const result = confirmJankenRanks('cat-1', 1, [
      { entrantId: 'B', rank: 2 },
      { entrantId: 'C', rank: 2 },
    ]);
    expect(result.ok).toBe(false);

    const after = loadStore();
    expect(after.standings['cat-1:1']!.find((r) => r.entrantId === 'B')!.jankenPending).toBe(true);
  });
});
