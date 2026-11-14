import { BackBar } from '@/components/admin/BackBar';
import { BackupPanel } from '@/components/backup/BackupPanel';
import { getBackups } from '@/lib/mock-data';
import { getSessionRole } from '@/lib/require-session';

// A8. バックアップ・リストア画面
export default async function BackupPage() {
  const viewOnly = (await getSessionRole()) !== 'admin';

  return (
    <div className="flex flex-1 flex-col">
      <BackBar
        backHref="/tournaments"
        backLabel="大会一覧"
        title="バックアップ・リストア"
        stacked
      />
      <BackupPanel initialBackups={getBackups()} disabled={viewOnly} />
    </div>
  );
}
