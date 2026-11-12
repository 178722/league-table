// ファイルバックエンドのインメモリ相当データストア（本番採用の永続化方式）
// Next.jsの開発/本番サーバーはRoute HandlerとServer Componentで別のモジュールインスタンス
// （別ワーカー）になり得るため、プロセスメモリ上のモジュール変数だけでは状態を共有できない。
// そのため、JSONファイル（.data/store.json）を単純な「疑似DB」として読み書きする。

import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import type {
  AdminAuth,
  BackupRecord,
  Category,
  Entrant,
  Match,
  StandingRow,
  Tournament,
} from '@/types/domain';

export type SessionRole = 'admin' | 'viewer';

export interface Session {
  token: string;
  role: SessionRole;
}

export interface Store {
  auth: AdminAuth;
  session: Session | null;
  tournaments: Tournament[];
  categories: Category[];
  entrants: Entrant[];
  matches: Match[];
  standings: Record<string, StandingRow[]>;
  backups: BackupRecord[];
}

// LEAGUE_TABLE_DATA_DIR未設定時は従来通りprocess.cwd()基準（開発・テスト用）。
// Electron版は起動時にOS標準のユーザーデータディレクトリをこの環境変数に設定する。
const DATA_DIR = process.env.LEAGUE_TABLE_DATA_DIR
  ? path.join(process.env.LEAGUE_TABLE_DATA_DIR, '.data')
  : path.join(process.cwd(), '.data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');
export const BACKUPS_DIR = path.join(DATA_DIR, 'backups');

function seed(): Store {
  return {
    auth: {
      id: 'TakunishiSC',
      passwordHash: bcrypt.hashSync('0962778801', 10),
    },
    session: null,
    tournaments: [
      {
        id: 'volleyball',
        name: 'バレーボール大会',
        date: '2026-11-09',
        location: '体育館',
        status: '進行中',
      },
      {
        id: 'table-tennis',
        name: '卓球大会',
        date: '2026-12-01',
        location: '第二体育館',
        status: '終了',
      },
    ],
    categories: [
      {
        id: 'volleyball-A',
        tournamentId: 'volleyball',
        key: 'A',
        name: 'フリー',
        enabled: true,
        generationStatus: '生成済み',
        settings: {
          setCount: 2,
          rankingMethod: '勝点方式',
          winPoints: 3,
          drawPoints: 1,
          losePoints: 0,
          courtCount: 1,
          maxEntrantsPerCourt: 5,
          leagueFormat: '独立リーグ',
        },
      },
      {
        id: 'volleyball-B',
        tournamentId: 'volleyball',
        key: 'B',
        name: '初級',
        enabled: true,
        generationStatus: '未生成',
        settings: { setCount: 3, rankingMethod: '勝敗方式', courtCount: 1, maxEntrantsPerCourt: 5, leagueFormat: '独立リーグ' },
      },
      {
        id: 'volleyball-C',
        tournamentId: 'volleyball',
        key: 'C',
        name: '上級',
        enabled: true,
        generationStatus: '生成済み',
        settings: { setCount: 3, rankingMethod: '勝敗方式', courtCount: 2, maxEntrantsPerCourt: 5, leagueFormat: '独立リーグ' },
      },
      {
        id: 'table-tennis-A',
        tournamentId: 'table-tennis',
        key: 'A',
        name: 'シングルス',
        enabled: true,
        generationStatus: '生成済み',
        settings: { setCount: 1, rankingMethod: '勝敗方式', courtCount: 1, maxEntrantsPerCourt: 5, leagueFormat: '独立リーグ' },
      },
    ],
    entrants: [
      {
        id: 'vb-a-1',
        tournamentId: 'volleyball',
        categoryId: 'volleyball-A',
        name: 'Aチーム',
        affiliation: '熊本',
        hasResult: true,
      },
      {
        id: 'vb-a-2',
        tournamentId: 'volleyball',
        categoryId: 'volleyball-A',
        name: 'Bチーム',
        hasResult: true,
      },
      {
        id: 'vb-a-3',
        tournamentId: 'volleyball',
        categoryId: 'volleyball-A',
        name: 'Cチーム',
        affiliation: '福岡',
        hasResult: true,
      },

      {
        id: 'vb-b-1',
        tournamentId: 'volleyball',
        categoryId: 'volleyball-B',
        name: '田中',
        affiliation: '熊本',
        hasResult: false,
      },
      {
        id: 'vb-b-2',
        tournamentId: 'volleyball',
        categoryId: 'volleyball-B',
        name: '佐藤',
        hasResult: false,
      },
      {
        id: 'vb-b-3',
        tournamentId: 'volleyball',
        categoryId: 'volleyball-B',
        name: '鈴木',
        affiliation: '福岡',
        hasResult: false,
      },
      {
        id: 'vb-b-4',
        tournamentId: 'volleyball',
        categoryId: 'volleyball-B',
        name: '高橋',
        hasResult: false,
      },
      {
        id: 'vb-b-5',
        tournamentId: 'volleyball',
        categoryId: 'volleyball-B',
        name: '伊藤',
        affiliation: '熊本',
        hasResult: false,
      },
      {
        id: 'vb-b-6',
        tournamentId: 'volleyball',
        categoryId: 'volleyball-B',
        name: '渡辺',
        hasResult: false,
      },

      {
        id: 'vb-c-1',
        tournamentId: 'volleyball',
        categoryId: 'volleyball-C',
        name: 'Dチーム',
        courtSelection: '手動',
        courtNumber: 1,
        hasResult: true,
      },
      {
        id: 'vb-c-2',
        tournamentId: 'volleyball',
        categoryId: 'volleyball-C',
        name: 'Eチーム',
        affiliation: '熊本',
        courtSelection: '手動',
        courtNumber: 1,
        hasResult: true,
      },
      {
        id: 'vb-c-3',
        tournamentId: 'volleyball',
        categoryId: 'volleyball-C',
        name: 'Fチーム',
        courtSelection: '自動',
        courtNumber: 1,
        hasResult: true,
      },
      {
        id: 'vb-c-4',
        tournamentId: 'volleyball',
        categoryId: 'volleyball-C',
        name: 'Gチーム',
        affiliation: '福岡',
        courtSelection: '手動',
        courtNumber: 2,
        hasResult: true,
      },
      {
        id: 'vb-c-5',
        tournamentId: 'volleyball',
        categoryId: 'volleyball-C',
        name: 'Hチーム',
        courtSelection: '自動',
        courtNumber: 2,
        hasResult: true,
      },
      {
        id: 'vb-c-6',
        tournamentId: 'volleyball',
        categoryId: 'volleyball-C',
        name: 'Iチーム',
        affiliation: '熊本',
        courtSelection: '自動',
        courtNumber: 2,
        hasResult: true,
      },

      {
        id: 'tt-a-1',
        tournamentId: 'table-tennis',
        categoryId: 'table-tennis-A',
        name: 'Xさん',
        affiliation: '熊本',
        hasResult: true,
      },
      {
        id: 'tt-a-2',
        tournamentId: 'table-tennis',
        categoryId: 'table-tennis-A',
        name: 'Yさん',
        hasResult: true,
      },
      {
        id: 'tt-a-3',
        tournamentId: 'table-tennis',
        categoryId: 'table-tennis-A',
        name: 'Zさん',
        affiliation: '福岡',
        hasResult: true,
      },
    ],
    matches: [
      {
        id: 'vb-a-m1',
        categoryId: 'volleyball-A',
        courtNumber: 1,
        order: 1,
        entrantAId: 'vb-a-1',
        entrantBId: 'vb-a-2',
        refereeEntrantId: 'vb-a-3',
        sets: [
          { scoreA: 25, scoreB: 20 },
          { scoreA: 25, scoreB: 18 },
        ],
        status: '入力済み',
      },
      {
        id: 'vb-a-m2',
        categoryId: 'volleyball-A',
        courtNumber: 1,
        order: 2,
        entrantAId: 'vb-a-1',
        entrantBId: 'vb-a-3',
        refereeEntrantId: 'vb-a-2',
        sets: [
          { scoreA: 20, scoreB: 25 },
          { scoreA: 25, scoreB: 20 },
        ],
        status: '入力済み',
      },
      {
        id: 'vb-a-m3',
        categoryId: 'volleyball-A',
        courtNumber: 1,
        order: 3,
        entrantAId: 'vb-a-2',
        entrantBId: 'vb-a-3',
        refereeEntrantId: 'vb-a-1',
        sets: [
          { scoreA: null, scoreB: null },
          { scoreA: null, scoreB: null },
        ],
        status: '未入力',
      },
      {
        id: 'vb-c-m1',
        categoryId: 'volleyball-C',
        courtNumber: 1,
        order: 1,
        entrantAId: 'vb-c-1',
        entrantBId: 'vb-c-2',
        refereeEntrantId: 'vb-c-3',
        sets: [
          { scoreA: 25, scoreB: 15 },
          { scoreA: 25, scoreB: 18 },
          { scoreA: null, scoreB: null },
        ],
        status: '入力済み',
      },
      {
        id: 'vb-c-m2',
        categoryId: 'volleyball-C',
        courtNumber: 1,
        order: 2,
        entrantAId: 'vb-c-1',
        entrantBId: 'vb-c-3',
        refereeEntrantId: 'vb-c-2',
        sets: [
          { scoreA: 25, scoreB: 10 },
          { scoreA: 25, scoreB: 12 },
          { scoreA: null, scoreB: null },
        ],
        status: '入力済み',
      },
      {
        id: 'vb-c-m3',
        categoryId: 'volleyball-C',
        courtNumber: 1,
        order: 3,
        entrantAId: 'vb-c-2',
        entrantBId: 'vb-c-3',
        refereeEntrantId: 'vb-c-1',
        sets: [
          { scoreA: 25, scoreB: 20 },
          { scoreA: 18, scoreB: 25 },
          { scoreA: 25, scoreB: 22 },
        ],
        status: '入力済み',
      },
      {
        id: 'vb-c-m4',
        categoryId: 'volleyball-C',
        courtNumber: 2,
        order: 1,
        entrantAId: 'vb-c-4',
        entrantBId: 'vb-c-5',
        refereeEntrantId: 'vb-c-6',
        sets: [
          { scoreA: 25, scoreB: 16 },
          { scoreA: 25, scoreB: 19 },
          { scoreA: null, scoreB: null },
        ],
        status: '入力済み',
      },
      {
        id: 'vb-c-m5',
        categoryId: 'volleyball-C',
        courtNumber: 2,
        order: 2,
        entrantAId: 'vb-c-4',
        entrantBId: 'vb-c-6',
        refereeEntrantId: 'vb-c-5',
        sets: [
          { scoreA: 25, scoreB: 14 },
          { scoreA: 25, scoreB: 17 },
          { scoreA: null, scoreB: null },
        ],
        status: '入力済み',
      },
      {
        id: 'vb-c-m6',
        categoryId: 'volleyball-C',
        courtNumber: 2,
        order: 3,
        entrantAId: 'vb-c-5',
        entrantBId: 'vb-c-6',
        refereeEntrantId: 'vb-c-4',
        sets: [
          { scoreA: 25, scoreB: 21 },
          { scoreA: 20, scoreB: 25 },
          { scoreA: 25, scoreB: 23 },
        ],
        status: '入力済み',
      },
      {
        id: 'tt-a-m1',
        categoryId: 'table-tennis-A',
        courtNumber: 1,
        order: 1,
        entrantAId: 'tt-a-1',
        entrantBId: 'tt-a-2',
        refereeEntrantId: 'tt-a-3',
        sets: [{ scoreA: 15, scoreB: 14 }],
        status: '入力済み',
      },
      {
        id: 'tt-a-m2',
        categoryId: 'table-tennis-A',
        courtNumber: 1,
        order: 2,
        entrantAId: 'tt-a-1',
        entrantBId: 'tt-a-3',
        refereeEntrantId: 'tt-a-2',
        sets: [{ scoreA: 20, scoreB: 20 }],
        status: '入力済み',
      },
      {
        id: 'tt-a-m3',
        categoryId: 'table-tennis-A',
        courtNumber: 1,
        order: 3,
        entrantAId: 'tt-a-2',
        entrantBId: 'tt-a-3',
        refereeEntrantId: 'tt-a-1',
        sets: [{ scoreA: null, scoreB: null }],
        status: '未入力',
      },
    ],
    standings: {
      'volleyball-A:1': [
        {
          entrantId: 'vb-a-1',
          rank: 1,
          isTie: false,
          wins: 2,
          draws: 0,
          losses: 0,
          setsWon: 4,
          setsLost: 0,
          setRate: Infinity,
          pointsFor: 100,
          pointsAgainst: 90,
          pointRate: 100 / 90,
          points: 6,
        },
        {
          entrantId: 'vb-a-2',
          rank: 2,
          isTie: true,
          wins: 1,
          draws: 0,
          losses: 1,
          setsWon: 2,
          setsLost: 2,
          setRate: 2 / 2,
          pointsFor: 92,
          pointsAgainst: 90,
          pointRate: 92 / 90,
          points: 3,
          jankenPending: true,
        },
        {
          entrantId: 'vb-a-3',
          rank: 2,
          isTie: true,
          wins: 1,
          draws: 0,
          losses: 1,
          setsWon: 2,
          setsLost: 2,
          setRate: 2 / 2,
          pointsFor: 92,
          pointsAgainst: 90,
          pointRate: 92 / 90,
          points: 3,
          jankenPending: true,
        },
      ],
      'volleyball-C:1': [
        {
          entrantId: 'vb-c-1',
          rank: 1,
          isTie: false,
          wins: 2,
          draws: 0,
          losses: 0,
          setsWon: 4,
          setsLost: 0,
          setRate: Infinity,
          pointsFor: 100,
          pointsAgainst: 68,
          pointRate: 100 / 68,
        },
        {
          entrantId: 'vb-c-2',
          rank: 2,
          isTie: false,
          wins: 1,
          draws: 0,
          losses: 1,
          setsWon: 2,
          setsLost: 3,
          setRate: 2 / 3,
          pointsFor: 120,
          pointsAgainst: 122,
          pointRate: 120 / 122,
        },
        {
          entrantId: 'vb-c-3',
          rank: 3,
          isTie: false,
          wins: 0,
          draws: 0,
          losses: 2,
          setsWon: 0,
          setsLost: 5,
          setRate: 0 / 5,
          pointsFor: 90,
          pointsAgainst: 120,
          pointRate: 90 / 120,
        },
      ],
      'volleyball-C:2': [
        {
          entrantId: 'vb-c-4',
          rank: 1,
          isTie: false,
          wins: 2,
          draws: 0,
          losses: 0,
          setsWon: 4,
          setsLost: 0,
          setRate: Infinity,
          pointsFor: 96,
          pointsAgainst: 66,
          pointRate: 96 / 66,
        },
        {
          entrantId: 'vb-c-5',
          rank: 2,
          isTie: false,
          wins: 1,
          draws: 0,
          losses: 1,
          setsWon: 2,
          setsLost: 3,
          setRate: 2 / 3,
          pointsFor: 115,
          pointsAgainst: 118,
          pointRate: 115 / 118,
        },
        {
          entrantId: 'vb-c-6',
          rank: 3,
          isTie: false,
          wins: 0,
          draws: 0,
          losses: 2,
          setsWon: 0,
          setsLost: 5,
          setRate: 0 / 5,
          pointsFor: 85,
          pointsAgainst: 110,
          pointRate: 85 / 110,
        },
      ],
      'table-tennis-A:1': [
        {
          entrantId: 'tt-a-1',
          rank: 1,
          isTie: false,
          wins: 1,
          draws: 1,
          losses: 0,
          setsWon: 3,
          setsLost: 1,
          setRate: 3 / 1,
          pointsFor: 35,
          pointsAgainst: 24,
          pointRate: 35 / 24,
        },
        {
          entrantId: 'tt-a-2',
          rank: 2,
          isTie: true,
          wins: 0,
          draws: 0,
          losses: 1,
          setsWon: 1,
          setsLost: 3,
          setRate: 1 / 3,
          pointsFor: 14,
          pointsAgainst: 15,
          pointRate: 14 / 15,
        },
        {
          entrantId: 'tt-a-3',
          rank: 2,
          isTie: true,
          wins: 0,
          draws: 1,
          losses: 0,
          setsWon: 2,
          setsLost: 2,
          setRate: 2 / 2,
          pointsFor: 20,
          pointsAgainst: 20,
          pointRate: 20 / 20,
        },
      ],
    },
    // バックアップ履歴は空で開始する（実体のJSONファイルを伴わないダミー履歴は、
    // 選択しても復元に失敗する紛らわしい状態になるため seed しない）
    backups: [],
  };
}

export function loadStore(): Store {
  if (!fs.existsSync(STORE_PATH)) {
    const initial = seed();
    saveStore(initial);
    return initial;
  }
  return JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8')) as Store;
}

export function saveStore(store: Store): void {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf-8');
}

export function ensureBackupsDir(): void {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}
