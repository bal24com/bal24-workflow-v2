// bal24 v2 — 커리큘럼 인라인 AI 드롭존 (파일 → 차시 + 강사·멘토 다중 매칭 → INSERT)

import { useRef, useState } from 'react';
import type { DragEvent } from 'react';
import {
  Loader2, Sparkles, FolderOpen, Trash2, CheckCircle2, ChevronDown, ChevronRight,
} from 'lucide-react';
import { supabase } from '../../../../lib/supabase';
import { useToast } from '../../../../contexts/ToastContext';
import { extractSessionsFromDocument } from '../../../../lib/curriculumExtract';
import {
  matchInstructorsByNames, matchAndLinkByRole, type MatchedInstructor,
} from '../../../../lib/instructorMatch';
import InstructorMentorCell from './InstructorMentorCell';
import type { ExtractedSession } from '../../../../lib/programAutoFill';

interface Props {
  programId: string;
  lastSessionNo: number;
  onSessionsInserted: () => void;
}

interface DraftSession extends ExtractedSession {
  expanded?: boolean;
  instructorMatches: Record<string, MatchedInstructor>;
  mentorMatches: Record<string, MatchedInstructor>;
}

const ACCEPT = '.pdf,.docx,.pptx,.png,.jpg,.jpeg,.xlsx,.csv,.txt';

function emptyDraft(s: ExtractedSession): DraftSession {
  return {
    ...s,
    instructor_names: s.instructor_names ?? [],
    mentor_names: s.mentor_names ?? [],
    instructorMatches: {},
    mentorMatches: {},
  };
}

export default function CurriculumAiDropZone({ programId, lastSessionNo, onSessionsInserted }: Props) {
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [drafts, setDrafts] = useState<DraftSession[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  function reset() {
    setFile(null); setDrafts([]); setExtracting(false); setSubmitting(false);
  }

  async function handleExtract() {
    if (!file) return;
    setExtracting(true);
    try {
      const sessions = await extractSessionsFromDocument(file);
      if (sessions.length === 0) { toast.error('차시를 추출하지 못했어요. 다른 파일로 시도해 주세요.'); return; }
      // 강사·멘토 이름 모두 일괄 매칭
      const allInstructorNames = sessions.flatMap((s) => s.instructor_names ?? []).filter((n) => n !== '전체');
      const allMentorNames = sessions.flatMap((s) => s.mentor_names ?? []).filter((n) => n !== '전체');
      const [iMap, mMap] = await Promise.all([
        allInstructorNames.length > 0 ? matchInstructorsByNames(allInstructorNames) : Promise.resolve(new Map()),
        allMentorNames.length > 0 ? matchInstructorsByNames(allMentorNames) : Promise.resolve(new Map()),
      ]);
      const next: DraftSession[] = sessions.map((s) => {
        const d = emptyDraft(s);
        for (const n of s.instructor_names ?? []) {
          d.instructorMatches[n] = n === '전체' ? { source: 'none' } : (iMap.get(n) ?? { source: 'none' });
        }
        for (const n of s.mentor_names ?? []) {
          d.mentorMatches[n] = n === '전체' ? { source: 'none' } : (mMap.get(n) ?? { source: 'none' });
        }
        return d;
      });
      setDrafts(next);
      const okI = [...iMap.values()].filter((m) => m.source !== 'none').length;
      const okM = [...mMap.values()].filter((m) => m.source !== 'none').length;
      const ngI = allInstructorNames.length - okI;
      const ngM = allMentorNames.length - okM;
      toast.success(`${next.length}개 차시 · 강사 매칭 ${okI}건${ngI > 0 ? `/미매칭 ${ngI}` : ''} · 멘토 매칭 ${okM}건${ngM > 0 ? `/미매칭 ${ngM}` : ''}`);
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
        instructor_name_raw: (s.instructor_names ?? []).join(', ') || null,
      }));
      const ins = await supabase.from('program_curriculum').insert(rows).select('id');
      if (ins.error) throw ins.error;
      const inserted = (ins.data ?? []) as { id: string }[];

      // 매칭된 강사·멘토 → curriculum_staff INSERT (역할별)
      let totalI = 0; let totalM = 0; const allUnmatched: string[] = [];
      for (let i = 0; i < filtered.length; i += 1) {
        const id = inserted[i]?.id;
        if (!id) continue;
        const ri = await matchAndLinkByRole(filtered[i].instructor_names ?? [], id, '강사');
        const rm = await matchAndLinkByRole(filtered[i].mentor_names ?? [], id, '멘토');
        totalI += ri.matched; totalM += rm.matched;
        allUnmatched.push(...ri.unmatched, ...rm.unmatched);
      }

      const baseMsg = `${rows.length}개 차시 등록 완료 · 강사 ${totalI}건 / 멘토 ${totalM}건 자동 매핑`;
      if (allUnmatched.length > 0) {
        toast.success(`${baseMsg}. ⚠ 미매칭 ${allUnmatched.length}명 — 등록 후 [강사 요청]으로 초대하세요.`);
      } else {
        toast.success(baseMsg);
      }
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
    e.preventDefault(); setDragActive(false);
    const f = e.dataTransfer?.files?.[0];
    if (f) setFile(f);
  };

  return (
    <section className="rounded-xl border-2 border-dashed border-violet-200 bg-violet-50/50 p-4 space-y-3">
      <div className="flex items-center gap-1.5">
        <Sparkles size={14} className="text-violet-500" aria-hidden="true" />
        <p className="text-sm font-bold text-violet-800">커리큘럼 — 문서 추출 + 강사·멘토 다중 매칭</p>
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
                <p className="text-xs text-slate-700 font-semibold">파일을 여기에 드래그하면 AI가 차시 + 강사·멘토 자동 추출</p>
                <p className="text-[11px] text-slate-500 mt-0.5">클릭해서 파일 선택도 가능 · PDF·이미지·DOCX·XLSX 지원</p>
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
                {extracting ? '추출 중…' : 'AI로 차시 + 강사·멘토 자동 추출'}
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <p className="text-[11px] text-violet-700">
            {drafts.length}개 차시 · 매칭 결과 검토 후 등록 (현재 차시 {lastSessionNo}개 뒤에 추가)
          </p>
          <ul className="rounded-lg border border-violet-100 bg-white max-h-[480px] overflow-y-auto divide-y divide-violet-100">
            {drafts.map((s, idx) => (
              <li key={idx} className="px-2 py-1.5 text-xs">
                <div className="grid grid-cols-[24px_minmax(60px,80px)_minmax(80px,100px)_minmax(0,1fr)_minmax(140px,180px)_minmax(140px,180px)_22px_22px] items-center gap-2">
                  <span className="text-violet-600 font-bold tabular-nums text-center">{lastSessionNo + idx + 1}</span>
                  <input type="text" value={s.day_label ?? ''} onChange={(e) => patchDraft(idx, { day_label: e.target.value })}
                    placeholder="1일차" className="rounded border border-slate-200 px-1.5 py-1 focus:outline-none focus:border-violet-400" />
                  <input type="text" readOnly value={(s.start_time ?? '') + (s.end_time ? `~${s.end_time}` : '')}
                    placeholder="펼침 편집"
                    className="rounded border border-slate-100 bg-slate-50 px-1.5 py-1 text-slate-500 cursor-not-allowed" title="펼침에서 편집" />
                  <input type="text" value={s.title} onChange={(e) => patchDraft(idx, { title: e.target.value })}
                    placeholder="차시명" className="rounded border border-slate-200 px-1.5 py-1 font-semibold focus:outline-none focus:border-violet-400" />
                  <InstructorMentorCell names={s.instructor_names ?? []} matches={s.instructorMatches}
                    onChange={(names, m) => patchDraft(idx, { instructor_names: names, instructorMatches: m })}
                    placeholder="강사" />
                  <InstructorMentorCell names={s.mentor_names ?? []} matches={s.mentorMatches}
                    onChange={(names, m) => patchDraft(idx, { mentor_names: names, mentorMatches: m })}
                    placeholder="멘토" />
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
