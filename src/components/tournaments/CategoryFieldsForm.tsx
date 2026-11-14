'use client';

import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { BlockedTooltip } from '@/components/admin/BlockedTooltip';
import type { CategoryKey } from '@/types/domain';

export interface CategoryFieldState {
  key: CategoryKey;
  name: string;
  enabled: boolean;
  /** 既に競技情報・選手(チーム)情報が登録済みで無効化できないカテゴリ */
  locked: boolean;
}

interface CategoryFieldsFormProps {
  value: CategoryFieldState[];
  onChange: (next: CategoryFieldState[]) => void;
  disabled?: boolean;
}

// A3のカテゴリA〜J欄。チェックで名称入力欄の表示を切り替える（制御コンポーネント。値は呼び出し元が保持する）
export function CategoryFieldsForm({ value: fields, onChange, disabled }: CategoryFieldsFormProps) {
  const toggle = (key: CategoryKey) => {
    onChange(fields.map((f) => (f.key === key ? { ...f, enabled: !f.enabled } : f)));
  };

  const rename = (key: CategoryKey, name: string) => {
    onChange(fields.map((f) => (f.key === key ? { ...f, name } : f)));
  };

  return (
    <div className="flex flex-col gap-2">
      {fields.map((field) => {
        const isCategoryA = field.key === 'A';
        return (
          <div key={field.key} className="flex items-center gap-3">
            <span className="w-24 shrink-0 text-sm font-medium">
              カテゴリ{field.key}
              {isCategoryA && <span className="text-destructive"> *</span>}
            </span>
            {!isCategoryA && (
              <BlockedTooltip
                reason={field.locked ? '登録済みのデータがあるため無効化できません' : undefined}
              >
                <Checkbox
                  checked={field.enabled}
                  disabled={disabled || field.locked}
                  onCheckedChange={() => toggle(field.key)}
                  aria-label={`カテゴリ${field.key}を有効化`}
                />
              </BlockedTooltip>
            )}
            {(isCategoryA || field.enabled) && (
              <Label className="sr-only" htmlFor={`category-${field.key}`}>
                カテゴリ{field.key}名称
              </Label>
            )}
            {isCategoryA || field.enabled ? (
              <>
                <Input
                  id={`category-${field.key}`}
                  value={field.name}
                  maxLength={25}
                  required={isCategoryA}
                  disabled={disabled}
                  onChange={(e) => rename(field.key, e.target.value)}
                  className="max-w-md"
                />
                <span className="shrink-0 text-xs text-muted-foreground">（最大25文字）</span>
              </>
            ) : (
              <span className="text-sm text-muted-foreground">未使用</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
