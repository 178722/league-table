'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// A1. ID・パスワードを検証し、成功時は大会一覧(A2)へ遷移する
export function LoginForm() {
  const router = useRouter();
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [viewOnlyPending, setViewOnlyPending] = useState(false);

  const startViewOnlySession = async () => {
    setViewOnlyPending(true);
    try {
      await fetch('/api/auth/view-login', { method: 'POST' });
      router.push('/tournaments');
      router.refresh();
    } finally {
      setViewOnlyPending(false);
    }
  };

  return (
    <form
      className="flex w-full flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setError(null);
        try {
          const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, password }),
          });
          if (res.ok) {
            router.push('/tournaments');
            router.refresh();
          } else {
            const body = await res.json();
            setError(body.error?.message ?? 'IDまたはパスワードが正しくありません');
          }
        } finally {
          setPending(false);
        }
      }}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="login-id">ID</Label>
        <Input
          id="login-id"
          name="id"
          value={id}
          onChange={(e) => setId(e.target.value)}
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="login-password">パスワード</Label>
        <Input
          id="login-password"
          name="password"
          type="password"
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="mt-2 w-full" disabled={pending}>
        ログイン
      </Button>
      <Button
        type="button"
        variant="outline"
        className="w-full"
        disabled={viewOnlyPending}
        onClick={startViewOnlySession}
      >
        閲覧モードで見る（ID・パスワード不要）
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        ※閲覧モードでは、編集・バックアップ・リストアなどの書き込み操作はできません
      </p>
    </form>
  );
}
