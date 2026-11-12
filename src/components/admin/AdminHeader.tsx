'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { LogoutButton } from '@/components/admin/LogoutButton';

// 将来対応として一旦保留：データ出力ボタン（共通ヘッダー）
// 大会単位の画面（/tournaments/:id 配下、ただし/newを除く）かどうかを判定し、
// その場合のみヘッダーに「データ出力」ボタンを表示する
// function useCurrentTournamentId(): string | undefined {
//   const pathname = usePathname();
//   const match = pathname.match(/^\/tournaments\/([^/]+)/);
//   if (!match || match[1] === 'new') return undefined;
//   return match[1];
// }

interface AdminHeaderProps {
  /** 閲覧モード（ID・パスワードなしのセッション）かどうか */
  viewOnly?: boolean;
}

// 全管理者画面（A2〜A8）共通のヘッダー
export function AdminHeader({ viewOnly }: AdminHeaderProps) {
  // const tournamentId = useCurrentTournamentId(); // 将来対応として一旦保留

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b bg-background px-4">
      <div className="flex items-center gap-2">
        <Link href="/tournaments" className="font-semibold">
          リーグ戦しようよ
        </Link>
        {viewOnly && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            閲覧モード
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {/* 将来対応として一旦保留：データ出力ボタン（共通ヘッダー）
        {tournamentId && (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/tournaments/${tournamentId}/export`}>データ出力</Link>
          </Button>
        )}
        */}
        <Button variant="outline" size="sm" asChild>
          <Link href="/settings/backup">バックアップ</Link>
        </Button>
        <LogoutButton viewOnly={viewOnly} />
      </div>
    </header>
  );
}
