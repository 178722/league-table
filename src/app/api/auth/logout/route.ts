import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { clearSession, getSession, SESSION_COOKIE } from '@/lib/auth';
import { createBackup } from '@/lib/backup';

// POST /api/auth/logout
// body: { createBackup: boolean } バックアップの要否をログアウト確認ダイアログでのユーザーの選択に委ねる
// （自動バックアップは行わず、ここでの選択どおりにのみバックアップを作成する）
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { createBackup?: boolean };

  const cookieStore = await cookies();
  const session = getSession(cookieStore.get(SESSION_COOKIE)?.value);
  // 閲覧モードはバックアップ作成（書き込み）を行えないため、クライアントの指定に関わらず作成しない
  if (body.createBackup && session?.role === 'admin') {
    createBackup('ログアウト');
  }

  clearSession();
  const response = NextResponse.json({ data: { ok: true } });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
