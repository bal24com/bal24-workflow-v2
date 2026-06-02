// bal24 v2 — STEP-PROGRAM-REPORT-TAB / STEP-PROGRAM-UX-B
// 결과보고서 섹션 카드 (자동집계 + textarea + 저장 시각 + ↑↓ 순서변경 + 삭제)

import { Loader2, Sparkles, Save, ChevronUp, ChevronDown, X, Paperclip } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { formatDateKo } from '../../../lib/utils';
import MultiFileUpload from '../../../components/MultiFileUpload';
import type { ActivityFile } from '../../../types/database';

interface Props {
  Icon: LucideIcon;
  label: string;
  /** AI 자동집계 지원 여부 (false면 [자동집계] 버튼 미노출) */
  canGenerate: boolean;
  content: string;
  onContentChange: (v: string) => void;
  onGenerate: () => Promise<void>;
  onSave: () => Promise<void>;
  isGenerating: boolean;
  isSaving: boolean;
  isDirty: boolean;
  updatedAt?: string | null;
  /** STEP-PROGRAM-UX-B — 순서 변경 + 삭제 */
  onMove?: (dir: 'up' | 'down') => void;
  onDelete?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
  // 박경수님 2026-06-02 CLUB-8 — 섹션 첨부파일
  programId?: string;
  files?: ActivityFile[];
  onFilesChange?: (files: ActivityFile[]) => void;
}

export default function ReportSectionCard({
  Icon, label, canGenerate, content, onContentChange,
  onGenerate, onSave, isGenerating, isSaving, isDirty, updatedAt,
  onMove, onDelete, isFirst, isLast,
  programId, files, onFilesChange,
}: Props) {
  return (
    <section className={`rounded-2xl border bg-white shadow-[0_4px_16px_rgba(124,58,237,0.06)] p-5 space-y-3 transition-colors ${
      isDirty ? 'border-orange-200 ring-1 ring-orange-100' : 'border-violet-100'
    }`}>
      <header className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <span className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-lg bg-violet-100 text-violet-600">
            <Icon size={15} aria-hidden="true" />
          </span>
          <p className="text-sm font-bold text-[#1E1B4B] truncate">{label}</p>
          {isDirty && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-700">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500 inline-block" aria-hidden="true" />
              저장 안 됨
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {onMove && (
            <div className="inline-flex items-center mr-1">
              <button type="button" onClick={() => onMove('up')} disabled={isFirst} aria-label="위로 이동"
                className="p-1 rounded hover:bg-slate-100 text-slate-500 disabled:opacity-30 transition-colors">
                <ChevronUp size={14} aria-hidden="true" />
              </button>
              <button type="button" onClick={() => onMove('down')} disabled={isLast} aria-label="아래로 이동"
                className="p-1 rounded hover:bg-slate-100 text-slate-500 disabled:opacity-30 transition-colors">
                <ChevronDown size={14} aria-hidden="true" />
              </button>
            </div>
          )}
          {canGenerate && (
            <button type="button" onClick={() => void onGenerate()} disabled={isGenerating || isSaving}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-violet-50 text-violet-600 border border-violet-200 text-xs font-bold hover:bg-violet-100 disabled:opacity-40">
              {isGenerating ? <Loader2 size={11} className="animate-spin" aria-hidden="true" /> : <Sparkles size={11} aria-hidden="true" />}
              {isGenerating ? '집계 중…' : '자동집계'}
            </button>
          )}
          <button type="button" onClick={() => void onSave()} disabled={!isDirty || isSaving || isGenerating}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-bold hover:bg-violet-700 disabled:opacity-40">
            {isSaving ? <Loader2 size={11} className="animate-spin" aria-hidden="true" /> : <Save size={11} aria-hidden="true" />}
            {isSaving ? '저장 중…' : '저장'}
          </button>
          {onDelete && (
            <button type="button" onClick={onDelete} aria-label="섹션 삭제"
              title="섹션 삭제"
              className="p-1.5 rounded hover:bg-rose-50 text-slate-300 hover:text-rose-500 transition-colors">
              <X size={13} aria-hidden="true" />
            </button>
          )}
        </div>
      </header>

      <textarea value={content} onChange={(e) => onContentChange(e.target.value)}
        placeholder={canGenerate ? '자동집계 버튼을 누르거나 직접 입력해 주세요.' : '직접 입력해 주세요.'}
        rows={8}
        className="w-full min-h-[140px] px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm leading-relaxed focus:outline-none focus:border-violet-400 resize-y" />

      {/* 박경수님 2026-06-02 CLUB-8 — 섹션 첨부파일 (사진·증빙) */}
      {programId && onFilesChange && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-bold text-slate-500 inline-flex items-center gap-1">
            <Paperclip size={11} aria-hidden="true" /> 첨부파일 (사진·증빙)
          </p>
          <MultiFileUpload
            bucket="satisfaction-files"
            pathPrefix={`report/${programId}`}
            files={files ?? []}
            onChange={onFilesChange}
          />
        </div>
      )}

      <footer className="flex items-center justify-between text-[11px] text-slate-400">
        <span>{content.length.toLocaleString()}자</span>
        <span>
          {updatedAt
            ? `마지막 저장 ${formatDateKo(updatedAt)} · ${new Date(updatedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`
            : '아직 저장 전이에요.'}
        </span>
      </footer>
    </section>
  );
}
