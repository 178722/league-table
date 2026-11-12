'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

export function CopyUrlButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
        } catch {
          // クリップボードAPIが使えない環境では無視する（画面確認用のため）
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? 'コピーしました' : 'コピー'}
    </Button>
  );
}
