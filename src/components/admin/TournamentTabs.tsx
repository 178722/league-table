import Link from 'next/link';
import { cn } from 'cn';

export type TournamentTabKey = 'info' | 'settings' | 'players';

interface TournamentTabsProps {
  tournamentId: string;
  /** A6（試合・順位表）はこのタブに含まれないため、どのタブもアクティブにしない場合はundefinedを渡す */
  active?: TournamentTabKey;
  /** 競技情報タブの遷移先に使う代表カテゴリID（通常はカテゴリAなど先頭の有効カテゴリ） */
  defaultCategoryId?: string;
}

// A3・A4・A5・A6共通のタブ（大会情報 / 競技情報 / 選手(チーム)）
// 試合・順位表（A6）とデータ出力（A7）はこのタブに含めない（A6は「大会開催」ボタン等から、A7はヘッダーから遷移する）
export function TournamentTabs({ tournamentId, active, defaultCategoryId }: TournamentTabsProps) {
  const tabs: Array<{ key: TournamentTabKey; label: string; href: string }> = [
    { key: 'info', label: '大会情報', href: `/tournaments/${tournamentId}` },
    {
      key: 'settings',
      label: '競技情報',
      href: defaultCategoryId
        ? `/tournaments/${tournamentId}/categories/${defaultCategoryId}/settings`
        : '#',
    },
    { key: 'players', label: '選手(チーム)', href: `/tournaments/${tournamentId}/players` },
  ];

  return (
    <nav className="flex gap-1 border-b bg-background px-4">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-disabled={tab.href === '#'}
          className={cn(
            'border-b-2 px-3 py-2 text-sm font-medium transition-colors',
            tab.key === active
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground',
            tab.href === '#' && 'pointer-events-none opacity-50',
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
