// 외주/급여 증빙 업로드 컴포넌트 — 박경수님 + SkyClaw 2026-05-26
// payroll_expenses.receipt_urls (text[]) 활용. 새 테이블 없이 기존 컬럼만 사용.
// 다중 파일 업로드 + 미리보기 + 삭제. PayrollExpenseFormModal 의 수정 모드에서만 표시 (id 존재 시).

import { useRef, useState } from 'react';
import { Upload, X, Loader2, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';

interface Props {
  payrollId: string;
  receiptUrls: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}

const BUCKET = 'documents';

export default function PayrollReceiptUpload({ payrollId, receiptUrls, onChange, disabled }: Props) {
  const toast = useToast();
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    const newUrls: string[] = [];
    try {
      for (const file of Array.from(files)) {
        const safeName = file.name.replace(/[^a-zA-Z0-9가-힣._-]/g, '_');
        const path = `payroll/${payrollId}/${Date.now()}_${safeName}`;
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file);
        if (upErr) {
          console.error('[PayrollReceiptUpload] 업로드 실패:', upErr.message);
          toast.error(`업로드 실패: ${file.name}`);
          continue;
        }
        const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
        newUrls.push(pub.publicUrl);
      }
      const merged = [...receiptUrls, ...newUrls];
      onChange(merged);
      // DB 즉시 반영
      const { error: dbErr } = await supabase.from('payroll_expenses')
        .update({ receipt_urls: merged }).eq('id', payrollId);
      if (dbErr) {
        console.error('[PayrollReceiptUpload] DB 저장 실패:', dbErr.message);
        toast.error('증빙 저장 중 오류가 발생했어요.');
      } else if (newUrls.length > 0) {
        toast.success(`증빙 ${newUrls.length}개 업로드 완료`);
      }
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function handleRemove(url: string) {
    if (!window.confirm('이 증빙 파일을 삭제할까요?')) return;
    const next = receiptUrls.filter((u) => u !== url);
    onChange(next);
    const { error } = await supabase.from('payroll_expenses')
      .update({ receipt_urls: next }).eq('id', payrollId);
    if (error) {
      console.error('[PayrollReceiptUpload] DB 삭제 실패:', error.message);
      toast.error('증빙 삭제 중 오류가 발생했어요.');
      return;
    }
    toast.success('증빙을 삭제했어요.');
  }

  return (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/40 p-3">
      <div className="text-xs font-bold text-slate-700">📎 증빙 파일</div>
      {receiptUrls.length > 0 && (
        <ul className="space-y-1">
          {receiptUrls.map((url) => {
            const name = decodeURIComponent(url.split('/').pop() ?? '').replace(/^\d+_/, '');
            return (
              <li key={url} className="flex items-center gap-2 px-2 py-1.5 bg-white rounded-lg border border-slate-200">
                <FileText size={13} className="text-slate-400 shrink-0" aria-hidden="true" />
                <a href={url} target="_blank" rel="noopener noreferrer"
                  className="flex-1 min-w-0 text-xs text-violet-700 hover:underline truncate">
                  {name || '파일'}
                </a>
                <button type="button" onClick={() => void handleRemove(url)} disabled={disabled || uploading}
                  className="text-rose-500 hover:text-rose-700 disabled:opacity-40" aria-label="삭제">
                  <X size={13} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <button type="button" onClick={() => inputRef.current?.click()} disabled={disabled || uploading}
        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 border border-dashed border-slate-300 rounded-lg text-xs text-slate-600 hover:border-violet-400 hover:text-violet-600 disabled:opacity-50">
        {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
        {uploading ? '업로드 중…' : '📎 증빙 추가 (PDF·이미지, 여러 파일 가능)'}
      </button>
      <input ref={inputRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.heic"
        onChange={(e) => void handleFiles(e.target.files)} className="hidden" />
    </div>
  );
}
