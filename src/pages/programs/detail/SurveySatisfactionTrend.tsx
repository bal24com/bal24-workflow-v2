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

  // 박경수님 2026-06-08 B — 회차별 평균 점수 꺾은선(라인) 차트
  const W = 520, H = 140, padL = 28, padR = 12, padT = 12, padB = 26;
  const maxAvg = Math.max(...rows.map((r) => r.avg ?? 0), 5);
  const n = rows.length;
  const xAt = (i: number) => padL + (n <= 1 ? (W - padL - padR) / 2 : (i * (W - padL - padR)) / (n - 1));
  const yAt = (v: number) => padT + (H - padT - padB) * (1 - v / maxAvg);
  const pts = rows.map((r, i) => ({ x: xAt(i), y: r.avg != null ? yAt(r.avg) : null, r, i }));
  const linePts = pts.filter((p) => p.y != null) as Array<{ x: number; y: number; r: TrendRow; i: number }>;
  const path = linePts.map((p, k) => `${k === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

  return (
    <section className="rounded-2xl border border-violet-100 bg-white p-3 space-y-2">
      <h3 className="text-sm font-bold text-[#1E1B4B] inline-flex items-center gap-1.5">
        <TrendingUp size={14} className="text-violet-600" aria-hidden="true" />
        만족도 누적 추이 ({rows.length}회차)
      </h3>

      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[420px]" role="img" aria-label="만족도 회차별 평균 추이">
          {/* 가로 눈금 (0·중간·max) */}
          {[0, maxAvg / 2, maxAvg].map((g) => (
            <g key={g}>
              <line x1={padL} y1={yAt(g)} x2={W - padR} y2={yAt(g)} stroke="#eef2f7" strokeWidth={1} />
              <text x={padL - 5} y={yAt(g) + 3} textAnchor="end" fontSize={8} fill="#94a3b8">{g.toFixed(0)}</text>
            </g>
          ))}
          {/* 라인 */}
          {linePts.length > 1 && <path d={path} fill="none" stroke="#7C3AED" strokeWidth={2} />}
          {/* 점 + 값 + x라벨 */}
          {pts.map((p) => (
            <g key={p.r.form.id}>
              {p.y != null && <circle cx={p.x} cy={p.y} r={3.5} fill="#7C3AED" />}
              {p.y != null && p.r.avg != null && (
                <text x={p.x} y={p.y - 7} textAnchor="middle" fontSize={9} fontWeight="bold" fill="#6d28d9">{p.r.avg.toFixed(1)}</text>
              )}
              <text x={p.x} y={H - 14} textAnchor="middle" fontSize={8} fill="#475569">{p.i + 1}회</text>
              <text x={p.x} y={H - 4} textAnchor="middle" fontSize={7} fill="#94a3b8">{fmtDate(p.r.form.created_at)}</text>
            </g>
          ))}
        </svg>
      </div>

      {/* 회차 목록 (제목·응답수) */}
      <ul className="space-y-1">
        {rows.map((r, i) => (
          <li key={r.form.id} className="flex items-center justify-between gap-2 text-[11px]">
            <span className="truncate text-slate-600">
              <span className="text-slate-400 mr-1">{i + 1}회</span>{r.form.title}
              <span className="ml-1 text-slate-400">· {SURVEY_FORM_KIND_LABEL[r.form.kind] ?? r.form.kind}</span>
            </span>
            <span className="shrink-0 text-slate-500">
              {r.avg != null ? <strong className="text-violet-700">{r.avg.toFixed(2)}점</strong> : '—'} · 응답 {r.respondents}건
            </span>
          </li>
        ))}
      </ul>
      <p className="text-[10px] text-slate-400">숫자 문항 응답의 평균이에요. 평점 문항은 설문 만들 때 '숫자' 타입으로 넣어 주세요.</p>
    </section>
  );
}
