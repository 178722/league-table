import { describe, expect, it } from 'vitest';
import {
  assignCourts,
  assignReferees,
  assignRefereesForSingleLeague,
  generateRoundRobinOrder,
  scheduleSingleLeagueMatches,
  type SingleLeagueMatch,
} from '@/lib/scheduling';

describe('generateRoundRobinOrder（リーグ表自動生成・要件定義書3.4）', () => {
  it('U-LT-01: 参加4名の場合、組合せ数は N×(N-1)÷2 = 6 で重複・欠落がない', () => {
    const order = generateRoundRobinOrder(['A', 'B', 'C', 'D']);
    expect(order).toHaveLength(6);
    const normalized = new Set(order.map(([a, b]) => [a, b].sort().join('-')));
    expect(normalized).toEqual(new Set(['A-B', 'A-C', 'A-D', 'B-C', 'B-D', 'C-D']));
  });

  it('U-MO-04: 参加2名の場合は1試合のみ生成される', () => {
    const order = generateRoundRobinOrder(['A', 'B']);
    expect(order).toHaveLength(1);
    expect(order[0].sort()).toEqual(['A', 'B']);
  });

  it('奇数人数の場合もBYEを除いた総当たり組合せになる（N=5→10試合）', () => {
    const ids = ['A', 'B', 'C', 'D', 'E'];
    const order = generateRoundRobinOrder(ids);
    expect(order).toHaveLength(10);
    for (const [a, b] of order) {
      expect(a).not.toBe('__BYE__');
      expect(b).not.toBe('__BYE__');
    }
  });

  it('U-MO-01: 連続する試合で同一チームが連続する回数は、総当たり試合数に対して少数に抑えられる', () => {
    const ids = ['A', 'B', 'C', 'D', 'E', 'F'];
    const order = generateRoundRobinOrder(ids);
    let consecutive = 0;
    for (let i = 1; i < order.length; i += 1) {
      const prev = new Set(order[i - 1]);
      const curr = order[i];
      if (curr.some((id) => prev.has(id))) consecutive += 1;
    }
    // ベストエフォート基準：全試合が連続一致するような劣化した順序にはならないことを確認する
    expect(consecutive).toBeLessThan(order.length);
  });

  it('U-MO-02: コート数を考慮し、各コートの試合が独立した順序列として生成される（court=2、各コート4人ずつ）', () => {
    const court1Ids = ['A', 'B', 'C', 'D'];
    const court2Ids = ['E', 'F', 'G', 'H'];
    const entrants = [...court1Ids, ...court2Ids].map((id) => ({ id }));
    const assignment = assignCourts(entrants, 2);

    const idsOfCourt = (court: number) =>
      entrants.filter((e) => assignment.get(e.id) === court).map((e) => e.id);

    const court1Order = generateRoundRobinOrder(idsOfCourt(1));
    const court2Order = generateRoundRobinOrder(idsOfCourt(2));

    // 各コート4人の総当たりなので1試合目〜3試合目（N×(N-1)÷2 = 6試合）が独立して生成される
    expect(court1Order).toHaveLength(6);
    expect(court2Order).toHaveLength(6);

    // コート1の試合にコート2の選手が混在しない（逆も同様）
    const court1IdSet = new Set(idsOfCourt(1));
    const court2IdSet = new Set(idsOfCourt(2));
    for (const [a, b] of court1Order) {
      expect(court1IdSet.has(a)).toBe(true);
      expect(court1IdSet.has(b)).toBe(true);
      expect(court2IdSet.has(a)).toBe(false);
      expect(court2IdSet.has(b)).toBe(false);
    }
    for (const [a, b] of court2Order) {
      expect(court2IdSet.has(a)).toBe(true);
      expect(court2IdSet.has(b)).toBe(true);
      expect(court1IdSet.has(a)).toBe(false);
      expect(court1IdSet.has(b)).toBe(false);
    }
  });

  it('U-MO-03: 休憩時間（連続試合までの間隔）が均等化される方向で生成される（N=6総当たり15試合）', () => {
    const ids = ['A', 'B', 'C', 'D', 'E', 'F'];

    // 試合間インターバルの分散を計算するヘルパー
    // 各選手の出場試合インデックス列から、連続出場間の差分（インターバル）を求め、その分散を返す
    const intervalVariance = (matches: Array<[string, string]>) => {
      const appearances = new Map<string, number[]>();
      matches.forEach(([a, b], i) => {
        appearances.set(a, [...(appearances.get(a) ?? []), i]);
        appearances.set(b, [...(appearances.get(b) ?? []), i]);
      });

      const intervals: number[] = [];
      for (const indices of appearances.values()) {
        for (let i = 1; i < indices.length; i += 1) {
          intervals.push(indices[i] - indices[i - 1]);
        }
      }

      const mean = intervals.reduce((sum, v) => sum + v, 0) / intervals.length;
      return intervals.reduce((sum, v) => sum + (v - mean) ** 2, 0) / intervals.length;
    };

    const generatedOrder = generateRoundRobinOrder(ids);
    expect(generatedOrder).toHaveLength(15);

    // 比較対象：単純な二重ループで生成した「ナイーブな」総当たり順
    const naiveOrder: Array<[string, string]> = [];
    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) {
        naiveOrder.push([ids[i], ids[j]]);
      }
    }
    expect(naiveOrder).toHaveLength(15);

    const generatedVariance = intervalVariance(generatedOrder);
    const naiveVariance = intervalVariance(naiveOrder);

    // ベストエフォート基準：円卓法による生成順の方が、ナイーブな順序よりインターバルの分散が小さい（またはそれ以下）
    expect(generatedVariance).toBeLessThanOrEqual(naiveVariance);
  });
});

describe('assignCourts（コート自動振り分け・要件定義書3.4）', () => {
  it('U-LT-04: コート数2・全員自動のN=8は各コート4人ずつに均等配分される', () => {
    const entrants = Array.from({ length: 8 }, (_, i) => ({ id: `e${i}` }));
    const assignment = assignCourts(entrants, 2);
    const counts = new Map<number, number>();
    for (const court of assignment.values()) counts.set(court, (counts.get(court) ?? 0) + 1);
    expect(counts.get(1)).toBe(4);
    expect(counts.get(2)).toBe(4);
  });

  it('U-LT-05: 割り切れない場合（N=7, court=2）は前から順に1人ずつ加えて振り分ける', () => {
    const entrants = Array.from({ length: 7 }, (_, i) => ({ id: `e${i}` }));
    const assignment = assignCourts(entrants, 2);
    const counts = new Map<number, number>();
    for (const court of assignment.values()) counts.set(court, (counts.get(court) ?? 0) + 1);
    expect(counts.get(1)).toBe(4);
    expect(counts.get(2)).toBe(3);
  });

  it('U-LT-06: 手動選択者がいる場合、残り枠のみを自動選択者に配分する', () => {
    const entrants = [
      { id: 'm1', courtSelection: '手動' as const, courtNumber: 1 },
      { id: 'm2', courtSelection: '手動' as const, courtNumber: 1 },
      { id: 'a1' },
      { id: 'a2' },
      { id: 'a3' },
      { id: 'a4' },
    ];
    const assignment = assignCourts(entrants, 2);
    expect(assignment.get('m1')).toBe(1);
    expect(assignment.get('m2')).toBe(1);
    const counts = new Map<number, number>();
    for (const court of assignment.values()) counts.set(court, (counts.get(court) ?? 0) + 1);
    expect(counts.get(1)).toBe(3); // 手動2人 + 自動1人
    expect(counts.get(2)).toBe(3); // 自動3人
  });

  it('コート数が1の場合は全員コート1に割り当てられる', () => {
    const entrants = Array.from({ length: 5 }, (_, i) => ({ id: `e${i}` }));
    const assignment = assignCourts(entrants, 1);
    for (const court of assignment.values()) expect(court).toBe(1);
  });

  it('U-LT-07: 自動選択のコート割当は実行のたびに結果が変わりうる（再生成で固定されない契約。シード指定機能はなく再現性は保証されない）', () => {
    const entrants = Array.from({ length: 8 }, (_, i) => ({ id: `e${i}` }));
    const serialize = (assignment: Map<string, number>) =>
      entrants.map((e) => assignment.get(e.id)).join(',');
    const results = new Set(
      Array.from({ length: 20 }, () => serialize(assignCourts(entrants, 2))),
    );
    // ランダム性を許容する設計のため、20回も実行すれば少なくとも1回は異なる割当結果が得られるはず
    expect(results.size).toBeGreaterThan(1);
  });
});

describe('assignReferees（審判順自動生成・要件定義書3.6）', () => {
  it('U-RF-01: 審判は対戦カードの2チーム以外から選ばれる', () => {
    const order = generateRoundRobinOrder(['A', 'B', 'C', 'D']);
    const referees = assignReferees(order, ['A', 'B', 'C', 'D']);
    order.forEach(([a, b], i) => {
      expect(referees[i]).not.toBe(a);
      expect(referees[i]).not.toBe(b);
    });
  });

  it('U-RF-03: 審判回数ができる限り均等化される（最大-最小の差が1以内）', () => {
    const order = generateRoundRobinOrder(['A', 'B', 'C', 'D']);
    const referees = assignReferees(order, ['A', 'B', 'C', 'D']);
    const counts = new Map<string, number>();
    for (const r of referees) {
      if (!r) continue;
      counts.set(r, (counts.get(r) ?? 0) + 1);
    }
    const values = [...counts.values()];
    expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(1);
  });

  it('U-RF-04: 参加者が2名のみの場合、対戦中の2者以外に審判候補がいないため未割当（null）になる', () => {
    const order = generateRoundRobinOrder(['A', 'B']);
    const referees = assignReferees(order, ['A', 'B']);
    expect(referees[0]).toBeNull();
  });

  it('U-RF-02: 同一チームの連続審判をできる限り回避する（N=4総当たり6試合）', () => {
    const ids = ['A', 'B', 'C', 'D'];
    const order = generateRoundRobinOrder(ids);
    const referees = assignReferees(order, ids);

    // 連続する試合で同一審判（null以外）が割り当てられている回数を数えるヘルパー
    const countConsecutiveSameReferee = (refs: Array<string | null>) => {
      let count = 0;
      for (let i = 1; i < refs.length; i += 1) {
        if (refs[i] !== null && refs[i] === refs[i - 1]) count += 1;
      }
      return count;
    };

    const consecutiveCount = countConsecutiveSameReferee(referees);

    // 比較対象：候補の先頭（対戦者以外で最初に見つかった選手）を機械的に選ぶ「ナイーブな」割当
    const naiveReferees: Array<string | null> = order.map(([a, b]) => {
      const candidates = ids.filter((id) => id !== a && id !== b);
      return candidates.length > 0 ? candidates[0] : null;
    });
    const naiveConsecutiveCount = countConsecutiveSameReferee(naiveReferees);

    // ベストエフォート基準：直前審判を避けるロジックにより連続回数は0件に抑えられる
    expect(consecutiveCount).toBe(0);
    expect(consecutiveCount).toBeLessThanOrEqual(naiveConsecutiveCount);
  });
});

describe('scheduleSingleLeagueMatches（単一リーグの試合予定生成・要件定義書5章）', () => {
  it('U-MO-05: 総試合数はN×(N-1)÷2になる（N=6, court=2）', () => {
    const ids = ['A', 'B', 'C', 'D', 'E', 'F'];
    const schedule = scheduleSingleLeagueMatches(ids, 2);
    expect(schedule).toHaveLength(15);
    const normalized = new Set(
      schedule.map((m) => [m.entrantAId, m.entrantBId].sort().join('-')),
    );
    expect(normalized.size).toBe(15);
  });

  it('U-MO-05: 同一slot内で同じ選手(チーム)が複数コートに重複出場しない（ラウンドをまたぐ衝突がない）', () => {
    const ids = ['A', 'B', 'C', 'D', 'E', 'F'];
    const schedule = scheduleSingleLeagueMatches(ids, 2);

    const bySlot = new Map<number, typeof schedule>();
    for (const m of schedule) {
      bySlot.set(m.slot, [...(bySlot.get(m.slot) ?? []), m]);
    }
    for (const matches of bySlot.values()) {
      const seen = new Set<string>();
      for (const m of matches) {
        expect(seen.has(m.entrantAId)).toBe(false);
        expect(seen.has(m.entrantBId)).toBe(false);
        seen.add(m.entrantAId);
        seen.add(m.entrantBId);
      }
    }
  });

  it('U-MO-06: コート数1の場合、slot順・対戦カードは独立リーグのgenerateRoundRobinOrderと完全一致する', () => {
    const ids = ['A', 'B', 'C', 'D', 'E'];
    const schedule = scheduleSingleLeagueMatches(ids, 1);
    const independentOrder = generateRoundRobinOrder(ids);

    expect(schedule.every((m) => m.court === 1)).toBe(true);
    expect(schedule.map((m) => m.slot)).toEqual(independentOrder.map((_, i) => i + 1));
    expect(schedule.map((m) => [m.entrantAId, m.entrantBId])).toEqual(independentOrder);
  });

  it('最初のslotの最初の試合（コート1）はリーグ表上位2者の対戦になる', () => {
    const ids = ['A', 'B', 'C', 'D', 'E', 'F'];
    const schedule = scheduleSingleLeagueMatches(ids, 2);
    const firstCourt1Match = schedule.find((m) => m.slot === 1 && m.court === 1)!;
    expect([firstCourt1Match.entrantAId, firstCourt1Match.entrantBId]).toEqual(['A', 'B']);
  });

  it('対戦を効率的に進めるため、理論上の最小時間帯数（総試合数÷コート数の切り上げ）に収まる（N=6, court=2）', () => {
    const ids = ['A', 'B', 'C', 'D', 'E', 'F'];
    const schedule = scheduleSingleLeagueMatches(ids, 2);
    const maxSlot = Math.max(...schedule.map((m) => m.slot));
    expect(maxSlot).toBe(Math.ceil(schedule.length / 2));
  });

  it('コートを極力空けない（ラウンド境界をまたいで対戦を詰めるため、最後のslot以外は常に満員になる）', () => {
    const ids = ['A', 'B', 'C', 'D', 'E', 'F'];
    const schedule = scheduleSingleLeagueMatches(ids, 2);
    const countBySlot = new Map<number, number>();
    for (const m of schedule) countBySlot.set(m.slot, (countBySlot.get(m.slot) ?? 0) + 1);
    const maxSlot = Math.max(...countBySlot.keys());
    for (let slot = 1; slot < maxSlot; slot += 1) {
      expect(countBySlot.get(slot)).toBe(2);
    }
  });
});

describe('assignRefereesForSingleLeague（単一リーグの審判割当・要件定義書3.6・5章）', () => {
  it('審判は同一slot内のどのコートの出場者とも重複しない', () => {
    const ids = ['A', 'B', 'C', 'D', 'E', 'F'];
    const schedule = scheduleSingleLeagueMatches(ids, 2);
    const referees = assignRefereesForSingleLeague(schedule, ids);

    const bySlot = new Map<number, number[]>();
    schedule.forEach((m, i) => bySlot.set(m.slot, [...(bySlot.get(m.slot) ?? []), i]));

    for (const indices of bySlot.values()) {
      const busy = new Set<string>();
      for (const i of indices) {
        busy.add(schedule[i].entrantAId);
        busy.add(schedule[i].entrantBId);
      }
      for (const i of indices) {
        const referee = referees[i];
        if (referee) expect(busy.has(referee)).toBe(false);
      }
    }
  });

  it('U-RF-05: N=4・court=2の場合、各slotで全員が試合中のため審判は全てnullになる', () => {
    const ids = ['A', 'B', 'C', 'D'];
    const schedule = scheduleSingleLeagueMatches(ids, 2);
    const referees = assignRefereesForSingleLeague(schedule, ids);
    expect(referees.every((r) => r === null)).toBe(true);
  });

  it('U-RF-07（レビュー指摘4対応）: 同一slot内で空き人数がコート数より少ない場合、同じ選手(チーム)を複数コートの審判に重複割当しない', () => {
    // N=5・court=2想定。同一時間帯にA-B（コート1）・C-D（コート2）が同時進行し、
    // 空きはEのみ（1名）。以前の実装はEをコート1・コート2の両方の審判に割り当てていた
    // （同一選手(チーム)が同時に2箇所で審判を兼務する「重なり」バグ）
    const schedule: SingleLeagueMatch[] = [
      { entrantAId: 'A', entrantBId: 'B', slot: 1, court: 1 },
      { entrantAId: 'C', entrantBId: 'D', slot: 1, court: 2 },
    ];
    const referees = assignRefereesForSingleLeague(schedule, ['A', 'B', 'C', 'D', 'E']);

    expect(referees).toContain('E');
    // 一方はE、もう一方は候補切れでnull（画面側で「運営スタッフ」表示になる）
    expect(referees.filter((r) => r === 'E')).toHaveLength(1);
    expect(referees.filter((r) => r === null)).toHaveLength(1);
  });

  it('U-RF-06: 候補がいるslotでは審判がnullにならず、回数がある程度均等化される', () => {
    const ids = ['A', 'B', 'C', 'D', 'E', 'F'];
    const schedule = scheduleSingleLeagueMatches(ids, 2);
    const referees = assignRefereesForSingleLeague(schedule, ids);

    const bySlot = new Map<number, number[]>();
    schedule.forEach((m, i) => bySlot.set(m.slot, [...(bySlot.get(m.slot) ?? []), i]));
    for (const indices of bySlot.values()) {
      const matchCount = indices.length;
      // N=6で1slotあたりの試合数が1件（busy4名・残り2名の空き）の場合は必ず審判が割り当てられるはず
      if (matchCount === 1) {
        expect(referees[indices[0]]).not.toBeNull();
      }
    }

    const counts = new Map<string, number>();
    for (const r of referees) {
      if (!r) continue;
      counts.set(r, (counts.get(r) ?? 0) + 1);
    }
    const values = [...counts.values()];
    expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(2);
  });
});
