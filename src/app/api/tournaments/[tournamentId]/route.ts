import { NextResponse } from 'next/server';
import { deleteTournament, getTournament, updateTournament } from '@/lib/mock-data';
import { requireWriteSession } from '@/lib/require-session';
import type { CategoryKey } from '@/types/domain';

interface UpdateTournamentBody {
  name: string;
  date: string;
  location: string;
  categories: Array<{ key: CategoryKey; name: string; enabled: boolean }>;
}

// PUT /api/tournaments/:id
// 大会情報（大会名・開催日・開催場所・カテゴリA〜J）を更新する
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
  if (tournament.status === '終了') {
    return NextResponse.json(
      { error: { code: 'TOURNAMENT_FINISHED', message: '大会が終了しているため変更できません' } },
      { status: 409 },
    );
  }

  const body = (await request.json()) as Partial<UpdateTournamentBody>;
  if (!body.name || !body.date || !body.location || !body.categories) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: '大会名・開催日・開催場所・カテゴリは必須です',
        },
      },
      { status: 400 },
    );
  }

  const result = updateTournament(tournamentId, {
    name: body.name,
    date: body.date,
    location: body.location,
    categories: body.categories,
  });
  if (!result.ok) {
    const status =
      result.code === 'NOT_FOUND' ? 404 : result.code === 'TOURNAMENT_FINISHED' ? 409 : 400;
    const message =
      result.message ??
      (result.code === 'NOT_FOUND'
        ? '大会が見つかりません'
        : '大会が終了しているため変更できません');
    return NextResponse.json({ error: { code: result.code, message } }, { status });
  }
  return NextResponse.json({ data: result.tournament });
}

// DELETE /api/tournaments/:id
// 大会を削除する（カスケード削除、要件定義書2.1）
export async function DELETE(
  _request: Request,
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

  deleteTournament(tournamentId);
  return NextResponse.json({ data: { id: tournamentId } });
}
