'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { CategorySettings, LeagueFormat, RankingMethod } from '@/types/domain';

interface CategorySettingsFormProps {
  tournamentId: string;
  categoryId: string;
  settings: CategorySettings;
  disabled: boolean;
  disabledReason?: string;
}

// A4. 競技情報登録・編集画面のフォーム。保存すると実際に競技情報を更新する
export function CategorySettingsForm({
  tournamentId,
  categoryId,
  settings,
  disabled,
  disabledReason,
}: CategorySettingsFormProps) {
  const router = useRouter();
  const [setCount, setSetCount] = useState(settings.setCount);
  const [rankingMethod, setRankingMethod] = useState<RankingMethod>(settings.rankingMethod);
  const [winPoints, setWinPoints] = useState(settings.winPoints ?? 3);
  const [drawPoints, setDrawPoints] = useState(settings.drawPoints ?? 1);
  const [losePoints, setLosePoints] = useState(settings.losePoints ?? 0);
  const [courtCount, setCourtCount] = useState(settings.courtCount);
  const [maxEntrantsPerCourt, setMaxEntrantsPerCourt] = useState(settings.maxEntrantsPerCourt);
  const [leagueFormat, setLeagueFormat] = useState<LeagueFormat>(
    settings.leagueFormat ?? '独立リーグ',
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

  // コート数を1に戻した場合は単一リーグ設定を送信しない（独立リーグと単一リーグの区別が意味を持たないため）
  const effectiveLeagueFormat: LeagueFormat = courtCount >= 2 ? leagueFormat : '独立リーグ';

  return (
    <form
      className="flex max-w-xl flex-col gap-4 p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
          const res = await fetch(
            `/api/tournaments/${tournamentId}/categories/${categoryId}/settings`,
            {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                setCount,
                rankingMethod,
                winPoints: rankingMethod === '勝点方式' ? winPoints : undefined,
                drawPoints: rankingMethod === '勝点方式' ? drawPoints : undefined,
                losePoints: rankingMethod === '勝点方式' ? losePoints : undefined,
                courtCount,
                maxEntrantsPerCourt,
                leagueFormat: effectiveLeagueFormat,
              }),
            },
          );
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
        <Button type="submit" disabled={disabled || saving}>
          保存
        </Button>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="setCount">セット数</Label>
        <select
          id="setCount"
          value={setCount}
          onChange={(e) => setSetCount(Number(e.target.value))}
          disabled={disabled}
          className="h-8 w-32 rounded-lg border border-border bg-background px-2 text-sm disabled:opacity-50"
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="text-sm font-medium">順位決定方式</legend>
        <div className="flex gap-4">
          <label className="flex items-center gap-1.5 text-sm">
            <input
              type="radio"
              name="rankingMethod"
              checked={rankingMethod === '勝敗方式'}
              disabled={disabled}
              onChange={() => setRankingMethod('勝敗方式')}
            />
            勝敗方式
          </label>
          <label className="flex items-center gap-1.5 text-sm">
            <input
              type="radio"
              name="rankingMethod"
              checked={rankingMethod === '勝点方式'}
              disabled={disabled}
              onChange={() => setRankingMethod('勝点方式')}
            />
            勝点方式
          </label>
        </div>
      </fieldset>

      <div className="flex gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="winPoints">勝利勝点</Label>
          <Input
            id="winPoints"
            type="number"
            min={0}
            max={5}
            value={winPoints}
            onChange={(e) => setWinPoints(Number(e.target.value))}
            disabled={disabled || rankingMethod !== '勝点方式'}
            className="w-20"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="drawPoints">引分勝点</Label>
          <Input
            id="drawPoints"
            type="number"
            min={0}
            max={5}
            value={drawPoints}
            onChange={(e) => setDrawPoints(Number(e.target.value))}
            disabled={disabled || rankingMethod !== '勝点方式'}
            className="w-20"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="losePoints">敗北勝点</Label>
          <Input
            id="losePoints"
            type="number"
            min={0}
            max={5}
            value={losePoints}
            onChange={(e) => setLosePoints(Number(e.target.value))}
            disabled={disabled || rankingMethod !== '勝点方式'}
            className="w-20"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="courtCount">コート数</Label>
        <select
          id="courtCount"
          value={courtCount}
          onChange={(e) => setCourtCount(Number(e.target.value))}
          disabled={disabled}
          className="h-8 w-32 rounded-lg border border-border bg-background px-2 text-sm disabled:opacity-50"
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="leagueFormat"
          checked={effectiveLeagueFormat === '単一リーグ'}
          disabled={disabled || courtCount < 2}
          onChange={(e) => setLeagueFormat(e.target.checked ? '単一リーグ' : '独立リーグ')}
          className="size-4"
        />
        <Label htmlFor="leagueFormat" className="font-normal">
          単一リーグ
        </Label>
        <button
          type="button"
          onClick={() => setInfoOpen(true)}
          className="text-muted-foreground hover:text-foreground"
          aria-label="単一リーグについての説明"
        >
          <Info className="size-4" />
        </button>
      </div>

      <Dialog open={infoOpen} onOpenChange={setInfoOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>単一リーグについて</DialogTitle>
            <DialogDescription>
              チェックすると、複数コートにまたがる1つのリーグとして試合順・順位表を生成します（コート数が2以上の場合のみ設定できます）。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setInfoOpen(false)}>閉じる</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="maxEntrantsPerCourt">1コート最大選手(チーム)数</Label>
        <select
          id="maxEntrantsPerCourt"
          value={maxEntrantsPerCourt}
          onChange={(e) => setMaxEntrantsPerCourt(Number(e.target.value))}
          disabled={disabled || effectiveLeagueFormat === '単一リーグ'}
          className="h-8 w-32 rounded-lg border border-border bg-background px-2 text-sm disabled:opacity-50"
        >
          {Array.from({ length: 9 }, (_, i) => i + 2).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>

      {disabledReason && (
        <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
          {disabledReason}
        </p>
      )}
    </form>
  );
}
