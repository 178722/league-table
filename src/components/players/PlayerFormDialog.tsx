'use client';

import { useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { CATEGORY_SELECT_WIDTH_CHARS } from '@/lib/format';
import { validateEntrantAgainst } from '@/lib/entrant-validation';
import type { Category, CourtSelection, Entrant } from '@/types/domain';

export interface EntrantInput {
  name: string;
  affiliation?: string;
  categoryId: string;
  courtSelection?: CourtSelection;
  courtNumber?: number;
}

interface PlayerFormDialogProps {
  trigger: ReactNode;
  categories: Category[];
  /** 同一大会内の現在の選手(チーム)一覧（下書き中の追加・編集も含む）。登録数上限のチェックに使う */
  entrants: Entrant[];
  initial?: Entrant;
  onSubmit: (input: EntrantInput) => void;
}

// A5. 選手(チーム)情報の新規登録・編集フォーム（モーダル）
export function PlayerFormDialog({
  trigger,
  categories,
  entrants,
  initial,
  onSubmit,
}: PlayerFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? categories[0]?.id ?? '');
  const [courtSelection, setCourtSelection] = useState<CourtSelection>(
    initial?.courtSelection ?? '自動',
  );
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const selectedCategory = categories.find((c) => c.id === categoryId);
  const showCourtFields =
    (selectedCategory?.settings.courtCount ?? 1) >= 2 &&
    selectedCategory?.settings.leagueFormat !== '単一リーグ';

  // フォームの入力値を読み取り、バリデーションを通過すればonSubmitへ渡す。
  // 成功した場合はtrueを返す（呼び出し側はダイアログを閉じるか、次の入力に備えてリセットするかを選べる）
  const trySubmit = (form: HTMLFormElement): boolean => {
    const name = (form.elements.namedItem('name') as HTMLInputElement).value;
    const affiliation = (form.elements.namedItem('affiliation') as HTMLInputElement).value;
    const courtNumberRaw = (form.elements.namedItem('courtNumber') as HTMLInputElement | null)
      ?.value;
    const input: EntrantInput = {
      name,
      affiliation: affiliation || undefined,
      categoryId,
      courtSelection: showCourtFields ? courtSelection : undefined,
      courtNumber: showCourtFields && courtSelection === '手動' ? Number(courtNumberRaw) : undefined,
    };

    if (selectedCategory) {
      const others = entrants.filter(
        (entrant) => entrant.categoryId === categoryId && entrant.id !== initial?.id,
      );
      const validationError = validateEntrantAgainst(selectedCategory, others, input);
      if (validationError) {
        setError(validationError);
        return false;
      }
    }

    onSubmit(input);
    setError(null);
    return true;
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{initial ? '選手(チーム)情報の編集' : '選手(チーム)の新規登録'}</DialogTitle>
        </DialogHeader>
        <form
          id="player-form"
          ref={formRef}
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (trySubmit(e.currentTarget)) setOpen(false);
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">選手(チーム)名（最大10文字）</Label>
            <Input id="name" name="name" maxLength={10} defaultValue={initial?.name} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="affiliation">所属（最大10文字）</Label>
            <Input
              id="affiliation"
              name="affiliation"
              maxLength={10}
              defaultValue={initial?.affiliation}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="categoryId">カテゴリ</Label>
            <select
              id="categoryId"
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                setError(null);
              }}
              style={{ width: `${CATEGORY_SELECT_WIDTH_CHARS}em`, maxWidth: '100%' }}
              className="h-8 rounded-lg border border-border bg-background px-2 text-sm"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  カテゴリ{c.key}：{c.name}
                </option>
              ))}
            </select>
          </div>
          {showCourtFields && (
            <>
              <fieldset className="flex flex-col gap-1.5">
                <legend className="text-sm font-medium">コート選択</legend>
                <div className="flex gap-4">
                  <label className="flex items-center gap-1.5 text-sm">
                    <input
                      type="radio"
                      name="courtSelection"
                      checked={courtSelection === '自動'}
                      onChange={() => setCourtSelection('自動')}
                    />
                    自動
                  </label>
                  <label className="flex items-center gap-1.5 text-sm">
                    <input
                      type="radio"
                      name="courtSelection"
                      checked={courtSelection === '手動'}
                      onChange={() => setCourtSelection('手動')}
                    />
                    手動
                  </label>
                </div>
              </fieldset>
              {courtSelection === '手動' && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="courtNumber">コート番号</Label>
                  <select
                    id="courtNumber"
                    name="courtNumber"
                    defaultValue={initial?.courtNumber ?? 1}
                    className="h-8 w-24 rounded-lg border border-border bg-background px-2 text-sm"
                  >
                    {Array.from(
                      { length: selectedCategory?.settings.courtCount ?? 1 },
                      (_, i) => i + 1,
                    ).map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}
        </form>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            キャンセル
          </Button>
          {!initial && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const form = formRef.current;
                if (!form || !trySubmit(form)) return;
                // カテゴリ・コート選択等は維持し、選手(チーム)名・所属のみ空欄に戻して次の入力に備える
                (form.elements.namedItem('name') as HTMLInputElement).value = '';
                (form.elements.namedItem('affiliation') as HTMLInputElement).value = '';
                (form.elements.namedItem('name') as HTMLInputElement).focus();
              }}
            >
              保存して次へ
            </Button>
          )}
          <Button type="submit" form="player-form">
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
