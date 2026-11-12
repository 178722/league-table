'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

// A1. ログイン情報の変更ダイアログ。未ログイン状態から実行できるため、
// セッションの代わりに現在のID・パスワードをダイアログ内で入力させて本人確認を行う
export function CredentialsChangeDialog() {
  const [open, setOpen] = useState(false);
  const [currentId, setCurrentId] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newId, setNewId] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  const reset = () => {
    setCurrentId('');
    setCurrentPassword('');
    setNewId('');
    setNewPassword('');
    setError(null);
    setSaved(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="link" className="w-full">
          ログイン情報を変更する
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>ログイン情報の変更</DialogTitle>
          <DialogDescription>
            本人確認のため、現在のIDとパスワードを入力してください。
          </DialogDescription>
        </DialogHeader>
        <form
          id="credentials-change-form"
          className="flex flex-col gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setPending(true);
            setError(null);
            try {
              const res = await fetch('/api/auth/credentials', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  currentId,
                  currentPassword,
                  id: newId,
                  password: newPassword,
                }),
              });
              if (res.ok) {
                setSaved(true);
                setCurrentId('');
                setCurrentPassword('');
                setNewId('');
                setNewPassword('');
              } else {
                const body = await res.json();
                setError(body.error?.message ?? '変更に失敗しました');
              }
            } finally {
              setPending(false);
            }
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="current-id">現在のID</Label>
            <Input
              id="current-id"
              value={currentId}
              onChange={(e) => setCurrentId(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="current-password">現在のパスワード</Label>
            <Input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-id">新しいID</Label>
            <Input id="new-id" value={newId} onChange={(e) => setNewId(e.target.value)} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-password">新しいパスワード</Label>
            <Input
              id="new-password"
              type="password"
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {saved && <p className="text-sm text-muted-foreground">変更しました</p>}
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            閉じる
          </Button>
          <Button type="submit" form="credentials-change-form" disabled={pending}>
            変更する
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
