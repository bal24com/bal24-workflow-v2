// bal24 v2 — STEP-SURVEY-ACCORDION-UI
// 만족도 문항 1개 아코디언 (star: 분포+차트 / text: 응답 목록)

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Star, MessageSquare } from 'lucide-react';
import SurveyChartPanel, { type ChartType, type DistributionPoint } from './SurveyChartPanel';

export interface AccordionQuestion {
  id: string;
  question_text: string;
  question_type: 'star' | 'text';
  order_index: number;
}

export interface AccordionResponse {
  question_id: string;
  answer_score?: number | null;
  answer_text?: string | null;
}

interface Props {
  question: AccordionQuestion;
  responses: AccordionResponse[];
  /** 별점 평균 (외부에서 미리 계산해 전달) */
  avg?: number | null;
  /** 응답 수 (외부 계산) */
  responseCount: number;
  chartType: ChartType;
  defaultOpen?: boolean;
  index: number;
}

const TEXT_PREVIEW_LIMIT = 5;

export default function SurveyQuestionAccordion({
  question, responses, avg, responseCount, chartType, defaultOpen = false, index,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [textExpanded, setTextExpanded] = useState(false);
  const Icon = question.question_type === 'star' ? Star : MessageSquare;

  const distribution = useMemo<DistributionPoint[]>(() => {
    const counts = new Map<number, number>([[1, 0], [2, 0], [3, 0], [4, 0], [5, 0]]);
    for (const r of responses) {
      if (typeof r.answer_score === 'number' && r.answer_score >= 1 && r.answer_score <= 5) {
        counts.set(r.answer_score, (counts.get(r.answer_score) ?? 0) + 1);
      }
    }
    return [1, 2, 3, 4, 5].map((s) => ({ score: s, count: counts.get(s) ?? 0, label: `${s}점` }));
  }, [responses]);

  const texts = useMemo<string[]>(
    () => responses.map((r) => (r.answer_text ?? '').trim()).filter((t) => t.length > 0),
    [responses],
  );

  const visibleTexts = textExpanded ? texts : texts.slice(0, TEXT_PREVIEW_LIMIT);

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <button type="button" onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-violet-50 transition-colors text-left">
        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 text-xs font-semibold tabular-nums shrink-0">
          Q{index + 1}
        </span>
        <Icon size={14} className={`shrink-0 ${question.question_type === 'star' ? 'text-amber-500' : 'text-violet-500'}`} aria-hidden="true" />
        <span className="flex-1 min-w-0 truncate text-sm font-semibold text-[#1E1B4B]">{question.question_text}</span>

        {question.question_type === 'star' && avg != null && (
          <span className="shrink-0 inline-flex items-center gap-1 text-violet-700 font-bold text-sm tabular-nums">
            <Star size={13} className="text-amber-500 fill-amber-400" aria-hidden="true" />
            {avg.toFixed(2)}
          </span>
        )}
        <span className="shrink-0 text-[11px] text-slate-400 tabular-nums">{responseCount}건</span>

        {open ? <ChevronUp size={14} className="text-slate-400 shrink-0" aria-hidden="true" />
              : <ChevronDown size={14} className="text-slate-400 shrink-0" aria-hidden="true" />}
      </button>

      {open && (
        <div className="bg-slate-50 border-t border-slate-200 p-4 space-y-3">
          {question.question_type === 'star' ? (
            <>
              <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-600">
                <span className="font-bold text-slate-700">분포:</span>
                {distribution.map((d) => (
                  <span key={d.score} className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-white border border-slate-200">
                    {d.score}점 <strong className="text-violet-700">{d.count}</strong>명
                  </span>
                ))}
              </div>
              <SurveyChartPanel data={distribution} chartType={chartType} />
            </>
          ) : (
            <>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                응답 {texts.length}건
              </p>
              {texts.length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-2">서술 응답이 없어요.</p>
              ) : (
                <>
                  <ul className="space-y-1">
                    {visibleTexts.map((t, i) => (
                      <li key={i} className="text-xs text-slate-700 px-3 py-1.5 rounded bg-white border border-slate-200 leading-relaxed whitespace-pre-wrap">
                        · {t}
                      </li>
                    ))}
                  </ul>
                  {texts.length > TEXT_PREVIEW_LIMIT && (
                    <button type="button" onClick={() => setTextExpanded((v) => !v)}
                      className="text-[11px] text-violet-600 hover:underline">
                      {textExpanded ? '접기' : `더보기 (+${texts.length - TEXT_PREVIEW_LIMIT}건)`}
                    </button>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
