import { notFound } from 'next/navigation';
import { TournamentHeaderBlock } from '@/components/tournaments/TournamentHeaderBlock';
import { TournamentActionButtons } from '@/components/tournaments/TournamentActionButtons';
import { TournamentTabs } from '@/components/admin/TournamentTabs';
import { PlayersList } from '@/components/players/PlayersList';
import { getEnabledCategories, getEntrants, getTournament } from '@/lib/mock-data';
import { getSessionRole } from '@/lib/require-session';

// A5. 選手(チーム)情報画面
export default async function PlayersPage({
  params,
}: {
  params: Promise<{ tournamentId: string }>;
}) {
  const { tournamentId } = await params;
  const tournament = getTournament(tournamentId);
  if (!tournament) notFound();

  const categories = getEnabledCategories(tournamentId);
  const entrants = getEntrants(tournamentId);
  const isFinished = tournament.status === '終了';
  const viewOnly = (await getSessionRole()) !== 'admin';
  const disabledReason = isFinished
    ? '大会が終了しているため変更できません'
    : viewOnly
      ? '閲覧モードのため変更できません'
      : undefined;
  const participantUrl = `https://example.com/t/${tournament.id}`;
  const generationCategories = categories.map((c) => ({
    id: c.id,
    key: c.key,
    name: c.name,
    courtCount: c.settings.courtCount,
    generationStatus: c.generationStatus,
  }));

  return (
    <div className="flex flex-1 flex-col">
      <TournamentHeaderBlock tournament={tournament} participantUrl={participantUrl} />
      <div className="border-b bg-background px-4 py-3">
        <TournamentActionButtons
          tournamentId={tournamentId}
          status={tournament.status}
          categories={generationCategories}
          firstCategoryId={categories[0]?.id}
          viewOnly={viewOnly}
        />
      </div>
      <TournamentTabs
        tournamentId={tournamentId}
        active="players"
        defaultCategoryId={categories[0]?.id}
      />
      <PlayersList
        tournamentId={tournamentId}
        categories={categories}
        initialEntrants={entrants}
        disabled={isFinished || viewOnly}
        disabledReason={disabledReason}
      />
    </div>
  );
}
