import fs from 'node:fs';
import path from 'node:path';
import { BACKUPS_DIR, ensureBackupsDir, loadStore, saveStore, type Store } from '@/lib/store';
import type { BackupRecord } from '@/types/domain';

/** バックアップ保持数の上限。超過分は古いものから削除する */
const MAX_BACKUPS = 20;

/** 全データをJSONファイルへエクスポートし、バックアップ履歴に追加する（要件定義書4章） */
export function createBackup(trigger: BackupRecord['trigger']): BackupRecord {
  const store = loadStore();
  ensureBackupsDir();

  const id = `bk-${crypto.randomUUID()}`;
  const fileName = `${id}.json`;
  // バックアップ対象は認証情報・セッションを除く業務データ一式
  const snapshot: Omit<Store, 'auth' | 'session'> = {
    tournaments: store.tournaments,
    categories: store.categories,
    entrants: store.entrants,
    matches: store.matches,
    standings: store.standings,
    backups: store.backups,
  };
  fs.writeFileSync(path.join(BACKUPS_DIR, fileName), JSON.stringify(snapshot, null, 2), 'utf-8');

  const record: BackupRecord = {
    id,
    createdAt: new Date().toISOString(),
    trigger,
  };
  store.backups.unshift(record);

  // 保持数の上限（20件）を超えた古いバックアップは履歴・ファイルの両方から削除する
  const excess = store.backups.splice(MAX_BACKUPS);
  for (const old of excess) {
    const oldFilePath = path.join(BACKUPS_DIR, `${old.id}.json`);
    if (fs.existsSync(oldFilePath)) fs.unlinkSync(oldFilePath);
  }

  saveStore(store);
  return record;
}

export function getBackupFilePath(backupId: string): string | undefined {
  const filePath = path.join(BACKUPS_DIR, `${backupId}.json`);
  return fs.existsSync(filePath) ? filePath : undefined;
}

/**
 * 選択されたバックアップのJSONで業務データ一式を上書きする（認証情報・セッションは保持する）。
 * バックアップ履歴（backups）はスナップショット時点のものに巻き戻さず、常に現在の履歴を維持する
 * （そうしないと、復元した時点より後に作成されたバックアップが選択肢から消えてしまうため）
 */
export function restoreFromSnapshot(snapshot: Omit<Store, 'auth' | 'session'>): void {
  const store = loadStore();
  const restored: Store = {
    ...store,
    tournaments: snapshot.tournaments,
    categories: snapshot.categories,
    entrants: snapshot.entrants,
    matches: snapshot.matches,
    standings: snapshot.standings,
  };
  saveStore(restored);
}
