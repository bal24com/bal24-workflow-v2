// bal24 v2 — STEP-PROGRAM-REPORT-TAB
// 결과보고서 섹션 카드 (자동집계 버튼 + textarea + 저장 시각)

import { Loader2, Sparkles, Save } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { formatDateKo } from '../../../lib/utils';

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
}

export default function ReportSectionCard({
  Icon, label, canGenerate, content, onContentChange,
  onGenerate, onSave, isGenerating, isSaving, isDirty, updatedAt,
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
        </div>
      </header>

      <textarea value={content} onChange={(e) => onContentChange(e.target.value)}
        placeholder={canGenerate ? '자동집계 버튼을 누르거나 직접 입력해 주세요.' : '직접 입력해 주세요.'}
        rows={8}
        className="w-full min-h-[140px] px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm leading-relaxed focus:outline-none focus:border-violet-400 resize-y" />

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
