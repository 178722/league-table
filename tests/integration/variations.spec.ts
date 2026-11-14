import { test, expect } from '@playwright/test';
import {
  addEntrant,
  createTournament,
  generateCategories,
  setCategorySettings,
} from './helpers';

// 結合テストケースのシナリオ拡充用（docs/結合テスト.md「カバレッジの考え方」参照）。
// 参加人数・順位決定方式・コート数・リーグ形式・セット数の組合せをバリエーション豊かに変えながら、
// I-GEN-01/I-GEN-02相当（一括生成の成功・スキップ）を繰り返し検証する回帰テスト群。
test.describe.configure({ timeout: 45_000 });

interface SuccessScenario {
  label: string;
  n: number;
  rankingMethod: '勝敗方式' | '勝点方式';
  winPoints?: number;
  drawPoints?: number;
  losePoints?: number;
  courtCount: number;
  singleLeague: boolean;
  setCount: number;
  /** 独立リーグはコート数×1コート最大選手(チーム)数を超える登録が選手登録時点でブロックされるため、
   *  courtCount=1の独立リーグシナリオではN以上の値を明示する（単一リーグはこの上限を適用しないため不要） */
  maxEntrantsPerCourt?: number;
}

// コート数が2以上の場合は単一リーグに設定し、試合順表を1ページで完結させて総試合数を数えやすくする
const SUCCESS_SCENARIOS: SuccessScenario[] = [
  { label: 'N2-勝敗-court1-set1', n: 2, rankingMethod: '勝敗方式', courtCount: 1, singleLeague: false, setCount: 1, maxEntrantsPerCourt: 10 },
  { label: 'N3-勝敗-court1-set3', n: 3, rankingMethod: '勝敗方式', courtCount: 1, singleLeague: false, setCount: 3, maxEntrantsPerCourt: 10 },
  { label: 'N4-勝敗-court1-set5', n: 4, rankingMethod: '勝敗方式', courtCount: 1, singleLeague: false, setCount: 5, maxEntrantsPerCourt: 10 },
  { label: 'N5-勝敗-court1-set1', n: 5, rankingMethod: '勝敗方式', courtCount: 1, singleLeague: false, setCount: 1, maxEntrantsPerCourt: 10 },
  { label: 'N6-勝敗-court1-set3', n: 6, rankingMethod: '勝敗方式', courtCount: 1, singleLeague: false, setCount: 3, maxEntrantsPerCourt: 10 },
  { label: 'N7-勝敗-court1-set1', n: 7, rankingMethod: '勝敗方式', courtCount: 1, singleLeague: false, setCount: 1, maxEntrantsPerCourt: 10 },
  { label: 'N8-勝敗-court1-set3', n: 8, rankingMethod: '勝敗方式', courtCount: 1, singleLeague: false, setCount: 3, maxEntrantsPerCourt: 10 },
  { label: 'N2-勝点3/1/0-court1-set1', n: 2, rankingMethod: '勝点方式', winPoints: 3, drawPoints: 1, losePoints: 0, courtCount: 1, singleLeague: false, setCount: 1, maxEntrantsPerCourt: 10 },
  { label: 'N3-勝点2/1/0-court1-set3', n: 3, rankingMethod: '勝点方式', winPoints: 2, drawPoints: 1, losePoints: 0, courtCount: 1, singleLeague: false, setCount: 3, maxEntrantsPerCourt: 10 },
  { label: 'N4-勝点5/2/0-court1-set1', n: 4, rankingMethod: '勝点方式', winPoints: 5, drawPoints: 2, losePoints: 0, courtCount: 1, singleLeague: false, setCount: 1, maxEntrantsPerCourt: 10 },
  { label: 'N5-勝点4/2/1-court1-set3', n: 5, rankingMethod: '勝点方式', winPoints: 4, drawPoints: 2, losePoints: 1, courtCount: 1, singleLeague: false, setCount: 3, maxEntrantsPerCourt: 10 },
  { label: 'N6-勝点4/3/0-court1-set1', n: 6, rankingMethod: '勝点方式', winPoints: 4, drawPoints: 3, losePoints: 0, courtCount: 1, singleLeague: false, setCount: 1, maxEntrantsPerCourt: 10 },
  { label: 'N4-勝敗-court2単一-set3', n: 4, rankingMethod: '勝敗方式', courtCount: 2, singleLeague: true, setCount: 3 },
  { label: 'N5-勝敗-court2単一-set1', n: 5, rankingMethod: '勝敗方式', courtCount: 2, singleLeague: true, setCount: 1 },
  { label: 'N6-勝敗-court2単一-set5', n: 6, rankingMethod: '勝敗方式', courtCount: 2, singleLeague: true, setCount: 5 },
  { label: 'N7-勝点3/1/0-court2単一-set3', n: 7, rankingMethod: '勝点方式', winPoints: 3, drawPoints: 1, losePoints: 0, courtCount: 2, singleLeague: true, setCount: 3 },
  { label: 'N8-勝点4/2/0-court2単一-set1', n: 8, rankingMethod: '勝点方式', winPoints: 4, drawPoints: 2, losePoints: 0, courtCount: 2, singleLeague: true, setCount: 1 },
  { label: 'N6-勝敗-court3単一-set3', n: 6, rankingMethod: '勝敗方式', courtCount: 3, singleLeague: true, setCount: 3 },
  { label: 'N9-勝敗-court3単一-set1', n: 9, rankingMethod: '勝敗方式', courtCount: 3, singleLeague: true, setCount: 1 },
  { label: 'N5-勝敗-court3単一-set1（独立リーグなら1コート不足になる構成）', n: 5, rankingMethod: '勝敗方式', courtCount: 3, singleLeague: true, setCount: 1 },
];

for (const scenario of SUCCESS_SCENARIOS) {
  test(`I-VAR-${scenario.label}: 生成成功し総試合数N×(N-1)÷2が正しく表示される`, async ({ page }) => {
    const name = `バリエーション検証-${scenario.label}-${Date.now()}`;
    const tid = await createTournament(page, { name });
    const categoryId = `${tid}-A`;

    await setCategorySettings(page, tid, categoryId, {
      setCount: scenario.setCount,
      rankingMethod: scenario.rankingMethod,
      winPoints: scenario.winPoints,
      drawPoints: scenario.drawPoints,
      losePoints: scenario.losePoints,
      courtCount: scenario.courtCount,
      singleLeague: scenario.singleLeague,
      maxEntrantsPerCourt: scenario.maxEntrantsPerCourt,
    });

    for (let i = 0; i < scenario.n; i += 1) {
      await addEntrant(page, tid, `選手${i + 1}`);
    }

    await generateCategories(page, tid, ['カテゴリA']);

    await page.goto(`/tournaments/${tid}/categories/${categoryId}/matches`);
    await expect(page.locator('text=リーグ表・勝敗表')).toBeVisible();
    const expectedMatches = (scenario.n * (scenario.n - 1)) / 2;
    const resultButtons = page.getByRole('button', { name: /未入力|入力済/ });
    await expect(resultButtons).toHaveCount(expectedMatches);
  });
}

interface SkipScenario {
  label: string;
  n: number;
  courtCount: number;
  maxEntrantsPerCourt?: number;
  expectedReason: string;
}

const SKIP_SCENARIOS: SkipScenario[] = [
  { label: 'N1-court1', n: 1, courtCount: 1, expectedReason: '参加選手(チーム)数が1名のため作成できません' },
  { label: 'N0-court1', n: 0, courtCount: 1, expectedReason: '参加選手(チーム)数が0名のため作成できません' },
  {
    label: 'N5-court3-不均等配分',
    n: 5,
    courtCount: 3,
    maxEntrantsPerCourt: 5,
    expectedReason: 'コート3の割当人数が1名のため作成できません',
  },
];

for (const scenario of SKIP_SCENARIOS) {
  test(`I-VAR-SKIP-${scenario.label}: 条件を満たさず生成がスキップされ、理由が表示される`, async ({ page }) => {
    const name = `バリエーションスキップ検証-${scenario.label}-${Date.now()}`;
    const tid = await createTournament(page, { name });
    const categoryId = `${tid}-A`;

    await setCategorySettings(page, tid, categoryId, {
      courtCount: scenario.courtCount,
      maxEntrantsPerCourt: scenario.maxEntrantsPerCourt,
    });

    for (let i = 0; i < scenario.n; i += 1) {
      await addEntrant(page, tid, `選手${i + 1}`);
    }

    await generateCategories(page, tid, ['カテゴリA']);

    await expect(
      page.locator('text=条件を満たさないため生成をスキップしたカテゴリがあります'),
    ).toBeVisible();
    await expect(page.locator('[role="dialog"]')).toContainText(scenario.expectedReason);
  });
}
