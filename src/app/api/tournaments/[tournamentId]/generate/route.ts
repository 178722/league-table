import { NextResponse } from 'next/server';
import {
  generateForTournament,
  generateSelected,
  getTournament,
  type GenerateTarget,
} from '@/lib/mock-data';
import { requireWriteSession } from '@/lib/require-session';

// POST /api/tournaments/:id/generate
// 大会内のリーグ表・試合順・審判順を生成する（要件定義書3.4〜3.6）
// body省略時は全有効カテゴリを対象、{ targets: [{categoryId, courts?}] } 指定時はその組合せのみを対象にする
export async function POST(
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
      { error: { code: 'TOURNAMENT_FINISHED', message: '大会が終了しているため生成できません' } },
      { status: 409 },
    );
  }

  // bodyの省略（空文字）は「全有効カテゴリが対象」という仕様上の既定値として扱うが、
  // 空でない不正なJSON（通信エラー等での破損）まで同じ既定値にフォールバックすると、
  // 一部カテゴリのみを選択したはずの生成が気づかれずに全カテゴリ生成へすり替わる
  // （選択していないカテゴリの既存データを意図せず上書きする）危険があるため区別する
  const rawBody = await request.text();
  let body: { targets?: GenerateTarget[] } | null = null;
  if (rawBody) {
    try {
      body = JSON.parse(rawBody) as { targets?: GenerateTarget[] };
    } catch {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'リクエスト内容を読み取れませんでした。もう一度お試しください' } },
        { status: 400 },
      );
    }
  }

  const result =
    body?.targets && body.targets.length > 0
      ? generateSelected(tournamentId, body.targets)
      : generateForTournament(tournamentId);

  return NextResponse.json({ data: result });
}
