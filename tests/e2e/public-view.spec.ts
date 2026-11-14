import { test, expect } from '@playwright/test';
import { addEntrant, createTournament, enableCategory, generateCategories, login, setCategorySettings } from './helpers';

// シナリオ4：参加者向け画面（ログイン不要）での結果閲覧（docs/E2Eテスト.md参照）
test('シナリオ4: 参加者向けURLはログイン不要で閲覧でき、カテゴリ・コートタブを切り替えられる', async ({
  browser,
}) => {
  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await login(adminPage);

  const name = `E2E参加者閲覧-${Date.now()}`;
  const tid = await createTournament(adminPage, { name });
  const categoryAId = `${tid}-A`;

  // カテゴリAはコート数2（コートタブの切り替えを検証するため）、カテゴリBを追加で有効化してカテゴリタブの切り替えも検証する
  await setCategorySettings(adminPage, tid, categoryAId, { courtCount: 2 });
  await enableCategory(adminPage, tid, 'B', '初級');

  await addEntrant(adminPage, tid, '選手A');
  await addEntrant(adminPage, tid, '選手B');
  await addEntrant(adminPage, tid, '選手C');
  await addEntrant(adminPage, tid, '選手D');
  await addEntrant(adminPage, tid, 'B選手A', { categoryLabel: 'カテゴリB：初級' });
  await addEntrant(adminPage, tid, 'B選手B', { categoryLabel: 'カテゴリB：初級' });
  await generateCategories(adminPage, tid, ['カテゴリA', 'カテゴリB']);
  await adminContext.close();

  // Step 1: ログインしていない新規ブラウザコンテキストで参加者向けURLへ直接アクセスする
  const context = await browser.newContext();
  const page = await context.newPage();
  const res = await page.goto(`/t/${tid}`);
  expect(res?.status()).toBe(200);
  await expect(page).toHaveURL(new RegExp(`/t/${tid}$`));
  await expect(page.locator(`text=${name}`)).toBeVisible();

  // Step 2: カテゴリタブを切り替える
  await expect(page.getByRole('button', { name: /カテゴリA/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /カテゴリB/ })).toBeVisible();
  await page.getByRole('button', { name: /カテゴリB/ }).click();
  // 対戦表は正方行列のため選手(チーム)名が行・列どちらの見出しにも現れる（複数一致するため.first()で代表1件を確認する）
  await expect(page.locator('text=B選手A').first()).toBeVisible();

  await page.getByRole('button', { name: /カテゴリA/ }).click();
  // コート自動割当はランダムなため、「選手A〜D」のうちどの名前が既定表示コートに現れるかは固定できない。
  // 4名のいずれかが表示されていればカテゴリAの内容に切り替わったことが確認できる
  await expect(page.locator('text=/選手[A-D]/').first()).toBeVisible();

  // Step 3: コートタブ（コート数2以上）を切り替える
  await expect(page.getByRole('button', { name: /コート1/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /コート2/ })).toBeVisible();
  const court1Table = page.locator('table').first();
  const court1Text = await court1Table.innerText();
  await page.getByRole('button', { name: /コート2/ }).click();
  const court2Text = await page.locator('table').first().innerText();
  expect(court2Text).not.toBe(court1Text);

  // Step 4: 編集操作に相当するUI要素が存在しない（閲覧専用であることの確認）
  await expect(page.locator('input[type=number]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'リーグ表を作成する' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '未入力' })).toHaveCount(0);
  await expect(page.locator('[role="dialog"]')).toHaveCount(0);

  await context.close();
});
