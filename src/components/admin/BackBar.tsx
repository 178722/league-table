import type { ReactNode } from 'react';
import Link from 'next/link';

interface BackBarProps {
  backHref: string;
  backLabel: string;
  title: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;
  /** trueの場合、戻りリンクとタイトルを別行に分けて表示する（タイトルを改行表示したい画面向け） */
  stacked?: boolean;
}

// 「← 大会一覧   大会名：...」の行（A3以外の大会単位画面の先頭に表示）
export function BackBar({ backHref, backLabel, title, actions, meta, stacked }: BackBarProps) {
  if (stacked) {
    return (
      <div className="border-b bg-background px-4 py-4">
        <Link href={backHref} className="text-sm text-muted-foreground hover:underline">
          ← {backLabel}
        </Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
            {title}
          </h1>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
        {meta && <div className="mt-2 text-sm text-muted-foreground">{meta}</div>}
      </div>
    );
  }

  return (
    <div className="border-b bg-background px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Link href={backHref} className="text-sm text-muted-foreground hover:underline">
            ← {backLabel}
          </Link>
          <div className="text-base font-semibold">{title}</div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {meta && <div className="mt-2 text-sm text-muted-foreground">{meta}</div>}
    </div>
  );
}
