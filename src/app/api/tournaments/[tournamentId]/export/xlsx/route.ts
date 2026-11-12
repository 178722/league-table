import { NextResponse } from 'next/server';
import { buildExportFileName, buildTournamentWorkbook } from '@/lib/export';
import { getTournament } from '@/lib/mock-data';
import { requireSession } from '@/lib/require-session';

// GET /api/tournaments/:id/export/xlsx：大会全体のデータをExcel（.xlsx）としてまとめて出力する（要件定義書3.9）
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tournamentId: string }> },
) {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  const { tournamentId } = await params;
  if (!getTournament(tournamentId)) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: '大会が見つかりません' } },
      { status: 404 },
    );
  }

  let buffer: Awaited<ReturnType<typeof buildTournamentWorkbook>>;
  try {
    buffer = await buildTournamentWorkbook(tournamentId);
  } catch (error) {
    console.error('データ出力に失敗しました', error);
    const message = error instanceof Error ? error.message : 'データ出力に失敗しました';
    return NextResponse.json(
      { error: { code: 'EXPORT_FAILED', message } },
      { status: 500 },
    );
  }
  const fileName = encodeURIComponent(buildExportFileName(tournamentId));

  return new NextResponse(new Blob([buffer as unknown as BlobPart]), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${fileName}`,
    },
  });
}
