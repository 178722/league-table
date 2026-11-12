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

type Step = 'confirm-logout' | 'confirm-backup';

interface LogoutButtonProps {
  /** 閲覧モードはバックアップを作成できないため、バックアップ要否確認はスキップする */
  viewOnly?: boolean;
}

// 共通ヘッダー「ログアウト」：ログアウト確認→バックアップ要否確認の2段階ダイアログ（閲覧モードはログアウト確認のみ）
export function LogoutButton({ viewOnly }: LogoutButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('confirm-logout');
  const [pending, setPending] = useState(false);

  const runLogout = async (createBackup: boolean) => {
    setPending(true);
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ createBackup }),
      });
      setOpen(false);
      router.push('/login');
      router.refresh();
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setStep('confirm-logout');
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          ログアウト
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {step === 'confirm-logout' ? (
          <>
            <DialogHeader>
              <DialogTitle>ログアウトしますか？</DialogTitle>
              <DialogDescription>現在のセッションを終了します。</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                しない
              </Button>
              <Button
                disabled={pending}
                onClick={() => (viewOnly ? runLogout(false) : setStep('confirm-backup'))}
              >
                ログアウトする
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>バックアップを作成しますか？</DialogTitle>
              <DialogDescription>
                ログアウト前に、現在のデータのバックアップを作成できます。
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" disabled={pending} onClick={() => runLogout(false)}>
                しない
              </Button>
              <Button disabled={pending} onClick={() => runLogout(true)}>
                バックアップする
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
