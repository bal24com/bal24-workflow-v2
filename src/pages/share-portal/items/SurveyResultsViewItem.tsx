// 박경수님 2026-06-02 STEP-SURVEY-RESULTS-B — 외부 토큰 페이지 동적 설문 결과 조회 항목.
// 지원기관 등이 자기 토큰으로 접속 시 수혜기관·참여팀 응답 결과를 집계·열람.
// 응답 폼이 아니라 결과 조회 전용 (read-only).

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, BarChart3, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import type { ProgramSurveyForm, SurveyFormQuestion } from '../../../types/database';
import { SURVEY_FORM_KIND_LABEL } from '../../../types/database';
import ItemCard from './ItemCard';

interface Props {
  programId: string;
}

interface ResponseRow {
  id: string;
  form_id: string | null;
  respondent_token: string | null;
  respondent_role: string | null;
  answer_text: string | null;
  answer_score: number | null;
  created_at: string;
}

const ROLE_LABEL: Record<string, string> = {
  supporter:   '지원기관',
  beneficiary: '수혜기관',
  team:        '참여팀(개인)',
  staff:       '강사/멘토',
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export default function SurveyResultsViewItem({ programId }: Props) {
  const [forms, setForms] = useState<ProgramSurveyForm[]>([]);
  const [responsesByForm, setResponsesByForm] = useState<Map<string, ResponseRow[]>>(new Map());
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const fRes = await supabase
      .from('program_survey_forms')
      .select('*')
      .eq('program_id', programId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    if (fRes.error) {
      console.error('[SurveyResultsViewItem] 설문 조회 실패:', fRes.error.message);
      setForms([]);
      setLoading(false);
      return;
    }
    const list = (fRes.data ?? []) as ProgramSurveyForm[];
    setForms(list);

    if (list.length > 0) {
      const rRes = await supabase
        .from('survey_responses')
        .select('id, form_id, respondent_token, respondent_role, answer_text, answer_score, created_at')
        .in('form_id', list.map((f) => f.id))
        .order('created_at', { ascending: false });
      if (rRes.error) {
        console.error('[SurveyResultsViewItem] 응답 조회 실패:', rRes.error.message);
        setResponsesByForm(new Map());
      } else {
        const map = new Map<string, ResponseRow[]>();
        ((rRes.data ?? []) as ResponseRow[]).forEach((r) => {
          if (!r.form_id) return;
          const arr = map.get(r.form_id) ?? [];
          arr.push(r);
          map.set(r.form_id, arr);
        });
        setResponsesByForm(map);
      }
    } else {
      setResponsesByForm(new Map());
    }
    setLoading(false);
  }, [programId]);

  useEffect(() => { void reload(); }, [reload]);

  if (loading) {
    return (
      <ItemCard icon={<BarChart3 size={18} />} title="설문 응답 결과">
        <div className="flex justify-center py-4">
          <Loader2 size={16} className="animate-spin text-violet-400" aria-hidden="true" />
        </div>
      </ItemCard>
    );
  }

  if (forms.length === 0) return null;

  return (
    <ItemCard icon={<BarChart3 size={18} className="text-violet-600" />} title="설문 응답 결과">
      <div className="space-y-3">
        {forms.map((f) => (
          <FormResultBlock key={f.id} form={f} responses={responsesByForm.get(f.id) ?? []} />
        ))}
      </div>
    </ItemCard>
  );
}

function FormResultBlock({ form, responses }: { form: ProgramSurveyForm; responses: ResponseRow[] }) {
  const [showAll, setShowAll] = useState(false);

  const questions = useMemo(() => form.questions ?? [], [form]);

  // 응답자 단위 묶음
  const responseSets = useMemo(() => {
    const map = new Map<string, ResponseRow[]>();
    responses.forEach((r) => {
      const key = `${r.respondent_token ?? 'anon'}_${r.created_at.slice(0, 16)}`;
      const list = map.get(key) ?? [];
      list.push(r);
      map.set(key, list);
    });
    return Array.from(map.values()).map((list) => ({
      role: list[0].respondent_role ?? '미지정',
      created_at: list[0].created_at,
      answers: list,
    }));
  }, [responses]);

  // 역할별 응답 카운트
  const byRole = useMemo(() => {
    const counts: Record<string, number> = {};
    responseSets.forEach((s) => {
      counts[s.role] = (counts[s.role] ?? 0) + 1;
    });
    return counts;
  }, [responseSets]);

  // select / checkbox 집계
  const aggregates = useMemo(() => {
    return questions.map((q, idx) => {
      if (q.type !== 'select' && q.type !== 'checkbox') return null;
      const tally: Record<string, number> = {};
      responseSets.forEach((set) => {
        const ans = set.answers[idx]?.answer_text ?? '';
        if (!ans) return;
        ans.split(',').map((s) => s.trim()).filter(Boolean).forEach((v) => {
          tally[v] = (tally[v] ?? 0) + 1;
        });
      });
      return { q, tally };
    }).filter((x): x is { q: SurveyFormQuestion; tally: Record<string, number> } => x !== null);
  }, [questions, responseSets]);

  return (
    <div className="rounded-xl border border-violet-100 bg-violet-50/30 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <h4 className="text-sm font-bold text-[#1E1B4B] truncate">{form.title}</h4>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {SURVEY_FORM_KIND_LABEL[form.kind] ?? form.kind} · 응답 <strong className="text-violet-700">{responseSets.length}</strong>건
          </p>
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {Object.entries(byRole).map(([role, n]) => (
            <span key={role} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-violet-100 text-[10px] text-violet-700">
              {ROLE_LABEL[role] ?? role} <strong>{n}</strong>
            </span>
          ))}
        </div>
      </div>

      {/* 선택형 집계 */}
      {aggregates.length > 0 && (
        <div className="space-y-1.5 pt-2 border-t border-violet-100">
          {aggregates.map(({ q, tally }) => {
            const entries = Object.entries(tally).sort((a, b) => b[1] - a[1]);
            return (
              <div key={q.id} className="text-xs">
                <p className="text-slate-700 font-semibold mb-1">{q.label}</p>
                <div className="flex items-center gap-1 flex-wrap">
                  {entries.length === 0 ? (
                    <span className="text-slate-300 italic">응답 없음</span>
                  ) : entries.map(([ans, n]) => (
                    <span key={ans} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-violet-100 text-violet-700">
                      {ans} <strong className="tabular-nums">{n}</strong>
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 응답 상세 토글 */}
      {responseSets.length > 0 && (
        <>
          <button type="button" onClick={() => setShowAll((v) => !v)}
            className="w-full inline-flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-semibold text-slate-600 hover:bg-white border border-slate-200">
            {showAll ? <><ChevronUp size={11} /> 응답 상세 숨기기</> : <><ChevronDown size={11} /> 응답 {responseSets.length}건 상세 보기</>}
          </button>
          {showAll && (
            <ul className="space-y-2 pt-1">
              {responseSets.map((set, i) => (
                <li key={i} className="rounded-lg border border-slate-200 bg-white p-2.5 space-y-1.5">
                  <div className="flex items-center gap-2 text-[10px] text-slate-500">
                    <FileText size={10} aria-hidden="true" />
                    <span className="font-bold text-slate-700">{ROLE_LABEL[set.role] ?? set.role}</span>
                    <span>· {fmtDate(set.created_at)}</span>
                  </div>
                  <div className="space-y-0.5">
                    {questions.map((q, idx) => {
                      const a = set.answers[idx];
                      const v = a?.answer_text ?? (a?.answer_score != null ? String(a.answer_score) : '');
                      return (
                        <div key={q.id} className="flex gap-2 text-[11px]">
                          <span className="text-slate-500 w-28 shrink-0 truncate">{q.label}</span>
                          <span className={`flex-1 min-w-0 break-words ${v ? 'text-slate-700' : 'text-slate-300 italic'}`}>
                            {v || '미응답'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
