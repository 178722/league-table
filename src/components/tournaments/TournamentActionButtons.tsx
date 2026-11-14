'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  GenerateSelectionDialog,
  type GenerateSelectionCategory,
} from '@/components/tournaments/GenerateSelectionDialog';
import type { GenerateResult } from '@/lib/mock-data';
import type { TournamentStatus } from '@/types/domain';

interface TournamentActionButtonsProps {
  tournamentId: string;
  status: TournamentStatus;
  categories: GenerateSelectionCategory[];
  firstCategoryId?: string;
  /** 閲覧モード（ID・パスワードなしのセッション）の場合、書き込みを伴うボタンをdisabledにする */
  viewOnly?: boolean;
}

// A3・A4・A5共通：「リーグ表を作成する」「大会を開催する」「大会を終了する」「大会を閲覧する」「大会を再開する」
// 生成・ステータス変更は実際にAPI Routeを呼び出し、インメモリデータストアを更新する
export function TournamentActionButtons({
  tournamentId,
  status,
  categories,
  firstCategoryId,
  viewOnly,
}: TournamentActionButtonsProps) {
  const router = useRouter();
  const [finishConfirmOpen, setFinishConfirmOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [generateResult, setGenerateResult] = useState<GenerateResult | null>(null);
  const [notGeneratedOpen, setNotGeneratedOpen] = useState(false);

  const matchesHref = firstCategoryId
    ? `/tournaments/${tournamentId}/categories/${firstCategoryId}/matches`
    : undefined;
  const hasAnyGenerated = categories.some((c) => c.generationStatus === '生成済み');

  const handleView = () => {
    if (!hasAnyGenerated) {
      setNotGeneratedOpen(true);
      return;
    }
    if (matchesHref) router.push(matchesHref);
  };

  const notGeneratedDialog = (
    <Dialog open={notGeneratedOpen} onOpenChange={setNotGeneratedOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>大会を閲覧できません</DialogTitle>
          <DialogDescription>
            まだリーグ表が生成されていません。大会情報画面の「リーグ表を作成する」から生成してください。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={() => setNotGeneratedOpen(false)}>閉じる</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const runFinish = async () => {
    setPending(true);
    setFinishConfirmOpen(false);
    try {
      await fetch(`/api/tournaments/${tournamentId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: '終了' }),
      });
      router.refresh();
    } finally {
      setPending(false);
    }
  };

  const runReopen = async () => {
    setPending(true);
    try {
      await fetch(`/api/tournaments/${tournamentId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: '進行中' }),
      });
      router.refresh();
    } finally {
      setPending(false);
    }
  };

  if (status === '終了') {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={!matchesHref} onClick={handleView}>
          大会を閲覧する
        </Button>
        <Button size="sm" variant="outline" disabled={pending || viewOnly} onClick={runReopen}>
          大会を再開する
        </Button>
        {notGeneratedDialog}
      </div>
    );
  }

  if (viewOnly) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={!matchesHref} onClick={handleView}>
          大会を閲覧する
        </Button>
        <Button size="sm" variant="outline" disabled>
          大会を終了する
        </Button>
        {notGeneratedDialog}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <GenerateSelectionDialog
          tournamentId={tournamentId}
          categories={categories}
          disabled={pending || viewOnly}
          onGenerated={setGenerateResult}
          trigger={
            <Button size="sm" disabled={pending || viewOnly}>
              リーグ表を作成する
            </Button>
          }
        />

        <Button
          size="sm"
          variant="outline"
          disabled={!hasAnyGenerated}
          onClick={() => matchesHref && router.push(matchesHref)}
        >
          大会を開催する
        </Button>

        <Dialog open={finishConfirmOpen} onOpenChange={setFinishConfirmOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" disabled={pending || viewOnly}>
              大会を終了する
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>大会を終了しますか？</DialogTitle>
              <DialogDescription>
                大会を終了すると、大会情報・競技情報・選手(チーム)情報の編集、試合結果の入力・修正ができなくなります。終了しますか？
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setFinishConfirmOpen(false)}>
                キャンセル
              </Button>
              <Button onClick={runFinish}>終了する</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={!!generateResult?.skipped.length} onOpenChange={() => setGenerateResult(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>条件を満たさないため生成をスキップしたカテゴリがあります</DialogTitle>
            <DialogDescription>
              生成済みカテゴリ：
              {generateResult?.generatedCategoryKeys.length
                ? generateResult.generatedCategoryKeys.map((k) => `カテゴリ${k}`).join('、')
                : 'なし'}
            </DialogDescription>
          </DialogHeader>
          <ul className="flex flex-col gap-1 text-sm">
            {generateResult?.skipped.map((s) => (
              <li key={s.categoryKey}>
                <span className="font-medium">
                  カテゴリ{s.categoryKey}：{s.categoryName}
                </span>
                　<span className="whitespace-pre-line">{s.reason}</span>
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button onClick={() => setGenerateResult(null)}>閉じる</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
