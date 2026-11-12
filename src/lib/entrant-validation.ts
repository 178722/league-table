// 選手(チーム)情報登録のバリデーション純粋ロジック（要件定義書3.3）。
// サーバー（src/lib/mock-data.ts）とクライアント（登録フォームの下書き追加時）の両方から呼び出す共通実装。
import type { Category, CourtSelection, Entrant } from '@/types/domain';

export interface EntrantValidationInput {
  name: string;
  affiliation?: string;
  courtSelection?: CourtSelection;
  courtNumber?: number;
}

/**
 * 選手(チーム)情報登録の入力バリデーション。
 * `others`には同一カテゴリ内の他の選手(チーム)（登録済み・下書き問わず、自分自身を除く）を渡す
 */
export function validateEntrantAgainst(
  category: Category,
  others: Entrant[],
  input: EntrantValidationInput,
): string | undefined {
  if (!input.name || input.name.length > 10) {
    return '選手(チーム)名は1〜10文字で入力してください';
  }
  if (input.affiliation && input.affiliation.length > 10) {
    return '所属は10文字以内で入力してください';
  }

  const duplicate = others.some((e) => e.name === input.name);
  if (duplicate) return '同一カテゴリ内に同名の選手(チーム)が既に登録されています';

  // 単一リーグはコート毎の独立した定員を持たないため、コート関連・人数上限チェックは独立リーグのみ適用する
  if (category.settings.leagueFormat !== '単一リーグ') {
    if (category.settings.courtCount >= 2 && input.courtSelection === '手動') {
      if (
        !input.courtNumber ||
        input.courtNumber < 1 ||
        input.courtNumber > category.settings.courtCount
      ) {
        return 'コート番号は競技情報のコート数以下で指定してください';
      }
      const countInCourt = others.filter(
        (e) => e.courtSelection === '手動' && e.courtNumber === input.courtNumber,
      ).length;
      if (countInCourt + 1 > category.settings.maxEntrantsPerCourt) {
        return '指定したコートの登録人数が1コート最大選手(チーム)数を超えています';
      }
    }

    const totalCount = others.length + 1;
    const capacity = category.settings.courtCount * category.settings.maxEntrantsPerCourt;
    if (totalCount > capacity) {
      return 'カテゴリの登録選手(チーム)数の合計が「コート数×1コート最大選手(チーム)数」を超えています';
    }
  }

  return undefined;
}
