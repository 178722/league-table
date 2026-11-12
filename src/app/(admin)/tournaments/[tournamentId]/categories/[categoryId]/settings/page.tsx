import { notFound } from 'next/navigation';
import { TournamentHeaderBlock } from '@/components/tournaments/TournamentHeaderBlock';
import { TournamentActionButtons } from '@/components/tournaments/TournamentActionButtons';
import { TournamentTabs } from '@/components/admin/TournamentTabs';
import { CategoryTabs } from '@/components/admin/CategoryTabs';
import { CategorySettingsForm } from '@/components/categories/CategorySettingsForm';
import { getCategory, getEnabledCategories, getMatches, getTournament } from '@/lib/mock-data';
import { getSessionRole } from '@/lib/require-session';

// A4. 競技情報登録・編集画面
export default async function CategorySettingsPage({
  params,
}: {
  params: Promise<{ tournamentId: string; categoryId: string }>;
}) {
  const { tournamentId, categoryId } = await params;
  const tournament = getTournament(tournamentId);
  const category = getCategory(categoryId);
  if (!tournament || !category || category.tournamentId !== tournamentId) notFound();

  const enabledCategories = getEnabledCategories(tournamentId);
  const hasMatchResults = Array.from({ length: category.settings.courtCount }, (_, i) => i + 1)
    .flatMap((court) => getMatches(category.id, court))
    .some((m) => m.status === '入力済み');

  const isFinished = tournament.status === '終了';
  const viewOnly = (await getSessionRole()) !== 'admin';
  const disabled = isFinished || hasMatchResults || viewOnly;
  const disabledReason = isFinished
    ? '大会が終了しているため変更できません'
    : hasMatchResults
      ? '試合結果が登録されているため変更できません'
      : viewOnly
        ? '閲覧モードのため変更できません'
        : undefined;

  const participantUrl = `https://example.com/t/${tournament.id}`;
  const generationCategories = enabledCategories.map((c) => ({
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
          firstCategoryId={enabledCategories[0]?.id}
          viewOnly={viewOnly}
        />
      </div>
      <TournamentTabs
        tournamentId={tournamentId}
        active="settings"
        defaultCategoryId={category.id}
      />
      <CategoryTabs
        tournamentId={tournamentId}
        categories={enabledCategories}
        activeCategoryId={category.id}
        screen="settings"
      />
      <CategorySettingsForm
        tournamentId={tournamentId}
        categoryId={category.id}
        settings={category.settings}
        disabled={disabled}
        disabledReason={disabledReason}
      />
    </div>
  );
}
