'use client';

import { useState } from 'react';
import { cn } from 'cn';
import { LeagueMatrixTable, type MatrixEntrant } from '@/components/shared/LeagueMatrixTable';
import type { Match, RankingMethod, StandingRow } from '@/types/domain';

export interface PublicCourtView {
  entrants: MatrixEntrant[];
  matches: Match[];
  standings: StandingRow[];
}

export interface PublicCategoryView {
  id: string;
  key: string;
  name: string;
  rankingMethod: RankingMethod;
  courts: PublicCourtView[];
}

// P1. 大会結果閲覧画面（ログイン不要・閲覧専用）。カテゴリ/コートの切替は画面内の状態のみで行う
export function PublicTournamentView({ categories }: { categories: PublicCategoryView[] }) {
  const [categoryIndex, setCategoryIndex] = useState(0);
  const [courtIndex, setCourtIndex] = useState(0);

  const category = categories[categoryIndex];
  const court = category?.courts[courtIndex];

  if (!category || !court) {
    return <p className="p-4 text-sm text-muted-foreground">表示できるカテゴリがありません。</p>;
  }

  return (
    <div className="flex flex-1 flex-col">
      <nav className="flex gap-1 border-b bg-muted/30 px-4">
        {categories.map((c, i) => (
          <button
            key={c.id}
            onClick={() => {
              setCategoryIndex(i);
              setCourtIndex(0);
            }}
            className={cn(
              'rounded-t-md px-3 py-1.5 text-sm font-medium transition-colors',
              i === categoryIndex
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground',
            )}
          >
            カテゴリ{c.key}：{c.name}
          </button>
        ))}
      </nav>

      {category.courts.length > 1 && (
        <nav className="flex gap-1 border-b bg-muted/10 px-4">
          {category.courts.map((_, i) => (
            <button
              key={i}
              onClick={() => setCourtIndex(i)}
              className={cn(
                'rounded-t-md px-3 py-1.5 text-sm font-medium transition-colors',
                i === courtIndex
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground',
              )}
            >
              コート{i + 1}
            </button>
          ))}
        </nav>
      )}

      <div className="p-4">
        <h2 className="mb-2 text-sm font-semibold">リーグ表・勝敗表（順位表）</h2>
        <LeagueMatrixTable
          entrants={court.entrants}
          matches={court.matches}
          standings={court.standings}
          rankingMethod={category.rankingMethod}
        />
      </div>
    </div>
  );
}
