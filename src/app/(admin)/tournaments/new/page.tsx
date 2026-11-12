import { NewTournamentForm } from '@/components/tournaments/NewTournamentForm';
import { getSessionRole } from '@/lib/require-session';

// A3. 大会情報画面（新規作成）
export default async function NewTournamentPage() {
  const viewOnly = (await getSessionRole()) !== 'admin';

  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b bg-background px-4 py-3">
        <h1 className="text-lg font-semibold">大会情報登録</h1>
      </div>
      <NewTournamentForm disabled={viewOnly} />
    </div>
  );
}
