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
import type { CategoryKey } from '@/types/domain';

const CATEGORY_KEYS: CategoryKey[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

const emptyCategories: CategoryFieldState[] = CATEGORY_KEYS.map((key) => ({
  key,
  name: '',
  enabled: key === 'A',
  locked: false,
}));

const today = new Date().toISOString().slice(0, 10);

interface NewTournamentFormProps {
  disabled?: boolean;
}

// A3（新規作成）。保存すると実際に大会を作成し、作成された大会のA3編集モードへ遷移する
export function NewTournamentForm({ disabled }: NewTournamentFormProps) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [date, setDate] = useState(today);
  const [location, setLocation] = useState('');
  const [categories, setCategories] = useState(emptyCategories);
  const [saving, setSaving] = useState(false);

  return (
    <form
      className="flex max-w-4xl flex-col gap-4 p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
          const res = await fetch('/api/tournaments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name,
              date,
              location,
              categories: categories
                .filter((c) => c.enabled)
                .map((c) => ({ key: c.key, name: c.name })),
            }),
          });
          const body = await res.json();
          if (res.ok) {
            router.push(`/tournaments/${body.data.id}`);
          }
        } finally {
          setSaving(false);
        }
      }}
    >
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.push('/tournaments')}>
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
    </form>
  );
}
