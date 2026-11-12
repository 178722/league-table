'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ExportPanelProps {
  tournamentId: string;
}

function parseFileName(contentDisposition: string | null): string {
  const match = contentDisposition?.match(/filename\*=UTF-8''([^;]+)/);
  return match ? decodeURIComponent(match[1]) : 'export.xlsx';
}

// A7. データ出力画面：ボタン押下で大会全体のExcel（.xlsx）を直接出力し、完了ダイアログのみ表示する
export function ExportPanel({ tournamentId }: ExportPanelProps) {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<'success' | 'error' | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const runExport = async () => {
    setPending(true);
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/export/xlsx`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setErrorMessage(body?.error?.message ?? null);
        setResult('error');
        return;
      }
      const blob = await res.blob();
      const fileName = parseFileName(res.headers.get('content-disposition'));
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
      setResult('success');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : null);
      setResult('error');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <p className="text-sm text-muted-foreground">
        大会情報・競技情報・選手(チーム)・カテゴリ(パート)別のリーグ表・勝敗表（順位表）を1つのExcelファイルにまとめて出力します。
      </p>
      <div>
        <Button onClick={runExport} disabled={pending}>
          {pending ? '出力中…' : 'データ出力'}
        </Button>
      </div>

      <Dialog
        open={result !== null}
        onOpenChange={(open) => {
          if (!open) {
            setResult(null);
            setErrorMessage(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {result === 'success' ? 'データ出力が完了しました' : 'データ出力に失敗しました'}
            </DialogTitle>
            <DialogDescription>
              {result === 'success'
                ? 'Excelファイルのダウンロードを開始しました。'
                : `理由：${errorMessage ?? '不明なエラーが発生しました'}`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setResult(null)}>閉じる</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
