// 박경수님 2026-06-08 — 설문 응답 화면 미리보기 (PM 전용, 실제 제출 없음)
// URL: /survey-preview/:formId

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, ClipboardList, Eye } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import type { ProgramSurveyForm, SurveyFormQuestion } from '../../../types/database';

const ROLE_LABEL: Record<string, string> = {
  supporter: '지원기관', beneficiary: '수혜기관', team: '참여팀(개인)', staff: '강사/멘토',
};

export default function SurveyPreviewPage() {
  const { formId } = useParams<{ formId: string }>();
  const [form, setForm] = useState<ProgramSurveyForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!formId) { setError('잘못된 링크예요.'); setLoading(false); return; }
    const { data, error: e } = await supabase
      .from('program_survey_forms')
      .select('*')
      .eq('id', formId)
      .single();
    if (e || !data) { setError('설문을 찾을 수 없어요.'); setLoading(false); return; }
    setForm(data as ProgramSurveyForm);
    setLoading(false);
  }, [formId]);

  useEffect(() => { void load(); }, [load]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 size={24} className="animate-spin text-violet-400" aria-hidden="true" />
    </div>
  );

  if (error || !form) return (
    <div className="min-h-screen flex items-center justify-center text-slate-500">{error ?? '오류'}</div>
  );

  const questions: SurveyFormQuestion[] = form.questions ?? [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 to-slate-50 py-10 px-4">
      <div className="max-w-xl mx-auto space-y-4">
        {/* 미리보기 배너 */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold">
          <Eye size={13} aria-hidden="true" />
          PM 미리보기 모드 — 실제 제출되지 않아요
        </div>

        {/* 설문 카드 */}
        <div className="bg-white rounded-2xl shadow-[0_8px_32px_rgba(124,58,237,0.10)] overflow-hidden">
          {/* 상단 헤더 */}
          <div className="bg-gradient-to-r from-violet-600 to-violet-700 px-6 py-5">
            <div className="flex items-center gap-2 mb-1">
              <ClipboardList size={16} className="text-violet-200" aria-hidden="true" />
              <span className="text-[11px] font-bold text-violet-200 uppercase tracking-widest">설문 조사</span>
            </div>
            <h1 className="text-xl font-bold text-white">{form.title}</h1>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {(form.target_audiences ?? []).map((r) => (
                <span key={r} className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/20 text-white">
                  {ROLE_LABEL[r] ?? r}
                </span>
              ))}
            </div>
          </div>

          <div className="px-6 py-5 space-y-5">
            {/* 안내문 */}
            {form.description && form.description.trim() && (
              <div className="rounded-xl bg-violet-50 border border-violet-100 px-4 py-3 text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                {form.description}
              </div>
            )}

            {/* 문항 목록 */}
            {questions.length === 0 ? (
              <p className="text-sm text-slate-400 italic text-center py-6">
                아직 문항이 없어요.
              </p>
            ) : (
              questions.map((q, i) => <PreviewField key={q.id} q={q} index={i + 1} />)
            )}

            {/* 제출 버튼 (비활성 — 미리보기용) */}
            <button type="button" disabled
              className="w-full h-12 rounded-xl bg-gradient-to-r from-violet-400 to-violet-500 text-white text-sm font-bold opacity-50 cursor-not-allowed">
              제출하기 (미리보기에서는 비활성)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewField({ q, index }: { q: SurveyFormQuestion; index: number }) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-start gap-1.5 text-sm font-bold text-[#1E1B4B]">
        <span className="text-slate-400 font-normal tabular-nums shrink-0">{index}.</span>
        <span>{q.label}{q.required && <span className="text-rose-500 ml-0.5">*</span>}</span>
      </label>
      {(q.type === 'text') && (
        <input type="text" disabled placeholder="단답 응답 입력"
          className="w-full h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm" />
      )}
      {(q.type === 'textarea') && (
        <textarea disabled rows={3} placeholder="서술형 응답 입력"
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm resize-none" />
      )}
      {(q.type === 'number') && (
        <input type="number" disabled placeholder="숫자"
          className="w-32 h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm" />
      )}
      {(q.type === 'date') && (
        <input type="date" disabled
          className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm" />
      )}
      {(q.type === 'select') && (
        <select disabled className="w-full h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm">
          <option>선택해 주세요</option>
          {(q.options ?? []).map((o) => <option key={o}>{o}</option>)}
        </select>
      )}
      {(q.type === 'checkbox') && (
        <div className="grid grid-cols-2 gap-1.5">
          {(q.options ?? []).map((o) => (
            <label key={o} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
              <input type="checkbox" disabled className="rounded" /> {o}
            </label>
          ))}
        </div>
      )}
      {(q.type === 'date-schedule') && (
        <div className="space-y-2">
          {(q.options ?? []).map((m) => (
            <div key={m} className="rounded-xl border border-violet-100 bg-violet-50/30 px-3 py-2.5">
              <p className="text-xs font-bold text-violet-700 mb-1.5">{m}</p>
              {Array.from({ length: q.priorities ?? 2 }, (_, pi) => (
                <div key={pi} className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold text-slate-400 w-10">{pi + 1}순위</span>
                  <input type="date" disabled className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs flex-1" />
                  <input type="text" disabled placeholder="시간" className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs w-24" />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
      {(q.type === 'club-autofill') && (
        <select disabled className="w-full h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm">
          <option>동아리 선택 → 지도교사 자동 완성</option>
        </select>
      )}
    </div>
  );
}
