'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { SetScore } from '@/types/domain';

interface ResultInputDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournamentId: string;
  categoryId: string;
  matchId: string;
  entrantAName: string;
  entrantBName: string;
  initialSets: SetScore[];
  disabled: boolean;
}

const NAME_COLUMN_WIDTH = '11em'; // 全角11文字分で固定

// 要件定義書3.7の表記（◯：勝ち、ー：引分、空白：負け）に合わせ、各サイドのマークを個別に算出する
function markForSide(own: number | null, opponent: number | null): string {
  if (own === null || opponent === null) return '';
  if (own > opponent) return '◯';
  if (own === opponent) return 'ー';
  return '';
}

// A6のマス・試合順表から開く、セットスコア入力専用のシンプルなダイアログ
// 横軸=選手(チーム)名、縦軸=セットという構成で入力する（要件定義書3.7）
export function ResultInputDialog({
  open,
  onOpenChange,
  tournamentId,
  categoryId,
  matchId,
  entrantAName,
  entrantBName,
  initialSets,
  disabled,
}: ResultInputDialogProps) {
  const router = useRouter();
  const [sets, setSets] = useState<SetScore[]>(initialSets);
  const [saving, setSaving] = useState(false);

  const setScore = (index: number, side: 'scoreA' | 'scoreB', value: string) => {
    setSets((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [side]: value === '' ? null : Number(value) } : s)),
    );
  };

  const save = async () => {
    setSaving(true);
    try {
      await fetch(`/api/tournaments/${tournamentId}/categories/${categoryId}/matches/${matchId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sets }),
      });
      onOpenChange(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-fit">
        <DialogHeader>
          <DialogTitle>試合結果の入力</DialogTitle>
        </DialogHeader>
        <table className="table-fixed border-collapse text-sm">
          <colgroup>
            <col style={{ width: '5em' }} />
            <col style={{ width: NAME_COLUMN_WIDTH }} />
            <col style={{ width: NAME_COLUMN_WIDTH }} />
          </colgroup>
          <thead>
            <tr>
              <th className="border p-1 whitespace-nowrap" />
              <th className="border p-1 truncate text-center font-medium">{entrantAName}</th>
              <th className="border p-1 truncate text-center font-medium">{entrantBName}</th>
            </tr>
          </thead>
          <tbody>
            {sets.map((set, i) => (
              <tr key={i}>
                <td className="border p-1 whitespace-nowrap text-center text-muted-foreground">
                  {i + 1}セット
                </td>
                <td className="border p-1 whitespace-nowrap">
                  <div className="flex items-center justify-center gap-1.5">
                    <span className="w-4 shrink-0 text-center text-lg">
                      {markForSide(set.scoreA, set.scoreB)}
                    </span>
                    <Input
                      type="number"
                      min={0}
                      max={999}
                      value={set.scoreA ?? ''}
                      disabled={disabled}
                      onChange={(e) => setScore(i, 'scoreA', e.target.value)}
                      className="w-20 shrink-0"
                    />
                  </div>
                </td>
                <td className="border p-1 whitespace-nowrap">
                  <div className="flex items-center justify-center gap-1.5">
                    <Input
                      type="number"
                      min={0}
                      max={999}
                      value={set.scoreB ?? ''}
                      disabled={disabled}
                      onChange={(e) => setScore(i, 'scoreB', e.target.value)}
                      className="w-20 shrink-0"
                    />
                    <span className="w-4 shrink-0 text-center text-lg">
                      {markForSide(set.scoreB, set.scoreA)}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!disabled && (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              キャンセル
            </Button>
            <Button onClick={save} disabled={saving}>
              保存
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
