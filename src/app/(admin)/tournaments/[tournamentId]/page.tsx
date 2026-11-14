import { notFound } from 'next/navigation';
import { TournamentTabs } from '@/components/admin/TournamentTabs';
import { TournamentHeaderBlock } from '@/components/tournaments/TournamentHeaderBlock';
import { TournamentActionButtons } from '@/components/tournaments/TournamentActionButtons';
import { EditTournamentForm } from '@/components/tournaments/EditTournamentForm';
import {
  getAllCategorySlots,
  getEnabledCategories,
  getTournament,
  isCategoryLocked,
} from '@/lib/mock-data';
import { getSessionRole } from '@/lib/require-session';
import type { CategoryFieldState } from '@/components/tournaments/CategoryFieldsForm';

// A3. 大会情報画面（編集モード）
export default async function TournamentInfoPage({
  params,
}: {
  params: Promise<{ tournamentId: string }>;
}) {
  const { tournamentId } = await params;
  const tournament = getTournament(tournamentId);
  if (!tournament) notFound();

  const enabledCategories = getEnabledCategories(tournamentId);
  const firstCategoryId = enabledCategories[0]?.id;
  const generationCategories = enabledCategories.map((c) => ({
    id: c.id,
    key: c.key,
    name: c.name,
    courtCount: c.settings.courtCount,
    generationStatus: c.generationStatus,
  }));
  const isFinished = tournament.status === '終了';
  const participantUrl = `https://example.com/t/${tournament.id}`;
  const viewOnly = (await getSessionRole()) !== 'admin';
  const editDisabledReason = isFinished
    ? '大会が終了しているため変更できません'
    : viewOnly
      ? '閲覧モードのため変更できません'
      : undefined;

  const categoryFields: CategoryFieldState[] = getAllCategorySlots(tournamentId).map((slot) =>
    'id' in slot
      ? {
          key: slot.key,
          name: slot.name,
          enabled: slot.enabled,
          locked: isCategoryLocked(slot.id),
        }
      : { key: slot.key, name: '', enabled: false, locked: false },
  );

  return (
    <div className="flex flex-1 flex-col">
      <TournamentHeaderBlock tournament={tournament} participantUrl={participantUrl} />

      <div className="border-b bg-background px-4 py-3">
        <TournamentActionButtons
          tournamentId={tournamentId}
          status={tournament.status}
          categories={generationCategories}
          firstCategoryId={firstCategoryId}
          viewOnly={viewOnly}
        />
      </div>

      <TournamentTabs
        tournamentId={tournamentId}
        active="info"
        defaultCategoryId={firstCategoryId}
      />

      <EditTournamentForm
        tournament={tournament}
        categories={categoryFields}
        disabled={isFinished || viewOnly}
        disabledReason={editDisabledReason}
      />
    </div>
  );
}
