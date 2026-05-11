// bal24 v2 — STEP-PROGRAM-UX-B
// 만족도 AI 종합 분석 패널 (Edge Function analyze-survey가 채운 ai_analysis JSON 시각화)

import { Sparkles } from 'lucide-react';
import type { SatisfactionSurvey } from '../../../types/database';

interface Props {
  analysis: NonNullable<SatisfactionSurvey['ai_analysis']>;
}

export default function SurveyAiAnalysisPanel({ analysis }: Props) {
  return (
    <div className="mt-2 space-y-3 rounded-lg bg-violet-50/40 border border-violet-100 p-3">
      <p className="text-[11px] font-bold text-violet-700 flex items-center gap-1">
        <Sparkles size={11} aria-hidden="true" /> AI 종합 분석
      </p>

      <div className="bg-violet-50 rounded-xl p-3 text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
        {analysis.overall}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
          <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide mb-1.5">잘된 점</p>
          <ul className="space-y-0.5">
            {analysis.strengths.map((s, i) => (
              <li key={i} className="text-[11px] text-slate-700 leading-snug">· {s}</li>
            ))}
          </ul>
        </div>
        <div className="bg-orange-50 rounded-xl p-3 border border-orange-100">
          <p className="text-[10px] font-bold text-orange-700 uppercase tracking-wide mb-1.5">개선 필요</p>
          <ul className="space-y-0.5">
            {analysis.improvements.map((s, i) => (
              <li key={i} className="text-[11px] text-slate-700 leading-snug">· {s}</li>
            ))}
          </ul>
        </div>
      </div>

      {analysis.keywords.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {analysis.keywords.map((kw, i) => (
            <span key={i} className="text-[11px] px-2 py-0.5 bg-white text-violet-700 border border-violet-200 rounded-full">
              #{kw}
            </span>
          ))}
        </div>
      )}

      <div className="bg-slate-50 rounded-xl p-3 text-[11px] text-slate-700 leading-relaxed">
        <span className="font-bold text-slate-800">운영 제언 — </span>
        {analysis.recommendation}
      </div>
    </div>
  );
}
