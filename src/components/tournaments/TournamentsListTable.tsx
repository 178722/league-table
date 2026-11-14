'use client';

import { useMemo, useState } from 'react';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TournamentListRow } from '@/components/tournaments/TournamentListRow';
import type { Tournament } from '@/types/domain';

type SortKey = 'name' | 'date' | 'location' | 'categoryCount' | 'status';
type SortDirection = 'asc' | 'desc';

interface TournamentWithCategoryCount extends Tournament {
  categoryCount: number;
}

interface TournamentsListTableProps {
  tournaments: TournamentWithCategoryCount[];
  viewOnly?: boolean;
}

// A2. 大会一覧の表題クリックでの並べ替え。デフォルトは開催日の新しい順（降順）
export function TournamentsListTable({ tournaments, viewOnly }: TournamentsListTableProps) {
  const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection }>({
    key: 'date',
    direction: 'desc',
  });

  const toggleSort = (key: SortKey) => {
    setSort((prev) => {
      if (prev.key !== key) return { key, direction: 'asc' };
      return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
    });
  };

  const sortValue = (tournament: TournamentWithCategoryCount, key: SortKey): string | number => {
    switch (key) {
      case 'name':
        return tournament.name;
      case 'date':
        return tournament.date;
      case 'location':
        return tournament.location;
      case 'categoryCount':
        return tournament.categoryCount;
      case 'status':
        return tournament.status;
    }
  };

  const sorted = useMemo(() => {
    return [...tournaments].sort((a, b) => {
      const va = sortValue(a, sort.key);
      const vb = sortValue(b, sort.key);
      const cmp =
        typeof va === 'number' && typeof vb === 'number'
          ? va - vb
          : String(va).localeCompare(String(vb), 'ja');
      return sort.direction === 'asc' ? cmp : -cmp;
    });
  }, [tournaments, sort]);

  const renderSortableHead = (key: SortKey, label: string) => (
    <TableHead
      onClick={() => toggleSort(key)}
      className="cursor-pointer select-none hover:bg-muted/50"
    >
      {label}
      {sort.key === key && (
        <span className="ml-1 text-xs">{sort.direction === 'asc' ? '▲' : '▼'}</span>
      )}
    </TableHead>
  );

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {renderSortableHead('name', '大会名')}
          {renderSortableHead('date', '開催日')}
          {renderSortableHead('location', '開催場所')}
          {renderSortableHead('categoryCount', 'カテゴリ数')}
          {renderSortableHead('status', 'ステータス')}
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((tournament) => (
          <TournamentListRow
            key={tournament.id}
            tournament={tournament}
            categoryCount={tournament.categoryCount}
            viewOnly={viewOnly}
          />
        ))}
      </TableBody>
    </Table>
  );
}
