// bal24 v2 — 커리큘럼 인라인 AI 드롭존 (파일 업로드 → 차시 즉시 추출·등록)

import { useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { Loader2, Sparkles, FolderOpen, Trash2, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../../../lib/supabase';
import { useToast } from '../../../../contexts/ToastContext';
import { extractSessionsFromDocument } from '../../../../lib/curriculumExtract';
import type { ExtractedSession } from '../../../../lib/programAutoFill';

interface Props {
  programId: string;
  lastSessionNo: number;
  onSessionsInserted: () => void;
}

const ACCEPT = '.pdf,.docx,.pptx,.png,.jpg,.jpeg,.xlsx,.csv,.txt';

export default function CurriculumAiDropZone({ programId, lastSessionNo, onSessionsInserted }: Props) {
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [drafts, setDrafts] = useState<ExtractedSession[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  function reset() {
    setFile(null);
    setDrafts([]);
    setExtracting(false);
    setSubmitting(false);
  }

  async function handleExtract() {
    if (!file) return;
    setExtracting(true);
    try {
      const sessions = await extractSessionsFromDocument(file);
      if (sessions.length === 0) {
        toast.error('차시를 추출하지 못했어요. 다른 파일로 시도해 주세요.');
      } else {
        setDrafts(sessions);
        toast.success(`${sessions.length}개 차시를 추출했어요. 검토 후 등록해 주세요.`);
      }
    } finally {
      setExtracting(false);
    }
  }

  function patchDraft(idx: number, patch: Partial<ExtractedSession>) {
    setDrafts((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }

  function removeDraft(idx: number) {
    setDrafts((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleInsert() {
    if (drafts.length === 0) return;
    setSubmitting(true);
    try {
      const rows = drafts.filter((s) => s.title?.trim()).map((s, idx) => ({
        program_id: programId,
        session_no: lastSessionNo + idx + 1,
        title: s.title.trim(),
        day_label: s.day_label ?? null,
        start_time: s.start_time ?? null,
        end_time: s.end_time ?? null,
      }));
      if (rows.length === 0) { toast.error('등록할 차시가 없어요.'); return; }
      const { error } = await supabase.from('program_curriculum').insert(rows);
      if (error) throw error;
      toast.success(`${rows.length}개 차시가 등록됐어요.`);
      reset();
      onSessionsInserted();
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[curriculum-ai-drop] 차시 INSERT 실패:', raw);
      toast.error('차시 등록에 실패했어요.');
    } finally {
      setSubmitting(false);
    }
  }

  const onDragOver = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); setDragActive(true); };
  const onDragLeave = (e: DragEvent<HTMLDivElement>) => { if (e.currentTarget === e.target) setDragActive(false); };
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    const f = e.dataTransfer?.files?.[0];
    if (f) setFile(f);
  };

  return (
    <section className="rounded-xl border-2 border-dashed border-violet-200 bg-violet-50/50 p-4 space-y-3">
      <div className="flex items-center gap-1.5">
        <Sparkles size={14} className="text-violet-500" aria-hidden="true" />
        <p className="text-sm font-bold text-violet-800">커리큘럼 — 문서 추출 + AI 생성</p>
      </div>

      {drafts.length === 0 ? (
        <>
          <input ref={inputRef} type="file" hidden accept={ACCEPT}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <div onDragOver={onDragOver} onDragEnter={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={[
              'rounded-lg border-2 border-dashed bg-white p-5 text-center cursor-pointer transition-colors',
              dragActive ? 'border-violet-500 bg-violet-100' : 'border-violet-200 hover:bg-violet-50',
            ].join(' ')}>
            <FolderOpen size={28} className="mx-auto text-violet-300 mb-1.5" aria-hidden="true" />
            {file ? (
              <p className="text-sm font-semibold text-violet-700 truncate" title={file.name}>{file.name}</p>
            ) : (
              <>
                <p className="text-xs text-slate-700 font-semibold">파일을 여기에 드래그하면 AI가 커리큘럼 자동 추출</p>
                <p className="text-[11px] text-slate-500 mt-0.5">클릭해서 파일 선택도 가능</p>
                <p className="text-[10px] text-slate-400 mt-1">운영안·제안서·일정표 PDF·이미지·DOCX·XLSX 지원</p>
              </>
            )}
          </div>
          {file && (
            <div className="flex items-center justify-end gap-2">
              <button type="button" onClick={() => setFile(null)} disabled={extracting}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:bg-slate-100 disabled:opacity-40">
                취소
              </button>
              <button type="button" onClick={() => void handleExtract()} disabled={extracting}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-bold hover:bg-violet-700 disabled:opacity-40">
                {extracting ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : <Sparkles size={12} aria-hidden="true" />}
                {extracting ? '커리큘럼 추출 중…' : 'AI로 차시 자동 추출'}
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <p className="text-[11px] text-violet-700">{drafts.length}개 차시 추출됨. 검토·수정 후 등록하세요. (현재 차시 {lastSessionNo}개 뒤에 추가)</p>
          <ul className="divide-y divide-violet-100 rounded-lg border border-violet-100 bg-white max-h-[320px] overflow-y-auto">
            {drafts.map((s, idx) => (
              <li key={idx} className="grid grid-cols-[40px_minmax(60px,80px)_minmax(60px,80px)_minmax(60px,80px)_minmax(0,1fr)_24px] items-center gap-2 px-2 py-1.5 text-xs">
                <span className="text-violet-600 font-bold tabular-nums text-center">{lastSessionNo + idx + 1}</span>
                <input type="text" value={s.day_label ?? ''} onChange={(e) => patchDraft(idx, { day_label: e.target.value })}
                  placeholder="1일차" className="rounded border border-slate-200 px-1.5 py-1 focus:outline-none focus:border-violet-400" />
                <input type="text" value={s.start_time ?? ''} onChange={(e) => patchDraft(idx, { start_time: e.target.value })}
                  placeholder="09:00" className="rounded border border-slate-200 px-1.5 py-1 focus:outline-none focus:border-violet-400" />
                <input type="text" value={s.end_time ?? ''} onChange={(e) => patchDraft(idx, { end_time: e.target.value })}
                  placeholder="11:00" className="rounded border border-slate-200 px-1.5 py-1 focus:outline-none focus:border-violet-400" />
                <input type="text" value={s.title} onChange={(e) => patchDraft(idx, { title: e.target.value })}
                  placeholder="차시명" className="rounded border border-slate-200 px-1.5 py-1 font-semibold focus:outline-none focus:border-violet-400" />
                <button type="button" onClick={() => removeDraft(idx)} aria-label="삭제"
                  className="p-1 rounded text-slate-400 hover:bg-rose-50 hover:text-rose-500">
                  <Trash2 size={11} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={reset} disabled={submitting}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:bg-slate-100 disabled:opacity-40">취소</button>
            <button type="button" onClick={() => void handleInsert()} disabled={submitting || drafts.length === 0}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-40">
              {submitting ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : <CheckCircle2 size={12} aria-hidden="true" />}
              {submitting ? '등록 중…' : `${drafts.length}개 차시 등록하기`}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
