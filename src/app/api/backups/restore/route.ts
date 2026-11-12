import fs from 'node:fs';
import { NextResponse } from 'next/server';
import { getBackupFilePath, restoreFromSnapshot } from '@/lib/backup';
import { requireWriteSession } from '@/lib/require-session';
import type { Store } from '@/lib/store';

// POST /api/backups/restore
// 選択されたバックアップ履歴（作成日時）のJSONで全データを上書きする（要件定義書4章）
export async function POST(request: Request) {
  const unauthorized = await requireWriteSession();
  if (unauthorized) return unauthorized;

  const body = (await request.json().catch(() => null)) as { backupId?: string } | null;
  if (!body?.backupId) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'バックアップデータを選択してください' } },
      { status: 400 },
    );
  }

  const filePath = getBackupFilePath(body.backupId);
  if (!filePath) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'バックアップデータが見つかりません' } },
      { status: 404 },
    );
  }

  const snapshot = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Omit<
    Store,
    'auth' | 'session'
  >;
  restoreFromSnapshot(snapshot);
  return NextResponse.json({ data: { ok: true } });
}
