// bal24 v2 — 커리큘럼 인라인 AI 드롭존 (파일 → 차시 추출 + 강사 인력풀 매칭 + program_curriculum INSERT)

import { useRef, useState } from 'react';
import type { DragEvent } from 'react';
import {
  Loader2, Sparkles, FolderOpen, Trash2, CheckCircle2, ChevronDown, ChevronRight, AlertTriangle,
} from 'lucide-react';
import { supabase } from '../../../../lib/supabase';
import { useToast } from '../../../../contexts/ToastContext';
import { extractSessionsFromDocument } from '../../../../lib/curriculumExtract';
import {
  matchInstructorsByNames, linkMatchedStaff, type MatchedInstructor,
} from '../../../../lib/instructorMatch';
import type { ExtractedSession } from '../../../../lib/programAutoFill';

interface Props {
  programId: string;
  lastSessionNo: number;
  onSessionsInserted: () => void;
}

interface DraftSession extends ExtractedSession {
  match?: MatchedInstructor;
  expanded?: boolean;
}

const ACCEPT = '.pdf,.docx,.pptx,.png,.jpg,.jpeg,.xlsx,.csv,.txt';

export default function CurriculumAiDropZone({ programId, lastSessionNo, onSessionsInserted }: Props) {
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [drafts, setDrafts] = useState<DraftSession[]>([]);
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
        return;
      }
      // 강사명 자동 매칭 (인력풀 4단계 fallback)
      const names = sessions.map((s) => s.instructor_name?.trim()).filter((n): n is string => Boolean(n));
      const matchMap = names.length > 0 ? await matchInstructorsByNames(names) : new Map();
      const matched = sessions.map<DraftSession>((s) => ({
        ...s,
        match: s.instructor_name ? matchMap.get(s.instructor_name.trim()) : undefined,
      }));
      setDrafts(matched);
      const ok = matched.filter((d) => d.match?.source && d.match.source !== 'none').length;
      const ng = matched.filter((d) => d.instructor_name && (!d.match || d.match.source === 'none')).length;
      toast.success(`${matched.length}개 차시 추출. 강사 매칭 ${ok}건${ng > 0 ? ` / 미매칭 ${ng}건` : ''}.`);
    } finally {
      setExtracting(false);
    }
  }

  function patchDraft(idx: number, patch: Partial<DraftSession>) {
    setDrafts((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }

  function removeDraft(idx: number) {
    setDrafts((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleInsert() {
    if (drafts.length === 0) return;
    setSubmitting(true);
    try {
      const filtered = drafts.filter((s) => s.title?.trim());
      if (filtered.length === 0) { toast.error('등록할 차시가 없어요.'); return; }
      const rows = filtered.map((s, idx) => ({
        program_id: programId,
        session_no: lastSessionNo + idx + 1,
        title: s.title.trim(),
        day_label: s.day_label?.trim() || null,
        start_time: s.start_time?.trim() || null,
        end_time: s.end_time?.trim() || null,
        content: s.content?.trim() || null,
        instructor_name_raw: s.instructor_name?.trim() || null,
      }));
      const ins = await supabase.from('program_curriculum').insert(rows).select('id');
      if (ins.error) throw ins.error;
      const inserted = (ins.data ?? []) as { id: string }[];

      // 매칭된 강사 → curriculum_staff 자동 INSERT (중복 체크)
      const links = filtered
        .map((s, i) => ({ curriculumId: inserted[i]?.id, match: s.match }))
        .filter((l): l is { curriculumId: string; match: MatchedInstructor } => Boolean(l.curriculumId && l.match));
      const link = await linkMatchedStaff(links);

      const matchedMsg = link.inserted > 0 ? ` · 강사 ${link.inserted}건 자동 매핑` : '';
      toast.success(`${rows.length}개 차시 등록${matchedMsg}.`);
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
        <p className="text-sm font-bold text-violet-800">커리큘럼 — 문서 추출 + AI 생성 + 강사 매칭</p>
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
                <p className="text-xs text-slate-700 font-semibold">파일을 여기에 드래그하면 AI가 커리큘럼·강사 자동 추출</p>
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
                {extracting ? '커리큘럼 추출 중…' : 'AI로 차시 + 강사 자동 추출'}
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <p className="text-[11px] text-violet-700">
            {drafts.length}개 차시 · 강사 매칭 결과 검토 후 등록 (현재 차시 {lastSessionNo}개 뒤에 추가)
          </p>
          <ul className="rounded-lg border border-violet-100 bg-white max-h-[420px] overflow-y-auto divide-y divide-violet-100">
            {drafts.map((s, idx) => (
              <li key={idx} className="px-2 py-1.5 text-xs">
                <div className="grid grid-cols-[28px_minmax(60px,80px)_minmax(90px,110px)_minmax(0,1fr)_minmax(140px,180px)_24px_24px] items-center gap-2">
                  <span className="text-violet-600 font-bold tabular-nums text-center">{lastSessionNo + idx + 1}</span>
                  <input type="text" value={s.day_label ?? ''} onChange={(e) => patchDraft(idx, { day_label: e.target.value })}
                    placeholder="1일차" className="rounded border border-slate-200 px-1.5 py-1 focus:outline-none focus:border-violet-400" />
                  <input type="text" value={(s.start_time ?? '') + (s.end_time ? `~${s.end_time}` : '')} readOnly
                    placeholder="09:00~11:00"
                    className="rounded border border-slate-100 bg-slate-50 px-1.5 py-1 text-slate-500 cursor-not-allowed" title="펼침에서 편집" />
                  <input type="text" value={s.title} onChange={(e) => patchDraft(idx, { title: e.target.value })}
                    placeholder="차시명" className="rounded border border-slate-200 px-1.5 py-1 font-semibold focus:outline-none focus:border-violet-400" />
                  <InstructorCell draft={s} onChange={(v) => patchDraft(idx, { instructor_name: v })} />
                  <button type="button" onClick={() => patchDraft(idx, { expanded: !s.expanded })} aria-label="상세 펼침"
                    className="p-1 rounded text-slate-400 hover:bg-violet-50 hover:text-violet-600">
                    {s.expanded ? <ChevronDown size={11} aria-hidden="true" /> : <ChevronRight size={11} aria-hidden="true" />}
                  </button>
                  <button type="button" onClick={() => removeDraft(idx)} aria-label="삭제"
                    className="p-1 rounded text-slate-400 hover:bg-rose-50 hover:text-rose-500">
                    <Trash2 size={11} aria-hidden="true" />
                  </button>
                </div>
                {s.expanded && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 px-2 py-2 rounded-lg bg-slate-50/60">
                    <input type="text" value={s.start_time ?? ''} onChange={(e) => patchDraft(idx, { start_time: e.target.value })}
                      placeholder="시작 09:00"
                      className="rounded border border-slate-200 bg-white px-2 py-1 focus:outline-none focus:border-violet-400" />
                    <input type="text" value={s.end_time ?? ''} onChange={(e) => patchDraft(idx, { end_time: e.target.value })}
                      placeholder="종료 11:00"
                      className="rounded border border-slate-200 bg-white px-2 py-1 focus:outline-none focus:border-violet-400" />
                    <textarea rows={2} value={s.content ?? ''} onChange={(e) => patchDraft(idx, { content: e.target.value })}
                      placeholder="강의 내용·진행 방식"
                      className="sm:col-span-2 rounded border border-slate-200 bg-white px-2 py-1 focus:outline-none focus:border-violet-400 resize-none" />
                  </div>
                )}
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

function InstructorCell({ draft, onChange }: { draft: DraftSession; onChange: (v: string) => void }) {
  const matched = draft.match && draft.match.source !== 'none';
  const hasName = Boolean(draft.instructor_name?.trim());
  return (
    <div className="flex items-center gap-1">
      <input type="text" value={draft.instructor_name ?? ''} onChange={(e) => onChange(e.target.value)}
        placeholder="강사명" className="flex-1 rounded border border-slate-200 px-1.5 py-1 focus:outline-none focus:border-violet-400" />
      {hasName && (
        matched ? (
          <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700"
            title={`${draft.match?.source === 'staff_pool' ? '인력풀' : '임직원'} 매칭`}>
            <CheckCircle2 size={9} aria-hidden="true" /> {draft.match?.source === 'staff_pool' ? '풀' : '내부'}
          </span>
        ) : (
          <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700"
            title="인력풀 미매칭 — 등록 후 [강사 요청]에서 초대">
            <AlertTriangle size={9} aria-hidden="true" /> 미매칭
          </span>
        )
      )}
    </div>
  );
}
