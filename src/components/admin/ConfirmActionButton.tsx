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
import type { ComponentProps } from 'react';

interface ConfirmActionButtonProps {
  label: string;
  dialogTitle: string;
  dialogDescription: string;
  confirmLabel?: string;
  variant?: ComponentProps<typeof Button>['variant'];
  disabled?: boolean;
  /** 確認後に実行する処理（API呼び出しなど）。指定しない場合は何もしない */
  onConfirm?: () => Promise<void> | void;
  /** 確認後の遷移先 */
  navigateTo?: string;
  /** trueの場合、navigateToへ遷移する代わりに現在の画面データを再取得する */
  refreshInstead?: boolean;
}

// 共通確認ダイアログ（大会削除・試合再生成・バックアップ復元などで利用）
export function ConfirmActionButton({
  label,
  dialogTitle,
  dialogDescription,
  confirmLabel = '実行する',
  variant = 'default',
  disabled,
  onConfirm,
  navigateTo,
  refreshInstead,
}: ConfirmActionButtonProps) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size="sm" disabled={disabled}>
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            キャンセル
          </Button>
          <Button
            variant={variant}
            disabled={pending}
            onClick={async () => {
              setPending(true);
              try {
                await onConfirm?.();
              } finally {
                setPending(false);
              }
              setOpen(false);
              if (navigateTo) router.push(navigateTo);
              else if (refreshInstead) router.refresh();
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
