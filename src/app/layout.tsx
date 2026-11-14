import type { Metadata } from 'next';
import { TooltipProvider } from '@/components/ui/tooltip';
import './globals.css';

export const metadata: Metadata = {
  title: 'リーグ戦しようよ',
  description: 'スポーツリーグ管理システム',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-muted/40">
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
