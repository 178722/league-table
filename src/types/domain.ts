// 画面仕様書・要件定義書・用語集に基づくドメイン型定義
// 本実装は画面構成・画面遷移の確認用であり、値はすべてモックデータ（lib/mock-data.ts）に由来する

export type TournamentStatus = '進行中' | '終了';

export interface Tournament {
  id: string;
  name: string;
  /** ISO 8601 (YYYY-MM-DD) */
  date: string;
  location: string;
  status: TournamentStatus;
}

export type CategoryKey = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J';

export type RankingMethod = '勝敗方式' | '勝点方式';

/** 独立リーグ：コート毎に別々の総当たり戦として扱う。単一リーグ：複数コートにまたがる1つの総当たり戦として扱う */
export type LeagueFormat = '独立リーグ' | '単一リーグ';

export interface CategorySettings {
  setCount: number;
  rankingMethod: RankingMethod;
  winPoints?: number;
  drawPoints?: number;
  losePoints?: number;
  courtCount: number;
  maxEntrantsPerCourt: number;
  leagueFormat: LeagueFormat;
}

export type GenerationStatus = '未生成' | '生成済み';

export interface Category {
  id: string;
  tournamentId: string;
  key: CategoryKey;
  name: string;
  enabled: boolean;
  settings: CategorySettings;
  generationStatus: GenerationStatus;
}

export type CourtSelection = '自動' | '手動';

export interface Entrant {
  id: string;
  tournamentId: string;
  categoryId: string;
  name: string;
  affiliation?: string;
  courtSelection?: CourtSelection;
  courtNumber?: number;
  hasResult: boolean;
  /** リーグ表・試合順の並び順（登録順ではなくリーグ表自動生成時にランダムに決定する。要件定義書3.4） */
  displayOrder?: number;
}

export type MatchResultStatus = '未入力' | '入力済み';

export interface SetScore {
  scoreA: number | null;
  scoreB: number | null;
}

export interface Match {
  id: string;
  categoryId: string;
  courtNumber: number;
  order: number;
  entrantAId: string;
  entrantBId: string;
  /** 対戦者以外に候補がいない場合（参加者2名のみ等）はnull（未割当） */
  refereeEntrantId: string | null;
  sets: SetScore[];
  status: MatchResultStatus;
}

export interface StandingRow {
  entrantId: string;
  rank: number;
  isTie: boolean;
  wins: number;
  draws: number;
  losses: number;
  setsWon: number;
  setsLost: number;
  /** セット率＝得セット数÷失セット数。失セット数0かつ得セット数>0の場合はInfinity（表示は「MAX」） */
  setRate: number;
  pointsFor: number;
  pointsAgainst: number;
  /** 得点率＝得点÷失点。失点0かつ得点>0の場合はInfinity（表示は「MAX」） */
  pointRate: number;
  points?: number;
  jankenPending?: boolean;
}

export interface BackupRecord {
  id: string;
  createdAt: string;
  trigger: '手動' | 'ログアウト';
}

export interface AdminAuth {
  id: string;
  /** bcryptでハッシュ化したパスワード */
  passwordHash: string;
}
