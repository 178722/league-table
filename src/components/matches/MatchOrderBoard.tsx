'use client';

import { Fragment } from 'react';
import { Button } from '@/components/ui/button';
import type { Match } from '@/types/domain';

const ORDER_COLUMN_WIDTH = '6em'; // 全角6文字分で固定
const MATCHUP_COLUMN_WIDTH = '25em'; // 全角25文字分で固定
const SEPARATOR_WIDTH = '2em'; // 対戦カードの"-"部分。文字数に関係なく中央固定
const MATCHUP_SIDE_WIDTH = `calc((${MATCHUP_COLUMN_WIDTH} - ${SEPARATOR_WIDTH}) / 2)`;
const REFEREE_COLUMN_WIDTH = '11em'; // 全角11文字分で固定
const RESULT_COLUMN_WIDTH = '10em'; // 「入力済」「削除」の2ボタンが横並びで改行なく収まる幅

interface MatchOrderBoardProps {
  matches: Match[];
  entrantLabels: Map<string, string>;
  onRowClick: (matchId: string) => void;
  onDeleteResult: (matchId: string) => void;
  disabled: boolean;
  /** 単一リーグの場合、コート毎に別の表に分けて表示する（同一試合順＝同時進行の試合は横に並べる） */
  splitByCourt?: boolean;
}

interface MatchRowProps {
  slot: number;
  match: Match | null;
  entrantLabels: Map<string, string>;
  onRowClick: (matchId: string) => void;
  onDeleteResult: (matchId: string) => void;
  disabled: boolean;
}

interface MatchCellsProps {
  match: Match | null;
  entrantLabels: Map<string, string>;
  onRowClick: (matchId: string) => void;
  onDeleteResult: (matchId: string) => void;
  disabled: boolean;
}

// 対戦カード・審判・結果の3セル分（コート1つ分）。試合がない場合は「―」で埋める
function MatchCells({ match, entrantLabels, onRowClick, onDeleteResult, disabled }: MatchCellsProps) {
  if (!match) {
    return (
      <>
        <td className="border p-1 align-middle whitespace-nowrap text-muted-foreground">
          <div className="flex items-center justify-center">―</div>
        </td>
        <td className="border p-1 text-center align-middle whitespace-nowrap text-muted-foreground">
          ―
        </td>
        <td className="border p-1 text-center align-middle whitespace-nowrap text-muted-foreground">
          ―
        </td>
      </>
    );
  }

  return (
    <>
      <td
        onClick={() => onRowClick(match.id)}
        className="border p-1 align-middle whitespace-nowrap cursor-pointer hover:bg-muted/50"
      >
        <div className="flex items-center justify-center">
          <span style={{ width: MATCHUP_SIDE_WIDTH }} className="truncate text-center">
            {entrantLabels.get(match.entrantAId)}
          </span>
          <span style={{ width: SEPARATOR_WIDTH }} className="shrink-0 text-center">
            {' - '}
          </span>
          <span style={{ width: MATCHUP_SIDE_WIDTH }} className="truncate text-center">
            {entrantLabels.get(match.entrantBId)}
          </span>
        </div>
      </td>
      <td
        onClick={() => onRowClick(match.id)}
        className="border p-1 text-center align-middle whitespace-nowrap cursor-pointer hover:bg-muted/50"
      >
        {match.refereeEntrantId ? (
          entrantLabels.get(match.refereeEntrantId)
        ) : (
          <span className="font-semibold text-red-600">運営スタッフ</span>
        )}
      </td>
      <td className="border p-1 text-center align-middle whitespace-nowrap">
        {match.status === '入力済み' ? (
          <div className="flex items-center justify-center gap-1">
            <Button
              type="button"
              size="sm"
              variant="default"
              disabled={disabled}
              onClick={() => onRowClick(match.id)}
            >
              入力済
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled}
              onClick={() => onDeleteResult(match.id)}
            >
              削除
            </Button>
          </div>
        ) : (
          <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => onRowClick(match.id)}>
            未入力
          </Button>
        )}
      </td>
    </>
  );
}

function MatchRow({ slot, match, entrantLabels, onRowClick, onDeleteResult, disabled }: MatchRowProps) {
  return (
    <tr>
      <td className="border p-1 text-center align-middle whitespace-nowrap">{slot}</td>
      <MatchCells
        match={match}
        entrantLabels={entrantLabels}
        onRowClick={onRowClick}
        onDeleteResult={onDeleteResult}
        disabled={disabled}
      />
    </tr>
  );
}

interface MatchOrderTableProps {
  rows: Array<{ slot: number; match: Match | null }>;
  entrantLabels: Map<string, string>;
  onRowClick: (matchId: string) => void;
  onDeleteResult: (matchId: string) => void;
  disabled: boolean;
}

function MatchOrderTable({
  rows,
  entrantLabels,
  onRowClick,
  onDeleteResult,
  disabled,
}: MatchOrderTableProps) {
  return (
    <table className="table-fixed border-collapse text-sm">
      <colgroup>
        <col style={{ width: ORDER_COLUMN_WIDTH }} />
        <col style={{ width: MATCHUP_COLUMN_WIDTH }} />
        <col style={{ width: REFEREE_COLUMN_WIDTH }} />
        <col style={{ width: RESULT_COLUMN_WIDTH }} />
      </colgroup>
      <thead>
        <tr>
          <th className="border bg-muted/50 p-1 text-center whitespace-nowrap">試合順</th>
          <th className="border bg-muted/50 p-1 text-center whitespace-nowrap">対戦カード</th>
          <th className="border bg-muted/50 p-1 text-center whitespace-nowrap">審判</th>
          <th className="border bg-muted/50 p-1 text-center whitespace-nowrap">結果</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ slot, match }) => (
          <MatchRow
            key={match?.id ?? `blank-${slot}`}
            slot={slot}
            match={match}
            entrantLabels={entrantLabels}
            onRowClick={onRowClick}
            onDeleteResult={onDeleteResult}
            disabled={disabled}
          />
        ))}
      </tbody>
    </table>
  );
}

interface CourtMatchOrderTableProps {
  courts: number[];
  rows: Array<{ slot: number; byCourt: Map<number, Match | null> }>;
  entrantLabels: Map<string, string>;
  onRowClick: (matchId: string) => void;
  onDeleteResult: (matchId: string) => void;
  disabled: boolean;
}

// 単一リーグ・複数コート用の試合順表。試合順列を共有し、コートごとに対戦カード／審判／結果をまとめて横に並べる
function CourtMatchOrderTable({
  courts,
  rows,
  entrantLabels,
  onRowClick,
  onDeleteResult,
  disabled,
}: CourtMatchOrderTableProps) {
  return (
    <table className="table-fixed border-collapse text-sm">
      <colgroup>
        <col style={{ width: ORDER_COLUMN_WIDTH }} />
        {courts.map((court) => (
          <Fragment key={court}>
            <col style={{ width: MATCHUP_COLUMN_WIDTH }} />
            <col style={{ width: REFEREE_COLUMN_WIDTH }} />
            <col style={{ width: RESULT_COLUMN_WIDTH }} />
          </Fragment>
        ))}
      </colgroup>
      <thead>
        <tr>
          <th
            className="border bg-muted/50"
            style={{
              backgroundImage:
                'linear-gradient(to top right, transparent calc(50% - 1px), var(--border) calc(50% - 1px), var(--border) calc(50% + 1px), transparent calc(50% + 1px))',
            }}
          />
          {courts.map((court) => (
            <th key={court} colSpan={3} className="border bg-muted/50 p-1 text-center whitespace-nowrap">
              コート{court}
            </th>
          ))}
        </tr>
        <tr>
          <th className="border bg-muted/50 p-1 text-center whitespace-nowrap">試合順</th>
          {courts.map((court) => (
            <Fragment key={court}>
              <th className="border bg-muted/50 p-1 text-center whitespace-nowrap">対戦カード</th>
              <th className="border bg-muted/50 p-1 text-center whitespace-nowrap">審判</th>
              <th className="border bg-muted/50 p-1 text-center whitespace-nowrap">結果</th>
            </Fragment>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map(({ slot, byCourt }) => (
          <tr key={slot}>
            <td className="border p-1 text-center align-middle whitespace-nowrap">{slot}</td>
            {courts.map((court) => (
              <MatchCells
                key={court}
                match={byCourt.get(court) ?? null}
                entrantLabels={entrantLabels}
                onRowClick={onRowClick}
                onDeleteResult={onDeleteResult}
                disabled={disabled}
              />
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// A6の試合順表。全試合を1つの表にまとめて表示する（列分割は行わない）
// 単一リーグの場合は1つの表の中でコート毎に対戦カード／審判／結果をまとめ、試合順列を共有する
export function MatchOrderBoard({
  matches,
  entrantLabels,
  onRowClick,
  onDeleteResult,
  disabled,
  splitByCourt,
}: MatchOrderBoardProps) {
  if (splitByCourt) {
    const courts = [...new Set(matches.map((m) => m.courtNumber))].sort((a, b) => a - b);
    const maxSlot = matches.reduce((max, m) => Math.max(max, m.order), 0);
    const matchByCourtSlot = new Map<string, Match>();
    for (const m of matches) matchByCourtSlot.set(`${m.courtNumber}:${m.order}`, m);
    const slots = Array.from({ length: maxSlot }, (_, i) => i + 1);

    return (
      <div className="overflow-x-auto">
        <CourtMatchOrderTable
          courts={courts}
          rows={slots.map((slot) => ({
            slot,
            byCourt: new Map(courts.map((court) => [court, matchByCourtSlot.get(`${court}:${slot}`) ?? null])),
          }))}
          entrantLabels={entrantLabels}
          onRowClick={onRowClick}
          onDeleteResult={onDeleteResult}
          disabled={disabled}
        />
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <MatchOrderTable
        rows={matches.map((m) => ({ slot: m.order, match: m }))}
        entrantLabels={entrantLabels}
        onRowClick={onRowClick}
        onDeleteResult={onDeleteResult}
        disabled={disabled}
      />
    </div>
  );
}
