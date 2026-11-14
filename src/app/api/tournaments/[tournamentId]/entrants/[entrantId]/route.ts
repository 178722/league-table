import { NextResponse } from 'next/server';
import { deleteEntrant, updateEntrant, type EntrantInput } from '@/lib/mock-data';
import { requireWriteSession } from '@/lib/require-session';

const STATUS_BY_CODE: Record<string, number> = {
  NOT_FOUND: 404,
  TOURNAMENT_FINISHED: 409,
  HAS_RESULT: 409,
  VALIDATION_ERROR: 400,
};

// PUT /api/tournaments/:id/entrants/:entrantId
// 選手(チーム)情報の編集（要件定義書3.3）
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ entrantId: string }> },
) {
  const unauthorized = await requireWriteSession();
  if (unauthorized) return unauthorized;

  const { entrantId } = await params;
  const body = (await request.json()) as EntrantInput;

  const result = updateEntrant(entrantId, body);
  if (!result.ok) {
    return NextResponse.json(
      { error: { code: result.code, message: result.message } },
      { status: STATUS_BY_CODE[result.code] ?? 400 },
    );
  }
  return NextResponse.json({ data: result.entrant });
}

// DELETE /api/tournaments/:id/entrants/:entrantId
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ entrantId: string }> },
) {
  const unauthorized = await requireWriteSession();
  if (unauthorized) return unauthorized;

  const { entrantId } = await params;
  const result = deleteEntrant(entrantId);
  if (!result.ok) {
    return NextResponse.json(
      { error: { code: result.code, message: result.message } },
      { status: STATUS_BY_CODE[result.code] ?? 400 },
    );
  }
  return NextResponse.json({ data: { id: entrantId } });
}
