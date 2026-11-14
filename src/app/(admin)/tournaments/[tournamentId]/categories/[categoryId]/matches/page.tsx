import { notFound } from 'next/navigation';
import Link from 'next/link';
import { TournamentHeaderBlock } from '@/components/tournaments/TournamentHeaderBlock';
import { TournamentTabs } from '@/components/admin/TournamentTabs';
import { CategoryTabs } from '@/components/admin/CategoryTabs';
import { CourtTabs } from '@/components/admin/CourtTabs';
import { JankenResolutionForm } from '@/components/matches/JankenResolutionForm';
import { MatchesBoard } from '@/components/matches/MatchesBoard';
import {
  getCategory,
  getCategoryMatches,
  getEnabledCategories,
  getEntrantName,
  getEntrants,
  getMatches,
  getStandings,
  getTournament,
  sortByDisplayOrder,
} from '@/lib/mock-data';
import { getSessionRole } from '@/lib/require-session';

// A6. 試合・順位表画面
export default async function MatchesPage({
  params,
  searchParams,
}: {
  params: Promise<{ tournamentId: string; categoryId: string }>;
  searchParams: Promise<{ court?: string }>;
}) {
  const { tournamentId, categoryId } = await params;
  const { court } = await searchParams;
  const tournament = getTournament(tournamentId);
  const category = getCategory(categoryId);
  if (!tournament || !category || category.tournamentId !== tournamentId) notFound();

  const enabledCategories = getEnabledCategories(tournamentId);
  const activeCourt = Number(court ?? '1') || 1;
  const isFinished = tournament.status === '終了';
  const viewOnly = (await getSessionRole()) !== 'admin';
  const entrants = getEntrants(tournamentId, category.id);
  const isSingleLeague = category.settings.leagueFormat === '単一リーグ';

  const matches = isSingleLeague
    ? getCategoryMatches(category.id, category.settings.courtCount)
    : getMatches(category.id, activeCourt);
  const standings = isSingleLeague
    ? getStandings(category.id, 0)
    : getStandings(category.id, activeCourt);
  const courtEntrants = sortByDisplayOrder(
    isSingleLeague || category.settings.courtCount < 2
      ? entrants
      : entrants.filter((e) => e.courtNumber === activeCourt),
  );
  const participantUrl = `https://example.com/t/${tournament.id}`;
  const tiedEntries = standings
    .filter((row) => row.isTie && row.jankenPending)
    .map((row) => ({
      entrantId: row.entrantId,
      entrantName: getEntrantName(row.entrantId),
      defaultRank: row.rank,
    }));

  return (
    <div className="flex flex-1 flex-col">
      <TournamentHeaderBlock tournament={tournament} participantUrl={participantUrl} />
      <TournamentTabs tournamentId={tournamentId} defaultCategoryId={category.id} />
      <CategoryTabs
        tournamentId={tournamentId}
        categories={enabledCategories}
        activeCategoryId={category.id}
        screen="matches"
      />
      {!isSingleLeague && (
        <CourtTabs
          tournamentId={tournamentId}
          categoryId={category.id}
          courtCount={category.settings.courtCount}
          activeCourt={activeCourt}
        />
      )}

      {category.generationStatus === '未生成' ? (
        <div className="flex flex-col gap-3 p-4">
          <p className="text-sm text-muted-foreground">
            まだリーグ表が生成されていません。大会情報画面の「リーグ表を作成する」から生成してください。
          </p>
          <Link
            href={`/tournaments/${tournamentId}`}
            className="text-sm text-primary hover:underline"
          >
            ← 大会情報画面へ戻る
          </Link>
        </div>
      ) : (
        <>
          <MatchesBoard
            tournamentId={tournamentId}
            categoryId={category.id}
            entrants={courtEntrants.map((e) => ({
              id: e.id,
              name: e.name,
              affiliation: e.affiliation,
            }))}
            matches={matches}
            standings={standings}
            rankingMethod={category.settings.rankingMethod}
            disabled={isFinished || viewOnly}
            splitByCourt={isSingleLeague}
          />

          {!isFinished && tiedEntries.length > 0 && (
            <JankenResolutionForm
              tournamentId={tournamentId}
              categoryId={category.id}
              court={isSingleLeague ? 0 : activeCourt}
              entries={tiedEntries}
              disabled={isFinished || viewOnly}
            />
          )}
        </>
      )}
    </div>
  );
}
