import { NextResponse } from 'next/server';
import { updateCategorySettings, type UpdateCategorySettingsInput } from '@/lib/mock-data';
import { requireWriteSession } from '@/lib/require-session';

const ERROR_MESSAGES: Record<string, { code: string; message: string; status: number }> = {
  NOT_FOUND: { code: 'NOT_FOUND', message: '対象が見つかりません', status: 404 },
  TOURNAMENT_FINISHED: {
    code: 'TOURNAMENT_FINISHED',
    message: '大会が終了しているため変更できません',
    status: 409,
  },
  HAS_RESULTS: {
    code: 'HAS_RESULTS',
    message: '試合結果が登録されているため変更できません',
    status: 409,
  },
  VALIDATION_ERROR: { code: 'VALIDATION_ERROR', message: '入力内容が不正です', status: 400 },
};

// PUT /api/tournaments/:id/categories/:categoryId/settings
// 競技情報（セット数・順位決定方式・勝点・コート数等）を保存する（要件定義書3.2）
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ tournamentId: string; categoryId: string }> },
) {
  const unauthorized = await requireWriteSession();
  if (unauthorized) return unauthorized;

  const { categoryId } = await params;
  const body = (await request.json()) as UpdateCategorySettingsInput;

  const result = updateCategorySettings(categoryId, body);
  if (!result.ok) {
    const error = ERROR_MESSAGES[result.code];
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  }
  return NextResponse.json({ data: result.category });
}
