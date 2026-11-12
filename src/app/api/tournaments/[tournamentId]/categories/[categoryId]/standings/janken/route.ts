import { NextResponse } from 'next/server';
import { confirmJankenRanks, getCategory, getTournament } from '@/lib/mock-data';
import { requireWriteSession } from '@/lib/require-session';

// PUT /api/tournaments/:id/categories/:categoryId/standings/janken
// じゃんけん待ちの組の最終順位を手動確定し、勝敗表（順位表）へ反映する（要件定義書3.8）
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ tournamentId: string; categoryId: string }> },
) {
  const unauthorized = await requireWriteSession();
  if (unauthorized) return unauthorized;

  const { tournamentId, categoryId } = await params;
  const tournament = getTournament(tournamentId);
  const category = getCategory(categoryId);
  if (!tournament || !category || category.tournamentId !== tournamentId) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: '対象が見つかりません' } },
      { status: 404 },
    );
  }
  if (tournament.status === '終了') {
    return NextResponse.json(
      { error: { code: 'TOURNAMENT_FINISHED', message: '大会が終了しているため変更できません' } },
      { status: 409 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    court?: number;
    ranks?: Array<{ entrantId: string; rank: number }>;
  } | null;
  if (typeof body?.court !== 'number' || !Array.isArray(body.ranks) || body.ranks.length === 0) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'court・ranksを指定してください' } },
      { status: 400 },
    );
  }

  const result = confirmJankenRanks(categoryId, body.court, body.ranks);
  if (!result.ok) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: result.message } },
      { status: 400 },
    );
  }
  return NextResponse.json({ data: { ok: true } });
}
