// 교육지원청 포털 — 전체 설문 결과 탭.
// 박경수님 2026-05-28 STEP-SCHOOL-PORTAL PART E-3.

import { useCallback, useEffect, useState } from 'react';
import { Loader2, ClipboardList, BarChart3 } from 'lucide-react';
import { getSurveysByProject, countResponses } from '../../../hooks/portal/useSurvey';
import SurveyResultsView from '../survey/SurveyResultsView';
import type { Survey } from '../../../types/schoolPortal';

interface Props { projectId: string }

interface SurveyCard extends Survey {
  responseCount: number;
}

const TYPE_LABEL: Record<string, { label: string; tone: string }> = {
  satisfaction: { label: '만족도', tone: 'bg-emerald-100 text-emerald-700' },
  schedule:     { label: '일정',   tone: 'bg-amber-100 text-amber-700' },
  general:      { label: '일반',   tone: 'bg-slate-100 text-slate-700' },
};

export default function SupervisorSurveysTab({ projectId }: Props) {
  const [surveys, setSurveys] = useState<SurveyCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalSurvey, setModalSurvey] = useState<SurveyCard | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const list = await getSurveysByProject(projectId);
    const cards: SurveyCard[] = [];
    for (const s of list) {
      const cnt = await countResponses(s.id);
      cards.push({ ...s, responseCount: cnt });
    }
    setSurveys(cards);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { void refresh(); }, [refresh]);

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-violet-500" size={24} /></div>;
  }

  return (
    <div className="space-y-4">
      <section className="bg-white rounded-2xl shadow-sm p-5">
        <h2 className="text-sm font-bold text-slate-700 mb-3 inline-flex items-center gap-1.5">
          <ClipboardList size={16} className="text-indigo-600" aria-hidden="true" /> 전체 설문 ({surveys.length})
        </h2>
        {surveys.length === 0 ? (
          <p className="text-sm text-slate-400 italic text-center py-8">사업 단위 설문이 없어요.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {surveys.map((s) => {
              const meta = TYPE_LABEL[s.survey_type] ?? TYPE_LABEL.general;
              return (
                <div key={s.id} className="border border-indigo-100 rounded-xl p-4 hover:shadow-sm transition">
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
                    className="w-full inline-flex items-center justify-center gap-1 text-xs font-bold px-3 py-2 rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100">
                    <BarChart3 size={12} /> 결과 보기
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {modalSurvey && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setModalSurvey(null); }}>
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto">
            <header className="px-5 py-3 border-b flex items-center justify-between sticky top-0 bg-white">
              <h3 className="font-bold">{modalSurvey.title} — 전체 결과</h3>
              <button type="button" onClick={() => setModalSurvey(null)} className="text-slate-400 hover:text-slate-700">✕</button>
            </header>
            <div className="px-5 py-4">
              <SurveyResultsView surveyId={modalSurvey.id} surveyTitle={modalSurvey.title} viewScope="all" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
