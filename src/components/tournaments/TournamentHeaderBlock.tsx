import Link from 'next/link';
import { StatusBadge } from '@/components/admin/StatusBadge';
// 将来対応として一旦保留：参加者向け閲覧URL表示（CopyUrlButton）
// import { CopyUrlButton } from '@/components/tournaments/CopyUrlButton';
import { formatDate } from '@/lib/format';
import type { Tournament } from '@/types/domain';

interface TournamentHeaderBlockProps {
  tournament: Tournament;
  /** 将来対応として一旦保留中の参加者向け閲覧URL表示のために受け取るが、現在は描画しない */
  participantUrl: string;
}

// A3・A4・A5共通：大会名（改行表示・大きめの装飾）・ステータス・参加者向け閲覧URL
export function TournamentHeaderBlock({ tournament }: TournamentHeaderBlockProps) {
  return (
    <div className="border-b bg-background px-4 py-4">
      <Link href="/tournaments" className="text-sm text-muted-foreground hover:underline">
        ← 大会一覧
      </Link>
      <div className="mt-1 flex flex-col">
        <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
          {tournament.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          {formatDate(tournament.date)}・{tournament.location}
        </p>
      </div>
      <div className="mt-2">
        <StatusBadge status={tournament.status} />
      </div>
      {/* 将来対応として一旦保留：参加者向け閲覧URL表示
      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>参加者向けURL: {participantUrl}</span>
        <CopyUrlButton url={participantUrl} />
      </div>
      */}
    </div>
  );
}
