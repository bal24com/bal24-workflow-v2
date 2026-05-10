// bal24 v2 — STEP-AUDIT-PORTAL 종합 의견 + PDF 업로드 + 제출 섹션

import type { ChangeEvent, RefObject } from 'react';
import { Loader2, Send, Upload, X, FileText } from 'lucide-react';
import { Button } from '../../components/ui';

interface Props {
  overallComment: string;
  onCommentChange: (next: string) => void;
  auditFile: File | null;
  onFileSelect: (e: ChangeEvent<HTMLInputElement>) => void;
  onFileClear: () => void;
  existingReportUrl: string | null;
  fileRef: RefObject<HTMLInputElement | null>;
  isCompleted: boolean;
  submitting: boolean;
  uploading: boolean;
  onSubmit: () => void;
}

export default function AuditSubmitSection({
  overallComment, onCommentChange, auditFile, onFileSelect, onFileClear,
  existingReportUrl, fileRef, isCompleted, submitting, uploading, onSubmit,
}: Props) {
  const disabled = isCompleted || submitting;

  return (
    <section className="rounded-2xl border border-violet-100 bg-white p-5 space-y-3">
      <h2 className="text-base font-bold text-[#1E1B4B]">종합 감사 의견</h2>
      <textarea
        value={overallComment}
        onChange={(e) => onCommentChange(e.target.value)}
        disabled={disabled}
        rows={5}
        placeholder="전체 사업의 회계처리 적정성, 주요 발견사항, 권고사항 등을 작성해 주세요."
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60 disabled:bg-slate-50 resize-y leading-relaxed"
      />

      {/* PDF 업로드 */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-bold text-slate-500">감사 리포트 첨부 (선택, PDF)</label>
        {auditFile ? (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-violet-100 bg-violet-50/40 px-3 py-2 text-xs">
            <span className="inline-flex items-center gap-1.5 min-w-0 truncate">
              <FileText size={12} className="text-violet-600 shrink-0" aria-hidden="true" />
              <span className="truncate">{auditFile.name}</span>
            </span>
            <button type="button" onClick={onFileClear} disabled={submitting}
              className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-white border border-slate-200 text-slate-500 hover:bg-rose-50 hover:text-rose-600">
              <X size={11} />
            </button>
          </div>
        ) : existingReportUrl ? (
          <a href={existingReportUrl} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-violet-700 hover:underline">
            <FileText size={11} aria-hidden="true" />
            기존 첨부 리포트 열기
          </a>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={disabled || uploading}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-dashed border-violet-200 bg-violet-50/40 text-violet-700 hover:bg-violet-100 disabled:opacity-50"
          >
            {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
            PDF 파일 선택
          </button>
        )}
        <input ref={fileRef} type="file" accept="application/pdf,.pdf" hidden onChange={onFileSelect} />
        <p className="text-[11px] text-slate-400">최대 20MB · PDF 권장</p>
      </div>

      {!isCompleted && (
        <div className="sticky bottom-4 pt-2">
          <Button
            variant="primary"
            size="lg"
            loading={submitting}
            leftIcon={<Send size={14} />}
            onClick={onSubmit}
            className="!w-full !py-3 text-base font-semibold shadow-lg"
          >
            감사 완료 제출
          </Button>
        </div>
      )}
    </section>
  );
}
