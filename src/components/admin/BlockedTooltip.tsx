'use client';

import type { ReactNode } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface BlockedTooltipProps {
  reason?: string;
  children: ReactNode;
}

// ブロック系ルールでdisabledにしたボタンに理由を添えるための共通ラッパー
export function BlockedTooltip({ reason, children }: BlockedTooltipProps) {
  if (!reason) return <>{children}</>;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-block">{children}</span>
      </TooltipTrigger>
      <TooltipContent>{reason}</TooltipContent>
    </Tooltip>
  );
}
