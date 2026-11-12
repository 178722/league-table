'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

interface JankenResolutionFormProps {
  tournamentId: string;
  categoryId: string;
  court: number;
  entries: Array<{ entrantId: string; entrantName: string; defaultRank: number }>;
  disabled?: boolean;
}

// A6. タイした組の「最終順位を手動確定」入力欄。確定するとじゃんけん結果を勝敗表（順位表）へ保存する（要件定義書3.8）
export function JankenResolutionForm({
  tournamentId,
  categoryId,
  court,
  entries,
  disabled,
}: JankenResolutionFormProps) {
  const router = useRouter();
  const [ranks, setRanks] = useState<Record<string, number>>(() =>
    Object.fromEntries(entries.map((entry) => [entry.entrantId, entry.defaultRank])),
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 全員分の順位が、タイした人数分の範囲（defaultRank〜defaultRank+人数-1）で重複なく埋まっているか
  const selectedRanks = entries.map((entry) => ranks[entry.entrantId]);
  const isValid = new Set(selectedRanks).size === entries.length;

  const confirm = async () => {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/tournaments/${tournamentId}/categories/${categoryId}/standings/janken`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            court,
            ranks: entries.map((entry) => ({ entrantId: entry.entrantId, rank: ranks[entry.entrantId] })),
          }),
        },
      );
      if (res.ok) {
        router.refresh();
      } else {
        const body = await res.json();
        setError(body.error?.message ?? '確定に失敗しました');
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-4 border-t bg-muted/30 px-4 py-3">
      <p className="w-full text-sm text-muted-foreground">
        対戦結果でも決着せず。じゃんけんの結果を入力してください
      </p>
      {entries.map((entry) => (
        <label key={entry.entrantId} className="flex items-center gap-2 text-sm">
          {entry.entrantName}
          <select
            value={ranks[entry.entrantId]}
            disabled={disabled}
            onChange={(e) =>
              setRanks((prev) => ({ ...prev, [entry.entrantId]: Number(e.target.value) }))
            }
            className="h-8 rounded-lg border border-border bg-background px-2 text-sm disabled:opacity-50"
          >
            {entries.map((_, i) => (
              <option key={i} value={entry.defaultRank + i}>
                {entry.defaultRank + i}位
              </option>
            ))}
          </select>
        </label>
      ))}
      <Button size="sm" disabled={disabled || pending || !isValid} onClick={confirm}>
        確定
      </Button>
      {!isValid && (
        <span className="text-sm text-destructive">順位が重複しないように選択してください</span>
      )}
      {error && <span className="text-sm text-destructive">{error}</span>}
    </div>
  );
}
