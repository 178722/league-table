import Link from 'next/link';
import { cn } from 'cn';

interface CourtTabsProps {
  tournamentId: string;
  categoryId: string;
  courtCount: number;
  activeCourt: number;
}

// A6のコートタブ（競技情報のコート数が2以上の場合のみ表示）
export function CourtTabs({ tournamentId, categoryId, courtCount, activeCourt }: CourtTabsProps) {
  if (courtCount < 2) return null;

  const courts = Array.from({ length: courtCount }, (_, i) => i + 1);

  return (
    <nav className="flex items-center gap-1 border-b bg-muted/10 px-4">
      {courts.map((court) => (
        <Link
          key={court}
          href={`/tournaments/${tournamentId}/categories/${categoryId}/matches?court=${court}`}
          className={cn(
            'rounded-t-md px-3 py-1.5 text-sm font-medium transition-colors',
            court === activeCourt
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          コート{court}
        </Link>
      ))}
    </nav>
  );
}
