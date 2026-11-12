import { NextResponse } from 'next/server';
import { getTournament, setTournamentStatus } from '@/lib/mock-data';
import { requireWriteSession } from '@/lib/require-session';
import type { TournamentStatus } from '@/types/domain';

// PUT /api/tournaments/:id/status
// 大会ステータス（進行中/終了）を切り替える
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ tournamentId: string }> },
) {
  const unauthorized = await requireWriteSession();
  if (unauthorized) return unauthorized;

  const { tournamentId } = await params;
  const tournament = getTournament(tournamentId);
  if (!tournament) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: '大会が見つかりません' } },
      { status: 404 },
    );
  }

  const body = (await request.json()) as { status?: TournamentStatus };
  if (body.status !== '進行中' && body.status !== '終了') {
    return NextResponse.json(
      {
        error: { code: 'VALIDATION_ERROR', message: 'statusは進行中または終了を指定してください' },
      },
      { status: 400 },
    );
  }

  const updated = setTournamentStatus(tournamentId, body.status);
  return NextResponse.json({ data: updated });
}
