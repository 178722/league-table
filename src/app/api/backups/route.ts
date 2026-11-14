import { NextResponse } from 'next/server';
import { createBackup } from '@/lib/backup';
import { getBackups } from '@/lib/mock-data';
import { requireSession, requireWriteSession } from '@/lib/require-session';

// GET /api/backups — バックアップ履歴一覧
export async function GET() {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;
  return NextResponse.json({ data: getBackups() });
}

// POST /api/backups — 今すぐバックアップ（手動）
export async function POST() {
  const unauthorized = await requireWriteSession();
  if (unauthorized) return unauthorized;
  const record = createBackup('手動');
  return NextResponse.json({ data: record }, { status: 201 });
}
