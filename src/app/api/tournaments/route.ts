import { NextResponse } from 'next/server';
import { createTournament } from '@/lib/mock-data';
import { requireWriteSession } from '@/lib/require-session';
import type { CategoryKey } from '@/types/domain';

interface CreateTournamentBody {
  name: string;
  date: string;
  location: string;
  categories: Array<{ key: CategoryKey; name: string }>;
}

// POST /api/tournaments
// 大会を新規作成する（要件定義書3.1）
export async function POST(request: Request) {
  const unauthorized = await requireWriteSession();
  if (unauthorized) return unauthorized;

  const body = (await request.json()) as Partial<CreateTournamentBody>;

  if (!body.name || !body.date || !body.location || !body.categories?.length) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: '大会名・開催日・開催場所・カテゴリAは必須です',
        },
      },
      { status: 400 },
    );
  }

  const result = createTournament({
    name: body.name,
    date: body.date,
    location: body.location,
    categories: body.categories,
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: result.message } },
      { status: 400 },
    );
  }

  return NextResponse.json({ data: result.tournament }, { status: 201 });
}
