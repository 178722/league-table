import bcrypt from 'bcryptjs';
import { loadStore, saveStore, type Session, type SessionRole } from '@/lib/store';

export const SESSION_COOKIE = 'admin_session';

export function verifyCredentials(id: string, password: string): boolean {
  const { auth } = loadStore();
  return id === auth.id && bcrypt.compareSync(password, auth.passwordHash);
}

export function updateCredentials(newId: string, newPassword: string): void {
  const store = loadStore();
  store.auth = { id: newId, passwordHash: bcrypt.hashSync(newPassword, 10) };
  saveStore(store);
}

/**
 * セッショントークンを発行する（Cookieベースの簡易実装。本番方式として確定している。CLAUDE.md参照）。
 * role省略時は通常の管理者セッション。'viewer'はID・パスワードなしの閲覧モード（書き込み不可）
 */
export function createSession(role: SessionRole = 'admin'): string {
  const store = loadStore();
  const token = crypto.randomUUID();
  store.session = { token, role };
  saveStore(store);
  return token;
}

export function getSession(token: string | undefined): Session | undefined {
  if (!token) return undefined;
  const session = loadStore().session;
  return session?.token === token ? session : undefined;
}

export function validateSession(token: string | undefined): boolean {
  return getSession(token) !== undefined;
}

export function clearSession(): void {
  const store = loadStore();
  store.session = null;
  saveStore(store);
}
