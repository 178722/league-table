import { notFound } from 'next/navigation';
import { BackBar } from '@/components/admin/BackBar';
import { ExportPanel } from '@/components/export/ExportPanel';
import { getTournament } from '@/lib/mock-data';

// A7. データ出力画面
export default async function ExportPage({
  params,
}: {
  params: Promise<{ tournamentId: string }>;
}) {
  const { tournamentId } = await params;
  const tournament = getTournament(tournamentId);
  if (!tournament) notFound();

  return (
    <div className="flex flex-1 flex-col">
      <BackBar
        backHref={`/tournaments/${tournamentId}`}
        backLabel={tournament.name}
        title="データ出力"
        stacked
      />
      <ExportPanel tournamentId={tournamentId} />
    </div>
  );
}
