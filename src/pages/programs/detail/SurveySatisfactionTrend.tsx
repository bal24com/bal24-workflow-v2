// 박경수님 2026-06-08 #2 — 만족도 누적 추이 (만족도·중간 설문의 숫자 문항 평균을 회차별 집계).
// 여러 만족도 설문이 쌓이면 회차별 평균 점수·응답수 추이를 한눈에 비교.

import { useCallback, useEffect, useState } from 'react';
import { Loader2, TrendingUp } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { SURVEY_FORM_KIND_LABEL, type ProgramSurveyForm } from '../../../types/database';

interface Props {
  programId: string;
}

interface TrendRow {
  form: ProgramSurveyForm;
  avg: number | null;       // 숫자 문항 평균 (응답 전체)
  scoreCount: number;       // 평균에 쓰인 점수 개수
  respondents: number;      // 응답자(팀) 수
}

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function SurveySatisfactionTrend({ programId }: Props) {
  const [rows, setRows] = useState<TrendRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    // 만족도/중간 설문만 (수요조사·기타 제외)
    const fRes = await supabase
      .from('program_survey_forms')
      .select('*')
      .eq('program_id', programId)
      .in('kind', ['satisfaction', 'mid'])
      .order('created_at', { ascending: true });
    if (fRes.error) {
      console.error('[SurveySatisfactionTrend] 설문 조회 실패:', fRes.error.message);
      setRows([]); setLoading(false); return;
    }
    const forms = (fRes.data ?? []) as ProgramSurveyForm[];
    if (forms.length === 0) { setRows([]); setLoading(false); return; }

    const rRes = await supabase
      .from('survey_responses')
      .select('form_id, answer_score, respondent_token, created_at')
      .in('form_id', forms.map((f) => f.id));
    const byForm = new Map<string, { scores: number[]; resp: Set<string> }>();
    if (!rRes.error) {
      (rRes.data ?? []).forEach((row) => {
        const r = row as { form_id: string | null; answer_score: number | null; respondent_token: string | null; created_at: string | null };
        if (!r.form_id) return;
        const e = byForm.get(r.form_id) ?? { scores: [], resp: new Set<string>() };
        if (typeof r.answer_score === 'number') e.scores.push(r.answer_score);
        e.resp.add(`${r.respondent_token ?? 'anon'}_${(r.created_at ?? '').slice(0, 16)}`);
        byForm.set(r.form_id, e);
      });
    }

    setRows(forms.map((f) => {
      const e = byForm.get(f.id);
      const scores = e?.scores ?? [];
      const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
      return { form: f, avg, scoreCount: scores.length, respondents: e?.resp.size ?? 0 };
    }));
    setLoading(false);
  }, [programId]);

  useEffect(() => { void load(); }, [load]);

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 size={16} className="animate-spin text-violet-400" aria-hidden="true" />
      </div>
    );
  }
  if (rows.length === 0) return null; // 만족도 설문 없으면 숨김

  const maxAvg = Math.max(...rows.map((r) => r.avg ?? 0), 5);

  return (
    <section className="rounded-2xl border border-violet-100 bg-white p-3 space-y-3">
      <h3 className="text-sm font-bold text-[#1E1B4B] inline-flex items-center gap-1.5">
        <TrendingUp size={14} className="text-violet-600" aria-hidden="true" />
        만족도 누적 추이 ({rows.length}회차)
      </h3>
      <ul className="space-y-2">
        {rows.map((r, i) => {
          const pct = r.avg != null ? Math.min(100, (r.avg / maxAvg) * 100) : 0;
          return (
            <li key={r.form.id} className="space-y-1">
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span className="font-semibold text-[#1E1B4B] truncate">
                  <span className="text-slate-400 mr-1">{i + 1}회</span>
                  {r.form.title}
                  <span className="ml-1 text-slate-400">· {SURVEY_FORM_KIND_LABEL[r.form.kind] ?? r.form.kind} · {fmtDate(r.form.created_at)}</span>
                </span>
                <span className="shrink-0 text-slate-500">
                  응답 <strong className="text-violet-700">{r.respondents}</strong>건
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-3 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-violet-400 to-violet-600 rounded-full" style={{ width: `${pct}%` }} aria-hidden="true" />
                </div>
                <span className="shrink-0 w-16 text-right text-xs font-bold text-violet-700 tabular-nums">
                  {r.avg != null ? `${r.avg.toFixed(2)}점` : '—'}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-[10px] text-slate-400">숫자 문항 응답의 평균이에요. 평점 문항은 설문 만들 때 '숫자' 타입으로 넣어 주세요.</p>
    </section>
  );
}
