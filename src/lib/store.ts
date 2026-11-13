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
    tournaments: [],
    categories: [],
    entrants: [],
    matches: [],
    standings: {},
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
