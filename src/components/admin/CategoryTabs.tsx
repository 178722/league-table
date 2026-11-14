import Link from 'next/link';
import { cn } from 'cn';
import type { Category } from '@/types/domain';

interface CategoryTabsProps {
  tournamentId: string;
  categories: Category[];
  activeCategoryId: string;
  screen: 'settings' | 'matches';
}

// A4・A6で使うカテゴリタブ（共通タブの下に表示）
export function CategoryTabs({
  tournamentId,
  categories,
  activeCategoryId,
  screen,
}: CategoryTabsProps) {
  if (categories.length === 0) return null;

  return (
    <nav className="flex gap-1 border-b bg-muted/30 px-4">
      {categories.map((category) => (
        <Link
          key={category.id}
          href={`/tournaments/${tournamentId}/categories/${category.id}/${screen}`}
          className={cn(
            'rounded-t-md px-3 py-1.5 text-sm font-medium transition-colors',
            category.id === activeCategoryId
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          カテゴリ{category.key}：{category.name}
        </Link>
      ))}
    </nav>
  );
}
