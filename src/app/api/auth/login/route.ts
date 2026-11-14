import { NextResponse } from 'next/server';
import { createSession, verifyCredentials, SESSION_COOKIE } from '@/lib/auth';

// POST /api/auth/login
// ID・パスワードを検証し、成功時はセッションCookieを発行する
export async function POST(request: Request) {
  const body = (await request.json()) as { id?: string; password?: string };
  if (!body.id || !body.password) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'IDとパスワードを入力してください' } },
      { status: 400 },
    );
  }

  if (!verifyCredentials(body.id, body.password)) {
    return NextResponse.json(
      { error: { code: 'INVALID_CREDENTIALS', message: 'IDまたはパスワードが正しくありません' } },
      { status: 401 },
    );
  }

  const token = createSession();
  const response = NextResponse.json({ data: { ok: true } });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
