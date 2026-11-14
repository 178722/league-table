'use client';

import { cn } from 'cn';
import { buildMatrixCell } from '@/lib/league-matrix';
import { formatRate } from '@/lib/format';
import type { Match, RankingMethod, StandingRow } from '@/types/domain';

export interface MatrixEntrant {
  id: string;
  name: string;
  affiliation?: string;
}

interface LeagueMatrixTableProps {
  entrants: MatrixEntrant[];
  matches: Match[];
  standings: StandingRow[];
  rankingMethod: RankingMethod;
  /** 指定するとマスのクリックで結果入力ダイアログを開けるようにする（A6のみ。P1は未指定で閲覧専用） */
  onCellClick?: (matchId: string) => void;
}

const STAT_COLUMN_COUNT = 9; // 試合・勝・分・負・セット率・得点・失点・得点率・順位（勝点は別途+1）
const FIXED_COLUMN_WIDTH = '6em'; // 全角6文字分で固定（選手(チーム)名列以外）
const NAME_COLUMN_WIDTH = '11em'; // 全角11文字分で固定

function EntrantLabel({ entrant }: { entrant: MatrixEntrant }) {
  return (
    <div className="flex flex-col items-center justify-center text-center">
      <span className="w-full truncate border-b border-dotted border-border pb-0.5 text-[11px] text-muted-foreground">
        {entrant.affiliation || ' '}
      </span>
      <span className="w-full truncate pt-0.5 font-medium">{entrant.name}</span>
    </div>
  );
}

// A6・P1共通：リーグ表（総当たり対戦表）と勝敗表（順位表）を1つのマス目にまとめた表
// 行・列の並び順はエントリー順で固定し、順位は列として表示するのみで行の並べ替えには使わない
export function LeagueMatrixTable({
  entrants,
  matches,
  standings,
  rankingMethod,
  onCellClick,
}: LeagueMatrixTableProps) {
  const standingByEntrantId = new Map(standings.map((row) => [row.entrantId, row]));
  const statColumnCount = STAT_COLUMN_COUNT + (rankingMethod === '勝点方式' ? 1 : 0);
  // 選手(チーム)名列（縦軸・横軸とも）は全角11文字分、それ以外（集計列・順位列）は全角6文字分で幅を固定する

  return (
    <div className="overflow-x-auto">
      <table className="border-collapse text-xs">
        <colgroup>
          <col style={{ width: NAME_COLUMN_WIDTH, minWidth: NAME_COLUMN_WIDTH }} />
          {entrants.map((entrant) => (
            <col
              key={entrant.id}
              style={{ width: NAME_COLUMN_WIDTH, minWidth: NAME_COLUMN_WIDTH }}
            />
          ))}
          {Array.from({ length: statColumnCount }, (_, i) => (
            <col key={i} style={{ width: FIXED_COLUMN_WIDTH, minWidth: FIXED_COLUMN_WIDTH }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th className="border bg-muted/50 p-1 text-center align-middle">選手(チーム)</th>
            {entrants.map((entrant) => (
              <th key={entrant.id} className="border bg-muted/50 p-1">
                <EntrantLabel entrant={entrant} />
              </th>
            ))}
            {['試合', '勝', '分', '負', 'セット率', '得点', '失点', '得点率'].map((label) => (
              <th key={label} className="border bg-muted/50 p-1">
                {label}
              </th>
            ))}
            {rankingMethod === '勝点方式' && <th className="border bg-muted/50 p-1">勝点</th>}
            <th className="border bg-muted/50 p-1">順位</th>
          </tr>
        </thead>
        <tbody>
          {entrants.map((rowEntrant) => {
            const standing = standingByEntrantId.get(rowEntrant.id);
            return (
              <tr key={rowEntrant.id}>
                <th className="border bg-muted/30 p-1 text-center align-middle">
                  <EntrantLabel entrant={rowEntrant} />
                </th>
                {entrants.map((columnEntrant) => {
                  if (columnEntrant.id === rowEntrant.id) {
                    return (
                      <td
                        key={columnEntrant.id}
                        className="border p-1"
                        style={{
                          backgroundImage:
                            'linear-gradient(to top right, transparent calc(50% - 1px), var(--border) calc(50% - 1px), var(--border) calc(50% + 1px), transparent calc(50% + 1px))',
                        }}
                      />
                    );
                  }
                  const cell = buildMatrixCell(matches, rowEntrant.id, columnEntrant.id);
                  const clickable = Boolean(onCellClick && cell);
                  return (
                    <td
                      key={columnEntrant.id}
                      onClick={clickable ? () => onCellClick!(cell!.matchId) : undefined}
                      className={cn(
                        'border p-1 text-center align-middle',
                        clickable && 'cursor-pointer hover:bg-muted/50',
                      )}
                    >
                      {cell ? (
                        <div className="flex items-center justify-center gap-2">
                          <span className="text-base font-semibold">{cell.mark}</span>
                          {cell.setLines.some((line) => line !== '-') && (
                            <div className="flex flex-col text-[10px] leading-tight whitespace-nowrap text-muted-foreground">
                              {cell.setLines
                                .filter((line) => line !== '-')
                                .map((line, i) => (
                                  <span key={i}>{line}</span>
                                ))}
                            </div>
                          )}
                          {cell.summary && (
                            <span className="text-base font-semibold italic underline">
                              {cell.summary}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">―</span>
                      )}
                    </td>
                  );
                })}
                <td className="border p-1 text-center">
                  {(standing?.wins ?? 0) + (standing?.draws ?? 0) + (standing?.losses ?? 0)}
                </td>
                <td className="border p-1 text-center">{standing?.wins ?? 0}</td>
                <td className="border p-1 text-center">{standing?.draws ?? 0}</td>
                <td className="border p-1 text-center">{standing?.losses ?? 0}</td>
                <td className="border p-1 text-center">
                  {standing ? formatRate(standing.setRate) : '-'}
                </td>
                <td className="border p-1 text-center">{standing?.pointsFor ?? '-'}</td>
                <td className="border p-1 text-center">{standing?.pointsAgainst ?? '-'}</td>
                <td className="border p-1 text-center">
                  {standing ? formatRate(standing.pointRate) : '-'}
                </td>
                {rankingMethod === '勝点方式' && (
                  <td className="border p-1 text-center">{standing?.points ?? '-'}</td>
                )}
                <td
                  className={cn(
                    'border p-1 text-center font-medium',
                    standing?.isTie && 'text-destructive',
                  )}
                >
                  {standing ? `${standing.rank}${standing.isTie ? '*' : ''}` : '-'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
