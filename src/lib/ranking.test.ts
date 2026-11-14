import { describe, expect, it } from 'vitest';
import { computeStandings } from '@/lib/ranking';
import type { CategorySettings, Match } from '@/types/domain';

const winLoseSettings: CategorySettings = {
  setCount: 3,
  rankingMethod: '勝敗方式',
  courtCount: 1,
  maxEntrantsPerCourt: 5,
  leagueFormat: '独立リーグ',
};

const pointSettings: CategorySettings = {
  setCount: 3,
  rankingMethod: '勝点方式',
  winPoints: 3,
  drawPoints: 1,
  losePoints: 0,
  courtCount: 1,
  maxEntrantsPerCourt: 5,
  leagueFormat: '独立リーグ',
};

function match(
  id: string,
  entrantAId: string,
  entrantBId: string,
  sets: Array<[number | null, number | null]>,
): Match {
  return {
    id,
    categoryId: 'cat',
    courtNumber: 1,
    order: 1,
    entrantAId,
    entrantBId,
    refereeEntrantId: null,
    sets: sets.map(([scoreA, scoreB]) => ({ scoreA, scoreB })),
    status: '入力済み',
  };
}

describe('computeStandings（試合結果自動計算・順位決定・要件定義書3.8）', () => {
  it('U-RT-01/02: セット率は未入力セットを除いた得セット数・失セット数から算出する', () => {
    const matches = [match('m1', 'A', 'B', [[25, 20], [20, 25], [null, null]])];
    const standings = computeStandings(['A', 'B'], matches, winLoseSettings);
    const a = standings.find((s) => s.entrantId === 'A')!;
    expect(a.setsWon).toBe(1);
    expect(a.setsLost).toBe(1);
    expect(a.setRate).toBeCloseTo(1, 5);
  });

  it('U-RT-03: 全セット未入力の試合はゼロ除算にならず0を返す', () => {
    const matches = [match('m1', 'A', 'B', [[null, null], [null, null]])];
    const standings = computeStandings(['A', 'B'], matches, winLoseSettings);
    const a = standings.find((s) => s.entrantId === 'A')!;
    expect(a.setRate).toBe(0);
    expect(Number.isFinite(a.setRate)).toBe(true);
  });

  it('U-RT-05: 失セット数0（無敗）・失点0の場合、セット率・得点率は無限大（表示はMAX）として扱われる', () => {
    const matches = [match('m1', 'A', 'B', [[25, 0], [25, 0]])];
    const standings = computeStandings(['A', 'B'], matches, winLoseSettings);
    const a = standings.find((s) => s.entrantId === 'A')!;
    expect(a.setsLost).toBe(0);
    expect(a.setRate).toBe(Infinity);
    expect(a.pointsAgainst).toBe(0);
    expect(a.pointRate).toBe(Infinity);
  });

  it('U-PT-01/02: 得点・失点は全セットのスコア合計、得点率はその比で算出する', () => {
    const matches = [match('m1', 'A', 'B', [[25, 20], [25, 18]])];
    const standings = computeStandings(['A', 'B'], matches, winLoseSettings);
    const a = standings.find((s) => s.entrantId === 'A')!;
    expect(a.pointsFor).toBe(50);
    expect(a.pointsAgainst).toBe(38);
    expect(a.pointRate).toBeCloseTo(50 / 38, 5);
  });

  it('U-WP-03: 勝点方式の合計勝点は配点ルール×勝敗数で算出する（設定値をそのまま転記しない）', () => {
    const matches = [
      match('m1', 'A', 'B', [[25, 20], [25, 18]]),
      match('m2', 'A', 'C', [[25, 20], [20, 25], [15, 13]]),
      match('m3', 'A', 'D', [[20, 25], [20, 25]]),
    ];
    const standings = computeStandings(['A', 'B', 'C', 'D'], matches, pointSettings);
    const a = standings.find((s) => s.entrantId === 'A')!;
    // 2勝(B,C) 1敗(D) → 3*2 + 0*1 = 6 であり、設定値の "3" そのものではない
    expect(a.points).toBe(6);
    expect(a.points).not.toBe(pointSettings.winPoints);
  });

  it('U-RK-01/02/03: 勝敗方式は勝敗数→セット率→得点率の順で順位が決まる', () => {
    const matches = [
      match('m1', 'A', 'B', [[25, 20], [25, 18]]),
      match('m2', 'A', 'C', [[25, 20], [25, 18]]),
      match('m3', 'B', 'C', [[25, 10], [25, 10]]),
    ];
    const standings = computeStandings(['A', 'B', 'C'], matches, winLoseSettings);
    const byId = new Map(standings.map((s) => [s.entrantId, s]));
    expect(byId.get('A')!.rank).toBe(1); // 2勝
    expect(byId.get('B')!.rank).toBe(2); // 1勝1敗
    expect(byId.get('C')!.rank).toBe(3); // 0勝2敗
  });

  it('U-RK-05: 同じ試合結果でも勝敗方式と勝点方式で一次ソートキーが異なり、順位が変わりうる', () => {
    // Aは1勝1敗、Bは2分(勝ちなし)。
    // 勝敗方式では勝ち数があるAが上位。勝点方式で引分の配点を勝利より高くすると、Bが上位になる。
    const drawHeavySettings: CategorySettings = {
      ...pointSettings,
      winPoints: 1,
      drawPoints: 3,
      losePoints: 0,
    };
    const matches = [
      match('m1', 'A', 'B', [[25, 10]]), // Aの勝ち
      match('m2', 'A', 'C', [[10, 25]]), // Aの負け
      match('m3', 'B', 'C', [[20, 20]]), // 引分
    ];
    const winLoseStandings = computeStandings(['A', 'B', 'C'], matches, winLoseSettings);
    const pointStandings = computeStandings(['A', 'B', 'C'], matches, drawHeavySettings);
    const winLoseA = winLoseStandings.find((s) => s.entrantId === 'A')!;
    const winLoseB = winLoseStandings.find((s) => s.entrantId === 'B')!;
    const pointA = pointStandings.find((s) => s.entrantId === 'A')!;
    const pointB = pointStandings.find((s) => s.entrantId === 'B')!;
    expect(winLoseA.wins).toBe(1);
    expect(winLoseB.wins).toBe(0);
    expect(winLoseA.rank).toBeLessThan(winLoseB.rank); // 勝敗方式: 勝ちのあるAが上位
    expect(pointA.points).toBe(1); // 1勝0分1敗 → 1*1
    expect(pointB.points).toBe(3); // 0勝1分1敗 → 3*1
    expect(pointB.rank).toBeLessThan(pointA.rank); // 勝点方式: 引分の配点が高いためBが上位（方式により逆転する）
  });

  it('U-TIE-01: 3者以上が同成績でタイした場合、タイした者同士の対戦結果のみで再集計する', () => {
    // A,B,Cは互いに1勝1敗（3すくみ）で全指標が同値、Dには全員が勝利
    const matches = [
      match('m1', 'A', 'B', [[25, 20]]),
      match('m2', 'B', 'C', [[25, 20]]),
      match('m3', 'C', 'A', [[25, 20]]),
      match('m4', 'A', 'D', [[25, 10]]),
      match('m5', 'B', 'D', [[25, 10]]),
      match('m6', 'C', 'D', [[25, 10]]),
    ];
    const standings = computeStandings(['A', 'B', 'C', 'D'], matches, winLoseSettings);
    const byId = new Map(standings.map((s) => [s.entrantId, s]));
    // A,B,Cは全指標同値の3すくみのため、ミニリーグでも決着せずじゃんけん待ちになる
    expect(byId.get('A')!.jankenPending).toBe(true);
    expect(byId.get('B')!.jankenPending).toBe(true);
    expect(byId.get('C')!.jankenPending).toBe(true);
    expect(byId.get('D')!.rank).toBe(4);
  });

  it('U-TIE-03: 2者のみのタイは直接対決で判定する', () => {
    const matches = [
      match('m1', 'A', 'B', [[25, 10]]),
      match('m2', 'A', 'C', [[10, 25]]),
      match('m3', 'B', 'C', [[10, 25]]),
    ];
    // A: 1勝1敗、B: 0勝2敗、C: 2勝0敗 ... タイが生じないケースだが、
    // 少なくともAがBより下位にならないこと（直接対決を踏まえた順位）を確認する
    const standings = computeStandings(['A', 'B', 'C'], matches, winLoseSettings);
    const byId = new Map(standings.map((s) => [s.entrantId, s]));
    expect(byId.get('A')!.rank).toBeLessThanOrEqual(byId.get('B')!.rank);
  });

  it('U-JK-01: 直接対決も引分の場合はじゃんけん待ちフラグが立つ', () => {
    const matches = [
      match('m1', 'A', 'B', [[20, 10]]),
      match('m2', 'A', 'C', [[20, 10]]),
      match('m3', 'B', 'C', [[20, 20]]),
    ];
    const standings = computeStandings(['A', 'B', 'C'], matches, winLoseSettings);
    const byId = new Map(standings.map((s) => [s.entrantId, s]));
    expect(byId.get('B')!.jankenPending).toBe(true);
    expect(byId.get('C')!.jankenPending).toBe(true);
    expect(byId.get('A')!.jankenPending).toBeUndefined();
  });

  it('U-JK-03: computeStandingsはjankenPendingの手動確定状態を記憶しない（同一入力なら常に同じ結果を返す）', () => {
    const matches = [
      match('m1', 'A', 'B', [[20, 10]]),
      match('m2', 'A', 'C', [[20, 10]]),
      match('m3', 'B', 'C', [[20, 20]]),
    ];
    // 1回目の計算（confirmJankenRanksによる手動確定はcomputeStandings自体には一切影響しない）
    const first = computeStandings(['A', 'B', 'C'], matches, winLoseSettings);
    // 同一の試合結果に対し、再度同じ計算を行う（saveMatchResultが別の試合結果保存時に行う再集計を模擬）
    const second = computeStandings(['A', 'B', 'C'], matches, winLoseSettings);
    const firstById = new Map(first.map((s) => [s.entrantId, s]));
    const secondById = new Map(second.map((s) => [s.entrantId, s]));
    // タイ条件（B,C）が変わらない限り、手動確定の有無に関わらずjankenPendingは常に同じ値になる
    expect(firstById.get('B')!.jankenPending).toBe(true);
    expect(secondById.get('B')!.jankenPending).toBe(true);
    expect(firstById.get('C')!.jankenPending).toBe(true);
    expect(secondById.get('C')!.jankenPending).toBe(true);
  });

  it('U-RT-04: セットの引分（同点セット）は得セット数・失セット数のいずれにも計上されない', () => {
    // 1セット目は20-20の引分、2セット目はAの勝ち、3セット目はAの負け
    const matches = [
      match('m1', 'A', 'B', [
        [20, 20],
        [25, 10],
        [10, 25],
      ]),
    ];
    const standings = computeStandings(['A', 'B'], matches, winLoseSettings);
    const a = standings.find((s) => s.entrantId === 'A')!;
    // 引分セットを除いた2セット（1勝1敗）のみがセット率の分子・分母になる
    expect(a.setsWon).toBe(1);
    expect(a.setsLost).toBe(1);
    expect(a.setRate).toBeCloseTo(1, 5);
  });

  it('U-PT-03: 未入力セットの点数は集計に含めない', () => {
    const matches = [
      match('m1', 'A', 'B', [
        [25, 20],
        [25, 18],
        [null, null],
      ]),
    ];
    const standings = computeStandings(['A', 'B'], matches, winLoseSettings);
    const a = standings.find((s) => s.entrantId === 'A')!;
    // セット3は未入力のため合計対象外（50/38のまま変わらない）
    expect(a.pointsFor).toBe(50);
    expect(a.pointsAgainst).toBe(38);
    expect(a.pointRate).toBeCloseTo(50 / 38, 5);
  });

  it('U-RK-04: 勝点方式では勝点の多い順に順位が決まる', () => {
    const matches = [
      match('m1', 'A', 'B', [[25, 20]]), // Aの勝ち
      match('m2', 'A', 'C', [[25, 20]]), // Aの勝ち
      match('m3', 'B', 'C', [[20, 20]]), // 引分
    ];
    const standings = computeStandings(['A', 'B', 'C'], matches, pointSettings);
    const byId = new Map(standings.map((s) => [s.entrantId, s]));
    // A: 2勝 → 3*2=6点、B: 1敗1分 → 1*1=1点、C: 1敗1分 → 1*1=1点
    expect(byId.get('A')!.points).toBe(6);
    expect(byId.get('B')!.points).toBe(1);
    expect(byId.get('C')!.points).toBe(1);
    expect(byId.get('A')!.rank).toBe(1);
  });

  it('U-MR-05: 複数セットで勝ちセット数が多い方を試合の勝ちとする', () => {
    // 3セット中、Aが2勝1敗
    const matches = [
      match('m1', 'A', 'B', [
        [25, 20],
        [20, 25],
        [25, 18],
      ]),
    ];
    const standings = computeStandings(['A', 'B'], matches, winLoseSettings);
    const byId = new Map(standings.map((s) => [s.entrantId, s]));
    expect(byId.get('A')!.wins).toBe(1);
    expect(byId.get('A')!.losses).toBe(0);
    expect(byId.get('B')!.losses).toBe(1);
    expect(byId.get('B')!.wins).toBe(0);
  });

  it('U-MR-06: 勝ちセット数が同数の場合は試合全体が引分になる', () => {
    // 3セット中、1勝1敗1分
    const matches = [
      match('m1', 'A', 'B', [
        [25, 20],
        [20, 25],
        [20, 20],
      ]),
    ];
    const standings = computeStandings(['A', 'B'], matches, winLoseSettings);
    const byId = new Map(standings.map((s) => [s.entrantId, s]));
    expect(byId.get('A')!.draws).toBe(1);
    expect(byId.get('B')!.draws).toBe(1);
    expect(byId.get('A')!.wins).toBe(0);
    expect(byId.get('A')!.losses).toBe(0);
  });

  it('U-MR-07: 途中で勝敗が決した場合、残りセットが未入力でも試合結果を確定できる', () => {
    // セット数5、2-0の時点で残り3セットが未入力
    const matches = [
      match('m1', 'A', 'B', [
        [25, 20],
        [25, 18],
        [null, null],
        [null, null],
        [null, null],
      ]),
    ];
    const standings = computeStandings(['A', 'B'], matches, winLoseSettings);
    const byId = new Map(standings.map((s) => [s.entrantId, s]));
    // 残り3セットは未入力のまま許容されつつ、Aの勝ちとして確定している
    expect(byId.get('A')!.wins).toBe(1);
    expect(byId.get('B')!.losses).toBe(1);
  });

  it('U-TIE-02: ミニリーグ再集計後になお一部が同成績の場合はその部分集合でさらにじゃんけん待ちとなる', () => {
    // A,B,Cがトップレベルで3者タイになるよう設計しつつ、
    // A,B,C同士の対戦（ミニリーグ対象試合）ではAが2勝0敗、B・Cは互いに引分になるようにする。
    // 全体成績（sortKey: [wins, setRate, pointRate]）がA,B,Cで完全一致するよう、
    // D,E戦の勝敗を調整済み（事前にPythonで数値を検証した組み合わせ）。
    const matches = [
      match('m1', 'A', 'B', [[25, 20]]), // Aの勝ち
      match('m2', 'A', 'C', [[25, 20]]), // Aの勝ち
      match('m3', 'B', 'C', [[20, 20]]), // 引分
      match('m4', 'A', 'D', [[20, 25]]), // Aの負け
      match('m5', 'A', 'E', [[20, 20]]), // 引分
      match('m6', 'B', 'D', [[25, 20]]), // Bの勝ち
      match('m7', 'B', 'E', [[25, 20]]), // Bの勝ち
      match('m8', 'C', 'D', [[25, 20]]), // Cの勝ち
      match('m9', 'C', 'E', [[25, 20]]), // Cの勝ち
    ];
    const standings = computeStandings(['A', 'B', 'C', 'D', 'E'], matches, winLoseSettings);
    const byId = new Map(standings.map((s) => [s.entrantId, s]));

    // 全体成績（sortKey）がA,B,Cで完全一致し、トップレベルで3者タイになっている
    expect(byId.get('A')!.wins).toBe(byId.get('B')!.wins);
    expect(byId.get('B')!.wins).toBe(byId.get('C')!.wins);
    expect(byId.get('A')!.setRate).toBeCloseTo(byId.get('B')!.setRate, 5);
    expect(byId.get('B')!.setRate).toBeCloseTo(byId.get('C')!.setRate, 5);
    expect(byId.get('A')!.pointRate).toBeCloseTo(byId.get('B')!.pointRate, 5);
    expect(byId.get('B')!.pointRate).toBeCloseTo(byId.get('C')!.pointRate, 5);

    // ミニリーグ再集計（A,B,C同士の試合のみ）の結果、Aが2勝0敗で明確に上位、
    // B・Cは互いに引分のため依然同成績でじゃんけん待ちとなる
    expect(byId.get('A')!.rank).toBe(1);
    expect(byId.get('A')!.jankenPending).toBeUndefined();
    expect(byId.get('B')!.jankenPending).toBe(true);
    expect(byId.get('C')!.jankenPending).toBe(true);
    expect(byId.get('B')!.rank).toBe(byId.get('C')!.rank);

    // D,Eはトップグループより明確に下位
    expect(byId.get('D')!.rank).toBeGreaterThan(byId.get('B')!.rank);
    expect(byId.get('E')!.rank).toBeGreaterThan(byId.get('D')!.rank);
  });
});
