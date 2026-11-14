import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { TournamentsListTable } from '@/components/tournaments/TournamentsListTable';
import { getEnabledCategories, getTournaments } from '@/lib/mock-data';
import { getSessionRole } from '@/lib/require-session';

// A2. 大会一覧画面
export default async function TournamentsPage() {
  const tournaments = getTournaments().map((tournament) => ({
    ...tournament,
    categoryCount: getEnabledCategories(tournament.id).length,
  }));
  const viewOnly = (await getSessionRole()) !== 'admin';

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">大会一覧</h1>
        {viewOnly ? (
          <Button disabled>+ 新規作成</Button>
        ) : (
          <Button asChild>
            <Link href="/tournaments/new">+ 新規作成</Link>
          </Button>
        )}
      </div>

      {tournaments.length === 0 ? (
        <p className="text-sm text-muted-foreground">登録済みの大会はありません。</p>
      ) : (
        <TournamentsListTable tournaments={tournaments} viewOnly={viewOnly} />
      )}
    </div>
  );
}
