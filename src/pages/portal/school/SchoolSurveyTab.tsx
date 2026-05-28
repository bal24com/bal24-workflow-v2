// 학교담당자 포털 설문 탭 — 설문 목록·응답률·팀 발송.
// 박경수님 2026-05-28 STEP-SCHOOL-PORTAL.

import { useCallback, useEffect, useState } from 'react';
import { Loader2, ClipboardList, BarChart3 } from 'lucide-react';
import {
  getSurveysByProgram, countResponses, getSurveyResults,
} from '../../../hooks/portal/useSurvey';
import type { Survey, SchoolPortalContext, SurveyQuestion, SurveyResponse } from '../../../types/schoolPortal';

interface Props { context: SchoolPortalContext }

interface SurveyCard extends Survey {
  responseCount: number;
}

const TYPE_LABEL: Record<string, { label: string; tone: string }> = {
  satisfaction: { label: '만족도', tone: 'bg-emerald-100 text-emerald-700' },
  schedule:     { label: '일정',   tone: 'bg-amber-100 text-amber-700' },
  general:      { label: '일반',   tone: 'bg-slate-100 text-slate-700' },
};

export default function SchoolSurveyTab({ context }: Props) {
  const [surveys, setSurveys] = useState<SurveyCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalSurvey, setModalSurvey] = useState<SurveyCard | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const list = await getSurveysByProgram(context.programId);
    const cards: SurveyCard[] = [];
    for (const s of list) {
      const cnt = await countResponses(s.id);
      cards.push({ ...s, responseCount: cnt });
    }
    setSurveys(cards);
    setLoading(false);
  }, [context.programId]);

  useEffect(() => { void refresh(); }, [refresh]);

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-violet-500" size={24} /></div>;
  }

  return (
    <div className="space-y-4">
      <section className="bg-white rounded-2xl shadow-sm p-5">
        <h2 className="text-sm font-bold text-slate-700 mb-3 inline-flex items-center gap-1.5">
          <ClipboardList size={16} className="text-violet-500" aria-hidden="true" /> 진행 중인 설문 ({surveys.length})
        </h2>
        {surveys.length === 0 ? (
          <p className="text-sm text-slate-400 italic text-center py-8">
            등록된 설문이 없습니다. PM에게 문의하세요.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {surveys.map((s) => {
              const meta = TYPE_LABEL[s.survey_type] ?? TYPE_LABEL.general;
              return (
                <div key={s.id} className="border border-violet-100 rounded-xl p-4 hover:shadow-sm transition">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-bold text-slate-800 text-sm leading-snug flex-1">{s.title}</h3>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${meta.tone}`}>
                      {meta.label}
                    </span>
                  </div>
                  {s.description && <p className="text-xs text-slate-500 line-clamp-2 mb-2">{s.description}</p>}
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-3">
                    <span>응답 {s.responseCount}건</span>
                    {s.due_date && <span>마감 {s.due_date}</span>}
                  </div>
                  <button type="button" onClick={() => setModalSurvey(s)}
                    className="w-full inline-flex items-center justify-center gap-1 text-xs font-bold px-3 py-2 rounded bg-violet-50 text-violet-700 hover:bg-violet-100">
                    <BarChart3 size={12} /> 결과 보기
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {modalSurvey && <ResultsModal survey={modalSurvey} onClose={() => setModalSurvey(null)} />}
    </div>
  );
}

// ─── 결과 모달 (간이) ────────────────────────────
function ResultsModal({ survey, onClose }: { survey: SurveyCard; onClose: () => void }) {
  const [data, setData] = useState<{ questions: SurveyQuestion[]; responses: SurveyResponse[] } | null>(null);

  useEffect(() => {
    void (async () => setData(await getSurveyResults(survey.id)))();
  }, [survey.id]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <header className="px-5 py-3 border-b flex items-center justify-between">
          <h3 className="font-bold">{survey.title} — 결과 ({survey.responseCount}건)</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700">✕</button>
        </header>
        <div className="px-5 py-4 space-y-3 text-sm">
          {!data ? (
            <div className="flex justify-center py-8"><Loader2 className="animate-spin text-violet-500" size={20} /></div>
          ) : data.responses.length === 0 ? (
            <p className="text-slate-400 italic text-center py-6">아직 응답이 없어요.</p>
          ) : (
            <div className="space-y-3">
              {data.questions.map((q) => (
                <div key={q.id} className="border border-slate-100 rounded-lg p-3">
                  <p className="font-semibold mb-2">{q.question_text}</p>
                  <QuestionSummary q={q} responses={data.responses} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function QuestionSummary({ q, responses }: { q: SurveyQuestion; responses: SurveyResponse[] }) {
  if (q.question_type === 'rating') {
    const vals = responses
      .map((r) => Number((r.answers as Record<string, unknown>)[q.id]))
      .filter((n) => !Number.isNaN(n));
    if (vals.length === 0) return <p className="text-xs text-slate-400">응답 없음</p>;
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    return <p className="text-xs text-slate-600">평균 <b className="text-violet-700 text-base">{avg.toFixed(1)}</b> / 5점 · {vals.length}명 응답</p>;
  }
  if (q.question_type === 'choice') {
    const counts = new Map<string, number>();
    for (const r of responses) {
      const v = String((r.answers as Record<string, unknown>)[q.id] ?? '');
      if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    return (
      <ul className="text-xs space-y-1">
        {Array.from(counts.entries()).map(([k, v]) => (
          <li key={k} className="flex justify-between"><span>{k}</span><span className="font-bold">{v}건</span></li>
        ))}
      </ul>
    );
  }
  // text
  return (
    <ul className="text-xs space-y-1 max-h-32 overflow-y-auto">
      {responses.slice(0, 10).map((r) => {
        const v = String((r.answers as Record<string, unknown>)[q.id] ?? '').trim();
        if (!v) return null;
        return <li key={r.id} className="text-slate-600 border-l-2 border-violet-200 pl-2">{v}</li>;
      })}
    </ul>
  );
}
