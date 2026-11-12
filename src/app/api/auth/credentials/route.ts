import { NextResponse } from 'next/server';
import { updateCredentials, verifyCredentials } from '@/lib/auth';

// PUT /api/auth/credentials
// ログインID・パスワードを変更する（A1ログイン画面のダイアログから利用）。
// 未ログイン状態からも実行できるため、セッションの代わりに現在のID・パスワードの一致を本人確認とする
export async function PUT(request: Request) {
  const body = (await request.json()) as {
    currentId?: string;
    currentPassword?: string;
    id?: string;
    password?: string;
  };

  if (!body.currentId || !body.currentPassword || !body.id || !body.password) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: '現在のID・パスワードと、新しいID・パスワードを入力してください',
        },
      },
      { status: 400 },
    );
  }
  if (body.password.length < 8) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: '新しいパスワードは8文字以上で入力してください',
        },
      },
      { status: 400 },
    );
  }

  if (!verifyCredentials(body.currentId, body.currentPassword)) {
    return NextResponse.json(
      {
        error: {
          code: 'INVALID_CREDENTIALS',
          message: '現在のIDまたはパスワードが正しくありません',
        },
      },
      { status: 401 },
    );
  }

  updateCredentials(body.id, body.password);
  return NextResponse.json({ data: { ok: true } });
}
