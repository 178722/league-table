'use client';

import { useRouter } from 'next/navigation';
import { TableCell, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { ConfirmActionButton } from '@/components/admin/ConfirmActionButton';
import { formatDate } from '@/lib/format';
import type { Tournament } from '@/types/domain';

interface TournamentListRowProps {
  tournament: Tournament;
  categoryCount: number;
  viewOnly?: boolean;
}

// A2の一覧行。ステータスに関わらずA3（大会情報画面）へ遷移する（終了の場合は閲覧専用表示）
export function TournamentListRow({ tournament, categoryCount, viewOnly }: TournamentListRowProps) {
  const router = useRouter();

  const href = `/tournaments/${tournament.id}`;

  return (
    <TableRow className="cursor-pointer" onClick={() => router.push(href)}>
      <TableCell className="font-medium">{tournament.name}</TableCell>
      <TableCell>{formatDate(tournament.date)}</TableCell>
      <TableCell>{tournament.location}</TableCell>
      <TableCell>{categoryCount}</TableCell>
      <TableCell>
        <StatusBadge status={tournament.status} />
      </TableCell>
      <TableCell onClick={(e) => e.stopPropagation()}>
        <ConfirmActionButton
          label="削除"
          variant="destructive"
          dialogTitle="この大会を削除しますか？"
          dialogDescription="この大会を削除すると、紐づく競技情報・選手(チーム)情報・試合・試合結果がすべて削除されます。元に戻せません。削除しますか？"
          confirmLabel="削除する"
          disabled={viewOnly}
          onConfirm={async () => {
            await fetch(`/api/tournaments/${tournament.id}`, { method: 'DELETE' });
          }}
          refreshInstead
        />
      </TableCell>
    </TableRow>
  );
}
