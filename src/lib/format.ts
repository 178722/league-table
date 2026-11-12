import { format } from 'date-fns';
import { ja } from 'date-fns/locale';

export function formatDate(isoDate: string): string {
  return format(new Date(isoDate), 'yyyy/MM/dd', { locale: ja });
}

export function formatDateTime(isoDateTime: string): string {
  return format(new Date(isoDateTime), 'yyyy-MM-dd HH:mm:ss', { locale: ja });
}

/** セット率・得点率の表示用フォーマット。分母0かつ分子>0（Infinity）の場合は「MAX」と表示する */
export function formatRate(value: number): string {
  return Number.isFinite(value) ? value.toFixed(2) : 'MAX';
}

/** カテゴリ名の定義上の最大文字数（要件定義書3.2：MAX全角25文字） */
export const CATEGORY_NAME_MAX_LENGTH = 25;

/** 「カテゴリX：」表記部分の文字数（例：カテゴリA：） */
const CATEGORY_LABEL_PREFIX_LENGTH = 'カテゴリX：'.length;

/** カテゴリ選択コンボボックス等の横幅算出に使う「カテゴリX：カテゴリ名」表記の定義上の最大文字数 */
export const CATEGORY_LABEL_MAX_LENGTH =
  CATEGORY_NAME_MAX_LENGTH + CATEGORY_LABEL_PREFIX_LENGTH;

/** 選手(チーム)タブのカテゴリ選択コンボボックスの横幅（全角40文字分） */
export const CATEGORY_SELECT_WIDTH_CHARS = 40;
