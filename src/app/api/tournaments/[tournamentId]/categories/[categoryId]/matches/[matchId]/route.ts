import { NextResponse } from 'next/server';
import { getCategory, getTournament, saveMatchResult } from '@/lib/mock-data';
import { requireWriteSession } from '@/lib/require-session';
import type { SetScore } from '@/types/domain';

// PUT /api/tournaments/:id/categories/:categoryId/matches/:matchId
// 1試合分のセットスコアを保存し、勝敗表（順位表）を自動再集計する（要件定義書3.7・3.8）
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ tournamentId: string; categoryId: string; matchId: string }> },
) {
  const unauthorized = await requireWriteSession();
  if (unauthorized) return unauthorized;

  const { tournamentId, categoryId, matchId } = await params;
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

  const body = (await request.json()) as { sets?: SetScore[] };
  if (!Array.isArray(body.sets)) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'setsは配列で指定してください' } },
      { status: 400 },
    );
  }
  for (const set of body.sets) {
    for (const score of [set.scoreA, set.scoreB]) {
      if (score !== null && (score < 0 || score > 999)) {
        return NextResponse.json(
          { error: { code: 'VALIDATION_ERROR', message: '点数は0〜999の範囲で入力してください' } },
          { status: 400 },
        );
      }
    }
  }

  const match = saveMatchResult(categoryId, matchId, body.sets);
  if (!match) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: '試合が見つかりません' } },
      { status: 404 },
    );
  }
  return NextResponse.json({ data: match });
}
