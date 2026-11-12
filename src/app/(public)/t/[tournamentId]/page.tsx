import { notFound } from 'next/navigation';
import {
  PublicTournamentView,
  type PublicCategoryView,
} from '@/components/public/PublicTournamentView';
import {
  getCategoryMatches,
  getEnabledCategories,
  getEntrants,
  getMatches,
  getStandings,
  getTournament,
  sortByDisplayOrder,
} from '@/lib/mock-data';
import { formatDate } from '@/lib/format';

// P1. 大会結果閲覧画面（参加者向け・ログイン不要）
export default async function PublicTournamentPage({
  params,
}: {
  params: Promise<{ tournamentId: string }>;
}) {
  const { tournamentId } = await params;
  const tournament = getTournament(tournamentId);
  if (!tournament) notFound();

  const categories: PublicCategoryView[] = getEnabledCategories(tournamentId).map((category) => {
    const categoryEntrants = getEntrants(tournamentId, category.id);
    const isSingleLeague = category.settings.leagueFormat === '単一リーグ';

    const courts = isSingleLeague
      ? [
          {
            entrants: sortByDisplayOrder(categoryEntrants).map((e) => ({
              id: e.id,
              name: e.name,
              affiliation: e.affiliation,
            })),
            matches: getCategoryMatches(category.id, category.settings.courtCount),
            standings: getStandings(category.id, 0),
          },
        ]
      : Array.from({ length: category.settings.courtCount }, (_, i) => i + 1).map(
          (courtNumber) => {
            const courtEntrants = sortByDisplayOrder(
              category.settings.courtCount < 2
                ? categoryEntrants
                : categoryEntrants.filter((e) => e.courtNumber === courtNumber),
            );
            return {
              entrants: courtEntrants.map((e) => ({
                id: e.id,
                name: e.name,
                affiliation: e.affiliation,
              })),
              matches: getMatches(category.id, courtNumber),
              standings: getStandings(category.id, courtNumber),
            };
          },
        );

    return {
      id: category.id,
      key: category.key,
      name: category.name,
      rankingMethod: category.settings.rankingMethod,
      courts,
    };
  });

  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b bg-background px-4 py-3">
        <h1 className="text-base font-semibold">
          {tournament.name}（{formatDate(tournament.date)}・{tournament.location}）
        </h1>
      </div>
      <PublicTournamentView categories={categories} />
    </div>
  );
}
