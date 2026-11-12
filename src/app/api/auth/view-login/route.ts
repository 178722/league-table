import { NextResponse } from 'next/server';
import { createSession, SESSION_COOKIE } from '@/lib/auth';

// POST /api/auth/view-login
// ID・パスワードなしで閲覧モード（書き込み不可）のセッションを発行する
export async function POST() {
  const token = createSession('viewer');
  const response = NextResponse.json({ data: { ok: true } });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
