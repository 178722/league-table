'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { BlockedTooltip } from '@/components/admin/BlockedTooltip';
import { PlayerFormDialog, type EntrantInput } from '@/components/players/PlayerFormDialog';
import { CATEGORY_SELECT_WIDTH_CHARS } from '@/lib/format';
import type { Category, Entrant } from '@/types/domain';

type SortKey = 'name' | 'affiliation' | 'category' | 'courtSelection' | 'courtNumber';
type SortDirection = 'asc' | 'desc';

interface PlayersListProps {
  tournamentId: string;
  categories: Category[];
  initialEntrants: Entrant[];
  disabled: boolean;
  disabledReason?: string;
}

function entrantFieldsEqual(a: Entrant, b: Entrant): boolean {
  return (
    a.categoryId === b.categoryId &&
    a.name === b.name &&
    (a.affiliation ?? '') === (b.affiliation ?? '') &&
    a.courtSelection === b.courtSelection &&
    a.courtNumber === b.courtNumber
  );
}

function toInput(e: Entrant): EntrantInput {
  return {
    categoryId: e.categoryId,
    name: e.name,
    affiliation: e.affiliation,
    courtSelection: e.courtSelection,
    courtNumber: e.courtNumber,
  };
}

// A5. 選手(チーム)情報画面の一覧。追加・編集・削除はこの画面の中で下書きとして保持し、
// 「保存」ボタンを押した時点でまとめてAPIへ反映する（大会情報タブ(A3)と同様の保存パターン）
export function PlayersList({
  tournamentId,
  categories,
  initialEntrants,
  disabled,
  disabledReason,
}: PlayersListProps) {
  const router = useRouter();
  const [entrants, setEntrants] = useState(initialEntrants);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveErrors, setSaveErrors] = useState<string[]>([]);
  const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection } | null>(null);

  const initialById = new Map(initialEntrants.map((e) => [e.id, e]));
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const filtered = filter === 'all' ? entrants : entrants.filter((e) => e.categoryId === filter);

  const toggleSort = (key: SortKey) => {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, direction: 'asc' };
      if (prev.direction === 'asc') return { key, direction: 'desc' };
      return null;
    });
  };

  const sortValue = (entrant: Entrant, key: SortKey): string | number => {
    switch (key) {
      case 'name':
        return entrant.name;
      case 'affiliation':
        return entrant.affiliation ?? '';
      case 'category': {
        const category = categoryById.get(entrant.categoryId);
        return category ? `カテゴリ${category.key}：${category.name}` : '';
      }
      case 'courtSelection':
        return entrant.courtSelection ?? '';
      case 'courtNumber':
        return entrant.courtSelection === '手動' ? (entrant.courtNumber ?? 0) : -1;
    }
  };

  const sorted = sort
    ? [...filtered].sort((a, b) => {
        const va = sortValue(a, sort.key);
        const vb = sortValue(b, sort.key);
        const cmp =
          typeof va === 'number' && typeof vb === 'number'
            ? va - vb
            : String(va).localeCompare(String(vb), 'ja');
        return sort.direction === 'asc' ? cmp : -cmp;
      })
    : filtered;

  const add = (input: EntrantInput) => {
    setEntrants((prev) => [
      ...prev,
      {
        id: `tmp-${crypto.randomUUID()}`,
        tournamentId,
        hasResult: false,
        ...input,
      },
    ]);
  };

  const edit = (id: string, input: EntrantInput) => {
    setEntrants((prev) => prev.map((e) => (e.id === id ? { ...e, ...input } : e)));
  };

  const remove = (id: string) => {
    setEntrants((prev) => prev.filter((e) => e.id !== id));
    if (!id.startsWith('tmp-')) setDeletedIds((prev) => [...prev, id]);
  };

  const save = async () => {
    setSaving(true);
    setSaveErrors([]);
    try {
      for (const id of deletedIds) {
        await fetch(`/api/tournaments/${tournamentId}/entrants/${id}`, { method: 'DELETE' });
      }

      const nextEntrants: Entrant[] = [];
      const errors: string[] = [];
      for (const entrant of entrants) {
        const original = initialById.get(entrant.id);
        if (entrant.id.startsWith('tmp-')) {
          const res = await fetch(`/api/tournaments/${tournamentId}/entrants`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(toInput(entrant)),
          });
          const body = await res.json();
          if (res.ok) {
            nextEntrants.push(body.data);
          } else {
            errors.push(`${entrant.name}：${body.error?.message ?? '保存に失敗しました'}`);
            nextEntrants.push(entrant);
          }
        } else if (!original || !entrantFieldsEqual(original, entrant)) {
          const res = await fetch(`/api/tournaments/${tournamentId}/entrants/${entrant.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(toInput(entrant)),
          });
          const body = await res.json();
          if (res.ok) {
            nextEntrants.push(body.data);
          } else {
            errors.push(`${entrant.name}：${body.error?.message ?? '保存に失敗しました'}`);
            nextEntrants.push(entrant);
          }
        } else {
          nextEntrants.push(entrant);
        }
      }

      setEntrants(nextEntrants);
      setSaveErrors(errors);
      if (errors.length === 0) {
        setDeletedIds([]);
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
      }
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const renderSortableHead = (key: SortKey, label: string) => (
    <TableHead
      onClick={() => toggleSort(key)}
      className="cursor-pointer select-none hover:bg-muted/50"
    >
      {label}
      {sort?.key === key && (
        <span className="ml-1 text-xs">{sort.direction === 'asc' ? '▲' : '▼'}</span>
      )}
    </TableHead>
  );

  return (
    <div className="flex flex-1 flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        <PlayerFormDialog
          categories={categories}
          entrants={entrants}
          onSubmit={add}
          trigger={<Button disabled={disabled}>+ 新規登録</Button>}
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{ width: `${CATEGORY_SELECT_WIDTH_CHARS}em` }}
          className="h-8 rounded-lg border border-border bg-background px-2 text-sm"
        >
          <option value="all">すべて</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              カテゴリ{c.key}：{c.name}
            </option>
          ))}
        </select>
        <div className="flex flex-1 items-center justify-end gap-2">
          {saved && <span className="text-sm text-muted-foreground">保存しました</span>}
          <Button onClick={save} disabled={disabled || saving}>
            保存
          </Button>
        </div>
      </div>

      {saveErrors.length > 0 && (
        <ul className="flex flex-col gap-1 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {saveErrors.map((message, i) => (
            <li key={i}>{message}</li>
          ))}
        </ul>
      )}

      <Table className="table-fixed">
        <colgroup>
          <col className="w-[200px]" />
          <col className="w-[200px]" />
          <col className="w-[480px]" />
          <col className="w-20" />
          <col className="w-20" />
          <col />
        </colgroup>
        <TableHeader>
          <TableRow>
            {renderSortableHead('name', '選手(チーム)名')}
            {renderSortableHead('affiliation', '所属')}
            {renderSortableHead('category', 'カテゴリ')}
            {renderSortableHead('courtSelection', 'コート選択')}
            {renderSortableHead('courtNumber', 'コート番号')}
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((entrant) => {
            const category = categoryById.get(entrant.categoryId);
            const editDeleteBlockedReason = entrant.hasResult
              ? '試合結果が登録されている選手(チーム)は変更できません'
              : undefined;
            const blocked = disabled || !!editDeleteBlockedReason;
            return (
              <TableRow key={entrant.id}>
                <TableCell className="truncate font-medium">{entrant.name}</TableCell>
                <TableCell className="truncate">{entrant.affiliation ?? ''}</TableCell>
                <TableCell className="truncate">
                  {category ? `カテゴリ${category.key}：${category.name}` : '―'}
                </TableCell>
                <TableCell>{entrant.courtSelection ?? '―'}</TableCell>
                <TableCell>
                  {entrant.courtSelection === '手動' ? entrant.courtNumber : '―'}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <BlockedTooltip
                      reason={
                        blocked
                          ? (editDeleteBlockedReason ??
                              disabledReason ??
                              '大会が終了しているため変更できません')
                          : undefined
                      }
                    >
                      <PlayerFormDialog
                        categories={categories}
                        entrants={entrants}
                        initial={entrant}
                        onSubmit={(input) => edit(entrant.id, input)}
                        trigger={
                          <Button variant="outline" size="sm" disabled={blocked}>
                            編集
                          </Button>
                        }
                      />
                    </BlockedTooltip>
                    <BlockedTooltip
                      reason={
                        blocked
                          ? (editDeleteBlockedReason ??
                              disabledReason ??
                              '大会が終了しているため変更できません')
                          : undefined
                      }
                    >
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={blocked}
                        onClick={() => remove(entrant.id)}
                      >
                        削除
                      </Button>
                    </BlockedTooltip>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {disabled && (
        <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
          {disabledReason ?? '大会が終了しているため変更できません'}
        </p>
      )}
    </div>
  );
}
