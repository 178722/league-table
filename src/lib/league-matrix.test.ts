import { describe, expect, it } from 'vitest';
import { buildMatrixCell } from '@/lib/league-matrix';
import type { Match } from '@/types/domain';

function match(entrantAId: string, entrantBId: string, sets: Array<[number | null, number | null]>, status: Match['status'] = '入力済み'): Match {
  return {
    id: 'm1',
    categoryId: 'cat',
    courtNumber: 1,
    order: 1,
    entrantAId,
    entrantBId,
    refereeEntrantId: null,
    sets: sets.map(([scoreA, scoreB]) => ({ scoreA, scoreB })),
    status,
  };
}

describe('buildMatrixCell（A6・P1共通のリーグ表マス目・要件定義書3.7表記準拠）', () => {
  it('未対戦（対象の組合せの試合が存在しない）場合はnullを返す', () => {
    const cell = buildMatrixCell([], 'A', 'B');
    expect(cell).toBeNull();
  });

  it('U-MR-03: 点数が多い方が勝ち（◯）、少ない方は負け（●）として行視点のマークを算出する', () => {
    const matches = [match('A', 'B', [[25, 20], [25, 18]])];
    const fromA = buildMatrixCell(matches, 'A', 'B')!;
    const fromB = buildMatrixCell(matches, 'B', 'A')!;
    expect(fromA.mark).toBe('◯');
    expect(fromB.mark).toBe('●');
  });

  it('U-MR-04: 勝ちセット数が同数の場合は両者とも引分（ー）', () => {
    const matches = [match('A', 'B', [[25, 20], [20, 25]])];
    const fromA = buildMatrixCell(matches, 'A', 'B')!;
    const fromB = buildMatrixCell(matches, 'B', 'A')!;
    expect(fromA.mark).toBe('ー');
    expect(fromB.mark).toBe('ー');
  });

  it('セットごとの得点は行視点の「自分-相手」の順で文字列化される', () => {
    const matches = [match('A', 'B', [[25, 20], [18, 25]])];
    const fromA = buildMatrixCell(matches, 'A', 'B')!;
    const fromB = buildMatrixCell(matches, 'B', 'A')!;
    expect(fromA.setLines).toEqual(['25-20', '18-25']);
    expect(fromB.setLines).toEqual(['20-25', '25-18']);
  });

  it('未入力セットは setLines で "-" になる（セット数5設定で2セットのみ入力済み）', () => {
    const matches = [match('A', 'B', [[25, 20], [25, 18], [null, null], [null, null], [null, null]])];
    const cell = buildMatrixCell(matches, 'A', 'B')!;
    expect(cell.setLines).toEqual(['25-20', '25-18', '-', '-', '-']);
  });

  it('取得セット数の要約（summary）は行視点の「自分-相手」のセットカウント', () => {
    const matches = [match('A', 'B', [[25, 20], [20, 25], [15, 10]])];
    const fromA = buildMatrixCell(matches, 'A', 'B')!;
    const fromB = buildMatrixCell(matches, 'B', 'A')!;
    expect(fromA.summary).toBe('2-1');
    expect(fromB.summary).toBe('1-2');
  });

  it('1セットも入力されていない（未入力）試合はmarkが空文字でsummaryがundefined', () => {
    const matches = [match('A', 'B', [[null, null], [null, null]], '未入力')];
    const cell = buildMatrixCell(matches, 'A', 'B')!;
    expect(cell.mark).toBe('');
    expect(cell.summary).toBeUndefined();
  });
});
