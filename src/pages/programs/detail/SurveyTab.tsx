// bal24 v2 — STEP-SURVEY 프로그램 만족도 탭 (V9 신규 in-page + 기존 외부 폼 통계)

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Star, Trash2, Save, MessageSquare } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../contexts/ToastContext';
import SurveyResultTab from './SurveyResultTab';
import type {
  SurveyQuestion, SurveyResponse,
  SurveyQuestionType, SurveyQuestionPhase,
} from '../../../types/database';

interface Props {
  programId: string;
  canEdit: boolean;
}

interface DraftQuestion {
  id: string;       // 신규는 'new-...', 기존은 row id
  isNew: boolean;
  question_text: string;
  question_type: SurveyQuestionType;
  phase: SurveyQuestionPhase;
}

const PHASE_OPTIONS: { value: SurveyQuestionPhase; label: string }[] = [
  { value: 'pre',  label: '사전' },
  { value: 'post', label: '사후' },
  { value: 'both', label: '사전·사후' },
];

function tempId(): string {
  return `new-${Math.random().toString(36).slice(2, 10)}`;
}

function phaseBadgeClass(phase: SurveyQuestionPhase): string {
  if (phase === 'pre')  return 'bg-blue-100 text-blue-700';
  if (phase === 'post') return 'bg-violet-100 text-violet-700';
  return 'bg-amber-100 text-amber-700';
}

export default function SurveyTab({ programId, canEdit }: Props) {
  const toast = useToast();
  const [questions, setQuestions] = useState<DraftQuestion[]>([]);
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [originalIds, setOriginalIds] = useState<Set<string>>(new Set());

  const reload = useCallback(async () => {
    setLoading(true);
    const [qRes, rRes] = await Promise.all([
      supabase.from('survey_questions').select('*').eq('program_id', programId).order('order_index'),
      supabase.from('survey_responses').select('*').eq('program_id', programId),
    ]);
    if (qRes.error) console.error('[survey] 문항 조회 실패:', qRes.error.message);
    if (rRes.error) console.error('[survey] 응답 조회 실패:', rRes.error.message);
    const rows = (qRes.data ?? []) as SurveyQuestion[];
    setQuestions(rows.map((q) => ({
      id: q.id, isNew: false,
      question_text: q.question_text,
      question_type: q.question_type,
      phase: q.phase,
    })));
    setOriginalIds(new Set(rows.map((q) => q.id)));
    setResponses((rRes.data ?? []) as SurveyResponse[]);
    setLoading(false);
  }, [programId]);

  useEffect(() => {
    if (!programId) return;
    let cancelled = false;
    void (async () => {
      await reload();
      if (cancelled) return;
    })();
    return () => { cancelled = true; };
  }, [reload, programId]);

  function addQuestion(type: SurveyQuestionType) {
    setQuestions((prev) => [
      ...prev,
      { id: tempId(), isNew: true, question_text: '', question_type: type, phase: 'post' },
    ]);
  }

  function patchQuestion(id: string, patch: Partial<DraftQuestion>) {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  }

  function removeQuestion(id: string) {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  }

  async function handleSave() {
    if (questions.some((q) => !q.question_text.trim())) {
      toast.error('빈 문항이 있어요. 내용을 입력해 주세요.');
      return;
    }
    setSaving(true);
    try {
      // 1) 삭제 — 원본에 있었으나 현재 목록에 없는 id
      const currentIds = new Set(questions.filter((q) => !q.isNew).map((q) => q.id));
      const toDelete = [...originalIds].filter((id) => !currentIds.has(id));
      if (toDelete.length > 0) {
        const { error } = await supabase.from('survey_questions').delete().in('id', toDelete);
        if (error) throw error;
      }
      // 2) 기존 UPDATE
      for (let i = 0; i < questions.length; i += 1) {
        const q = questions[i];
        if (q.isNew) continue;
        const { error } = await supabase.from('survey_questions').update({
          question_text: q.question_text.trim(),
          question_type: q.question_type,
          phase: q.phase,
          order_index: i,
        }).eq('id', q.id);
        if (error) throw error;
      }
      // 3) 신규 INSERT
      const news = questions
        .map((q, idx) => ({ q, idx }))
        .filter(({ q }) => q.isNew)
        .map(({ q, idx }) => ({
          program_id: programId,
          order_index: idx,
          question_text: q.question_text.trim(),
          question_type: q.question_type,
          phase: q.phase,
        }));
      if (news.length > 0) {
        const { error } = await supabase.from('survey_questions').insert(news);
        if (error) throw error;
      }
      await reload();
      toast.success('만족도 문항을 저장했어요.');
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[survey] 저장 실패:', raw);
      toast.error('저장 중 오류가 발생했어요.');
    } finally {
      setSaving(false);
    }
  }

  // 문항별 응답 통계
  const stats = useMemo(() => {
    const byQ = new Map<string, { scores: number[]; texts: number }>();
    for (const r of responses) {
      const cur = byQ.get(r.question_id) ?? { scores: [], texts: 0 };
      if (typeof r.answer_score === 'number') cur.scores.push(r.answer_score);
      if (r.answer_text) cur.texts += 1;
      byQ.set(r.question_id, cur);
    }
    return byQ;
  }, [responses]);

  const dirty = useMemo(() => {
    if (questions.some((q) => q.isNew)) return true;
    if (questions.length !== originalIds.size) return true;
    // 텍스트·타입·phase 변경 추적은 비용 큼 — 간단히 dirty=true 시 저장 가능 보장
    return false;
  }, [questions, originalIds]);

  return (
    <div className="flex flex-col gap-6">
      {/* 상단 — V9 신규 in-page 만족도 */}
      <section className="rounded-2xl border border-violet-100 bg-white shadow-[0_4px_16px_rgba(124,58,237,0.06)] p-4">
        <header className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <p className="text-sm font-bold text-[#1E1B4B]">만족도 문항</p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              운영자가 직접 문항을 등록하면 참여자가 응답할 수 있어요.
            </p>
          </div>
          {canEdit && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => addQuestion('star')}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-violet-100 bg-white text-xs font-semibold text-violet-700 hover:bg-violet-50 transition-colors"
              >
                <Star size={12} aria-hidden="true" />
                + 별점 문항
              </button>
              <button
                type="button"
                onClick={() => addQuestion('text')}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-violet-100 bg-white text-xs font-semibold text-violet-700 hover:bg-violet-50 transition-colors"
              >
                <MessageSquare size={12} aria-hidden="true" />
                + 서술 문항
              </button>
            </div>
          )}
        </header>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin text-violet-400" size={20} aria-hidden="true" />
          </div>
        ) : questions.length === 0 ? (
          <p className="text-sm text-slate-400 italic text-center py-8">
            문항을 추가하면 참여자가 응답할 수 있어요.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {questions.map((q, idx) => {
              const s = stats.get(q.id);
              const avg = s && s.scores.length > 0
                ? (s.scores.reduce((a, b) => a + b, 0) / s.scores.length)
                : null;
              return (
                <div
                  key={q.id}
                  className="grid grid-cols-[36px_minmax(160px,1fr)_minmax(180px,2fr)_minmax(120px,140px)_28px] items-center gap-2 px-2 py-2 rounded-xl border border-violet-100 bg-white"
                >
                  <span className="text-center text-xs font-bold text-slate-400 tabular-nums">
                    {idx + 1}
                  </span>

                  {/* phase 선택 — segmented */}
                  <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                    {PHASE_OPTIONS.map((opt) => {
                      const active = q.phase === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => canEdit && patchQuestion(q.id, { phase: opt.value })}
                          disabled={!canEdit}
                          className={[
                            'px-2 py-1 rounded-md text-[11px] font-semibold transition-colors',
                            active
                              ? phaseBadgeClass(opt.value)
                              : 'text-slate-500 hover:bg-white',
                            !canEdit ? 'cursor-default' : '',
                          ].join(' ')}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* 문항 내용 */}
                  <div className="flex items-center gap-2 min-w-0">
                    {q.question_type === 'star' ? (
                      <Star size={13} className="text-amber-500 shrink-0" aria-hidden="true" />
                    ) : (
                      <MessageSquare size={13} className="text-violet-500 shrink-0" aria-hidden="true" />
                    )}
                    <input
                      type="text"
                      value={q.question_text}
                      onChange={(e) => patchQuestion(q.id, { question_text: e.target.value })}
                      disabled={!canEdit}
                      placeholder={q.question_type === 'star' ? '예) 전반적으로 만족하셨나요?' : '예) 가장 인상 깊었던 점은?'}
                      className="h-8 px-2 rounded-md border border-violet-100 bg-white text-xs flex-1 focus:outline-none focus:border-violet-400 disabled:bg-slate-50 disabled:text-slate-600"
                    />
                  </div>

                  {/* 응답 통계 */}
                  <div className="text-[11px] text-slate-500 truncate">
                    {!s || (s.scores.length === 0 && s.texts === 0) ? (
                      <span className="text-slate-300 italic">응답 없음</span>
                    ) : q.question_type === 'star' ? (
                      <span className="inline-flex items-center gap-1">
                        <Star size={11} className="text-amber-500" aria-hidden="true" />
                        평균 <strong className="text-slate-700">{avg?.toFixed(2)}</strong>
                        <span className="text-slate-400">({s.scores.length})</span>
                      </span>
                    ) : (
                      <span><strong className="text-slate-700">{s.texts}</strong>건 응답</span>
                    )}
                  </div>

                  {canEdit ? (
                    <button
                      type="button"
                      onClick={() => removeQuestion(q.id)}
                      aria-label="문항 삭제"
                      className="inline-flex items-center justify-center w-7 h-7 rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-500"
                    >
                      <Trash2 size={12} aria-hidden="true" />
                    </button>
                  ) : (
                    <span aria-hidden="true" />
                  )}
                </div>
              );
            })}

            {canEdit && (
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={saving || (!dirty && originalIds.size === 0 && questions.length === 0)}
                  className="inline-flex items-center gap-1 px-4 py-2 rounded-xl bg-violet-600 text-white text-xs font-semibold hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Save size={12} aria-hidden="true" />
                  {saving ? '저장 중…' : '저장하기'}
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* 하단 — 기존 외부 폼 발송·통계 */}
      <SurveyResultTab programId={programId} />
    </div>
  );
}
