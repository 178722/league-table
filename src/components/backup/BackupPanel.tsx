'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { formatDateTime } from '@/lib/format';
import type { BackupRecord } from '@/types/domain';

interface BackupPanelProps {
  initialBackups: BackupRecord[];
  /** 閲覧モード（ID・パスワードなしのセッション）の場合、作成・復元をdisabledにする */
  disabled?: boolean;
}

// A8. バックアップ・リストア画面。今すぐバックアップ／復元は実際にファイルを読み書きする
export function BackupPanel({ initialBackups, disabled }: BackupPanelProps) {
  const router = useRouter();
  const [backups, setBackups] = useState(initialBackups);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [selectedBackupId, setSelectedBackupId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const createBackupNow = async () => {
    setPending(true);
    try {
      const res = await fetch('/api/backups', { method: 'POST' });
      const body = await res.json();
      if (res.ok) setBackups((prev) => [body.data, ...prev]);
    } finally {
      setPending(false);
    }
  };

  const runRestore = async () => {
    if (!selectedBackupId) return;
    setPending(true);
    setRestoreError(null);
    try {
      const res = await fetch('/api/backups/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backupId: selectedBackupId }),
      });
      if (res.ok) {
        setRestoreOpen(false);
        router.refresh();
      } else {
        const body = await res.json().catch(() => null);
        setRestoreError(body?.error?.message ?? '復元に失敗しました');
      }
    } finally {
      setPending(false);
    }
  };

  const filteredBackups = useMemo(() => {
    return backups.filter((backup) => {
      const createdDate = backup.createdAt.slice(0, 10); // YYYY-MM-DD
      if (dateFrom && createdDate < dateFrom) return false;
      if (dateTo && createdDate > dateTo) return false;
      return true;
    });
  }, [backups, dateFrom, dateTo]);

  return (
    <div className="flex flex-col gap-6 p-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <Button onClick={createBackupNow} disabled={pending || disabled}>
            今すぐバックアップ
          </Button>
          <div className="flex items-end gap-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="backup-date-from">期間（開始）</Label>
              <input
                id="backup-date-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-8 rounded-lg border border-border bg-background px-2 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="backup-date-to">期間（終了）</Label>
              <input
                id="backup-date-to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-8 rounded-lg border border-border bg-background px-2 text-sm"
              />
            </div>
            {(dateFrom || dateTo) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDateFrom('');
                  setDateTo('');
                }}
              >
                絞り込み解除
              </Button>
            )}
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead />
              <TableHead>作成日時</TableHead>
              <TableHead>契機</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredBackups.map((backup) => (
              <TableRow key={backup.id}>
                <TableCell>
                  <input
                    type="radio"
                    name="backup-select"
                    aria-label={`${formatDateTime(backup.createdAt)}のバックアップを選択`}
                    checked={selectedBackupId === backup.id}
                    onChange={() => {
                      setSelectedBackupId(backup.id);
                      setRestoreError(null);
                    }}
                  />
                </TableCell>
                <TableCell>{formatDateTime(backup.createdAt)}</TableCell>
                <TableCell>{backup.trigger}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-2 border-t pt-4">
        <h2 className="text-sm font-semibold">データ復元（リストア）</h2>
        <p className="text-sm text-muted-foreground">
          ※バックアップデータ選択後、復元ボタンを押して下さい
        </p>
        <div>
          <Dialog
            open={restoreOpen}
            onOpenChange={(next) => {
              setRestoreOpen(next);
              if (!next) setRestoreError(null);
            }}
          >
            <DialogTrigger asChild>
              <Button variant="destructive" disabled={!selectedBackupId || disabled}>
                復元
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>データを復元しますか？</DialogTitle>
                <DialogDescription>
                  現在のすべてのデータが、選択したバックアップ（
                  {selectedBackupId
                    ? formatDateTime(
                        backups.find((b) => b.id === selectedBackupId)?.createdAt ?? '',
                      )
                    : ''}
                  ）の内容で完全に上書きされます。元に戻せません。復元しますか？
                </DialogDescription>
              </DialogHeader>
              {restoreError && <p className="text-sm text-destructive">{restoreError}</p>}
              <DialogFooter>
                <Button variant="outline" onClick={() => setRestoreOpen(false)}>
                  キャンセル
                </Button>
                <Button variant="destructive" disabled={pending} onClick={runRestore}>
                  復元する
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}
