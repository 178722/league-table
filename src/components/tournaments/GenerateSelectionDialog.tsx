'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { GenerateResult } from '@/lib/mock-data';

export interface GenerateSelectionCategory {
  id: string;
  key: string;
  name: string;
  courtCount: number;
  generationStatus: '未生成' | '生成済み';
}

interface GenerateSelectionDialogProps {
  tournamentId: string;
  categories: GenerateSelectionCategory[];
  trigger: ReactNode;
  disabled?: boolean;
  onGenerated: (result: GenerateResult) => void;
}

interface Target {
  categoryId: string;
  label: string;
  alreadyGenerated: boolean;
}

// A3「リーグ表を作成する」ボタン：生成対象のカテゴリを選択するダイアログ（デフォルト未チェック）
// 生成単位はカテゴリのみとする（同一カテゴリ内のコートへの選手(チーム)自動振り分けは一体の処理のため、コート単位では選択しない）
export function GenerateSelectionDialog({
  tournamentId,
  categories,
  trigger,
  disabled,
  onGenerated,
}: GenerateSelectionDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targets = useMemo<Target[]>(
    () =>
      categories.map((category) => ({
        categoryId: category.id,
        label: `カテゴリ${category.key}：${category.name}`,
        alreadyGenerated: category.generationStatus === '生成済み',
      })),
    [categories],
  );

  const selectedCount = targets.filter((t) => checked[t.categoryId]).length;
  const anySelectedAlreadyGenerated = targets.some(
    (t) => checked[t.categoryId] && t.alreadyGenerated,
  );

  const setAll = (value: boolean) => {
    setChecked(Object.fromEntries(targets.map((t) => [t.categoryId, value])));
  };

  const runGenerate = async () => {
    setPending(true);
    setError(null);
    try {
      const body = {
        targets: targets.filter((t) => checked[t.categoryId]).map((t) => ({ categoryId: t.categoryId })),
      };
      const res = await fetch(`/api/tournaments/${tournamentId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const resBody = await res.json();
      if (!res.ok) {
        // 失敗時はダイアログを閉じずエラーを表示する（気づかれないまま意図と異なる範囲で
        // 生成される、または何も起きなかったように見えることを防ぐ）
        setError(resBody.error?.message ?? '生成に失敗しました。もう一度お試しください');
        return;
      }
      setOpen(false);
      setChecked({});
      onGenerated(resBody.data);
      router.refresh();
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (!value) setError(null);
      }}
    >
      <span onClick={() => !disabled && setOpen(true)}>{trigger}</span>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>リーグ表を作成する対象を選択してください</DialogTitle>
          <DialogDescription>
            チェックしたカテゴリのみ、リーグ表・試合順・審判順を生成します。
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setAll(true)}>
            全てチェックする
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setAll(false)}>
            全てのチェックを外す
          </Button>
        </div>

        <div className="flex max-h-72 flex-col gap-2 overflow-y-auto">
          {targets.map((t) => (
            <label key={t.categoryId} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!checked[t.categoryId]}
                onChange={(e) =>
                  setChecked((prev) => ({ ...prev, [t.categoryId]: e.target.checked }))
                }
              />
              {t.label}
              {t.alreadyGenerated && (
                <span className="text-xs text-muted-foreground">（生成済み）</span>
              )}
            </label>
          ))}
        </div>

        {anySelectedAlreadyGenerated && (
          <p className="text-sm text-destructive">
            既に生成済みの対象が含まれています。実行すると現在の内容は上書きされます。
          </p>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            キャンセル
          </Button>
          <Button type="button" disabled={selectedCount === 0 || pending} onClick={runGenerate}>
            作成する
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
