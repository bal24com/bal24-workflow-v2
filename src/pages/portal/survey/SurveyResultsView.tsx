// 설문 결과 집계 뷰 — 학교·지원청 공용.
// 박경수님 2026-05-28 STEP-SCHOOL-PORTAL PART D-4.
// rating 평균 + 5점 막대 / choice 보기별 % / text 응답 목록 + CSV 다운로드.

import { useEffect, useState } from 'react';
import { Loader2, Download } from 'lucide-react';
import { getSurveyResults } from '../../../hooks/portal/useSurvey';
import type { SurveyQuestion, SurveyResponse } from '../../../types/schoolPortal';

interface Props {
  surveyId: string;
  surveyTitle: string;
  viewScope?: 'school' | 'all';
}

export default function SurveyResultsView({ surveyId, surveyTitle, viewScope = 'school' }: Props) {
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const r = await getSurveyResults(surveyId);
      if (cancelled) return;
      setQuestions(r.questions);
      setResponses(r.responses);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [surveyId]);

  const downloadCsv = () => {
    if (questions.length === 0 || responses.length === 0) return;
    const header = ['응답자', '제출시각', ...questions.map((q) => q.question_text)];
    const rows = responses.map((r) => [
      r.respondent_name ?? '',
      r.submitted_at,
      ...questions.map((q) => {
        const v = (r.answers as Record<string, unknown>)[q.id];
        return v == null ? '' : String(v);
      }),
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const bom = '﻿'; // Excel 한글 호환
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${surveyTitle}_응답.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="animate-spin text-violet-500" size={20} /></div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-600">응답 <b className="text-violet-700">{responses.length}</b>건</span>
        <button type="button" onClick={downloadCsv} disabled={responses.length === 0}
          className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-50">
          <Download size={12} /> CSV 다운로드
        </button>
      </div>

      {responses.length === 0 ? (
        <p className="text-sm text-slate-400 italic text-center py-8">아직 응답이 없어요.</p>
      ) : (
        <div className="space-y-3">
          {questions.map((q, i) => (
            <div key={q.id} className="border border-slate-200 rounded-xl p-4">
              <p className="font-semibold text-sm mb-2">{i + 1}. {q.question_text}</p>
              <QuestionStats q={q} responses={responses} />
            </div>
          ))}
        </div>
      )}

      {viewScope === 'all' && (
        <p className="text-[11px] text-slate-400 italic">
          ※ 학교별 평균 비교는 곧 제공돼요.
        </p>
      )}
    </div>
  );
}

function QuestionStats({ q, responses }: { q: SurveyQuestion; responses: SurveyResponse[] }) {
  if (q.question_type === 'rating') {
    const vals = responses
      .map((r) => Number((r.answers as Record<string, unknown>)[q.id]))
      .filter((n) => !Number.isNaN(n) && n > 0);
    if (vals.length === 0) return <p className="text-xs text-slate-400">응답 없음</p>;
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    const counts = [1, 2, 3, 4, 5].map((n) => vals.filter((v) => v === n).length);
    const max = Math.max(...counts);
    return (
      <div>
        <p className="text-sm mb-2">
          평균 <b className="text-2xl text-violet-700">{avg.toFixed(1)}</b>
          <span className="text-xs text-slate-400 ml-1">/ 5점 · {vals.length}명</span>
        </p>
        <div className="space-y-1">
          {[5, 4, 3, 2, 1].map((n) => {
            const c = counts[n - 1];
            const pct = max > 0 ? (c / max) * 100 : 0;
            return (
              <div key={n} className="flex items-center gap-2 text-xs">
                <span className="w-5 font-bold text-slate-500">{n}점</span>
                <div className="flex-1 bg-slate-100 rounded h-3 overflow-hidden">
                  <div className="h-full bg-violet-500" style={{ width: `${pct}%` }} />
                </div>
                <span className="w-10 text-right text-slate-500 tabular-nums">{c}건</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  if (q.question_type === 'choice') {
    const counts = new Map<string, number>();
    for (const r of responses) {
      const v = String((r.answers as Record<string, unknown>)[q.id] ?? '');
      if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    const total = Array.from(counts.values()).reduce((a, b) => a + b, 0);
    if (total === 0) return <p className="text-xs text-slate-400">응답 없음</p>;
    return (
      <div className="space-y-1.5">
        {Array.from(counts.entries()).map(([k, v]) => {
          const pct = (v / total) * 100;
          return (
            <div key={k} className="text-xs">
              <div className="flex justify-between mb-0.5">
                <span>{k}</span>
                <span className="text-slate-500 tabular-nums">{v}건 ({pct.toFixed(0)}%)</span>
              </div>
              <div className="bg-slate-100 rounded h-2.5 overflow-hidden">
                <div className="h-full bg-cyan-500" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    );
  }
  // text
  const texts = responses
    .map((r) => ({ name: r.respondent_name, text: String((r.answers as Record<string, unknown>)[q.id] ?? '').trim() }))
    .filter((t) => t.text);
  if (texts.length === 0) return <p className="text-xs text-slate-400">응답 없음</p>;
  return (
    <ul className="space-y-1.5 text-sm max-h-60 overflow-y-auto">
      {texts.map((t, i) => (
        <li key={i} className="border-l-2 border-violet-200 pl-2 py-0.5">
          <span className="text-[11px] text-slate-400">{t.name ?? '익명'}</span>
          <p className="text-slate-700">{t.text}</p>
        </li>
      ))}
    </ul>
  );
}
