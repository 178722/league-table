import { NextResponse } from 'next/server';
import { createEntrant, type EntrantInput } from '@/lib/mock-data';
import { requireWriteSession } from '@/lib/require-session';

const STATUS_BY_CODE: Record<string, number> = {
  NOT_FOUND: 404,
  TOURNAMENT_FINISHED: 409,
  HAS_RESULT: 409,
  VALIDATION_ERROR: 400,
};

// POST /api/tournaments/:id/entrants
// 選手(チーム)の新規登録（要件定義書3.3）
export async function POST(
  request: Request,
  { params }: { params: Promise<{ tournamentId: string }> },
) {
  const unauthorized = await requireWriteSession();
  if (unauthorized) return unauthorized;

  const { tournamentId } = await params;
  const body = (await request.json()) as EntrantInput;

  const result = createEntrant(tournamentId, body);
  if (!result.ok) {
    return NextResponse.json(
      { error: { code: result.code, message: result.message } },
      { status: STATUS_BY_CODE[result.code] ?? 400 },
    );
  }
  return NextResponse.json({ data: result.entrant });
}
