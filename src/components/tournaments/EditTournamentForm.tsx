'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  CategoryFieldsForm,
  type CategoryFieldState,
} from '@/components/tournaments/CategoryFieldsForm';
import type { Tournament } from '@/types/domain';

interface EditTournamentFormProps {
  tournament: Tournament;
  categories: CategoryFieldState[];
  disabled: boolean;
  disabledReason?: string;
}

// A3（編集モード）の入力フォーム。保存すると実際に大会情報を更新する
export function EditTournamentForm({
  tournament,
  categories: initialCategories,
  disabled,
  disabledReason,
}: EditTournamentFormProps) {
  const router = useRouter();
  const [name, setName] = useState(tournament.name);
  const [date, setDate] = useState(tournament.date);
  const [location, setLocation] = useState(tournament.location);
  const [categories, setCategories] = useState(initialCategories);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const resetForm = () => {
    setName(tournament.name);
    setDate(tournament.date);
    setLocation(tournament.location);
    setCategories(initialCategories);
  };

  return (
    <form
      className="flex max-w-4xl flex-col gap-4 p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
          const res = await fetch(`/api/tournaments/${tournament.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name,
              date,
              location,
              categories: categories.map((c) => ({ key: c.key, name: c.name, enabled: c.enabled })),
            }),
          });
          if (res.ok) {
            setSaved(true);
            setTimeout(() => setSaved(false), 1500);
            router.refresh();
          }
        } finally {
          setSaving(false);
        }
      }}
    >
      <div className="flex items-center justify-end gap-2">
        {saved && <span className="text-sm text-muted-foreground">保存しました</span>}
        <Button type="button" variant="outline" onClick={resetForm} disabled={disabled}>
          キャンセル
        </Button>
        <Button type="submit" disabled={disabled || saving}>
          保存
        </Button>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">
          大会名（最大50文字）
          <span className="text-destructive"> *</span>
        </Label>
        <Input
          id="name"
          maxLength={50}
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={disabled}
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="date">
          開催日
          <span className="text-destructive"> *</span>
        </Label>
        <Input
          id="date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          disabled={disabled}
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="location">
          開催場所（最大50文字）
          <span className="text-destructive"> *</span>
        </Label>
        <Input
          id="location"
          maxLength={50}
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          disabled={disabled}
          required
        />
      </div>

      <CategoryFieldsForm value={categories} onChange={setCategories} disabled={disabled} />

      {disabled && (
        <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
          {disabledReason ?? '大会が終了しているため変更できません'}
        </p>
      )}
    </form>
  );
}
