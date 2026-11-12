import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getSession, SESSION_COOKIE, validateSession } from '@/lib/auth';
import type { SessionRole } from '@/lib/store';

/** API Route Handlerの先頭で呼び出し、未認証であればそのままレスポンスとして返す（閲覧モードでも参照は可能） */
export async function requireSession(): Promise<NextResponse | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!validateSession(token)) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: '認証が必要です' } },
      { status: 401 },
    );
  }
  return null;
}

/**
 * 登録・編集・削除・生成・バックアップ作成/復元など、データを書き換えるAPI Route Handlerの先頭で呼び出す。
 * 閲覧モード（role: 'viewer'）のセッションは書き込み操作を拒否する
 */
export async function requireWriteSession(): Promise<NextResponse | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  const session = getSession(token);
  if (!session) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: '認証が必要です' } },
      { status: 401 },
    );
  }
  if (session.role !== 'admin') {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: '閲覧モードのため、この操作はできません' } },
      { status: 403 },
    );
  }
  return null;
}

/** Server Componentから現在のセッション種別を取得する（閲覧モード時にUIの書き込み系操作を隠す/disabledにするために使う） */
export async function getSessionRole(): Promise<SessionRole | undefined> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  return getSession(token)?.role;
}
