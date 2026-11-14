'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LeagueMatrixTable, type MatrixEntrant } from '@/components/shared/LeagueMatrixTable';
import { MatchOrderBoard } from '@/components/matches/MatchOrderBoard';
import { ResultInputDialog } from '@/components/matches/ResultInputDialog';
import type { Match, RankingMethod, StandingRow } from '@/types/domain';

interface MatchesBoardProps {
  tournamentId: string;
  categoryId: string;
  entrants: MatrixEntrant[];
  matches: Match[];
  standings: StandingRow[];
  rankingMethod: RankingMethod;
  disabled: boolean;
  /** 単一リーグの場合、コート毎に別の表に分けて試合順を表示する */
  splitByCourt?: boolean;
}

// A6：上=リーグ表・勝敗表（マス目）、下=試合順表。どちらをクリックしても同じ結果入力ダイアログを開く
export function MatchesBoard({
  tournamentId,
  categoryId,
  entrants,
  matches,
  standings,
  rankingMethod,
  disabled,
  splitByCourt,
}: MatchesBoardProps) {
  const router = useRouter();
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);

  // 結果入力ダイアログ・試合順表ともに所属を表示しない名前のみ表記
  const entrantNames = new Map(entrants.map((e) => [e.id, e.name]));
  const selectedMatch = matches.find((m) => m.id === selectedMatchId);

  const deleteResult = async (matchId: string) => {
    const match = matches.find((m) => m.id === matchId);
    if (!match) return;
    await fetch(`/api/tournaments/${tournamentId}/categories/${categoryId}/matches/${matchId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sets: match.sets.map(() => ({ scoreA: null, scoreB: null })),
      }),
    });
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="mb-2 px-4 text-sm font-semibold">リーグ表・勝敗表（順位表）</h2>
        <div className="px-4">
          <LeagueMatrixTable
            entrants={entrants}
            matches={matches}
            standings={standings}
            rankingMethod={rankingMethod}
            onCellClick={disabled ? undefined : setSelectedMatchId}
          />
        </div>
      </div>

      <div className="border-t p-4">
        <h2 className="mb-2 text-sm font-semibold">試合順</h2>
        <MatchOrderBoard
          matches={matches}
          entrantLabels={entrantNames}
          onRowClick={setSelectedMatchId}
          onDeleteResult={deleteResult}
          disabled={disabled}
          splitByCourt={splitByCourt}
        />
      </div>

      {selectedMatch && (
        <ResultInputDialog
          key={selectedMatch.id}
          open={Boolean(selectedMatch)}
          onOpenChange={(open) => !open && setSelectedMatchId(null)}
          tournamentId={tournamentId}
          categoryId={categoryId}
          matchId={selectedMatch.id}
          entrantAName={entrantNames.get(selectedMatch.entrantAId) ?? ''}
          entrantBName={entrantNames.get(selectedMatch.entrantBId) ?? ''}
          initialSets={selectedMatch.sets}
          disabled={disabled}
        />
      )}
    </div>
  );
}
