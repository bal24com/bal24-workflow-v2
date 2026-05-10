// bal24 v2 — STEP-CURRICULUM-ATTEND-SURVEY-FULL 만족도 분석 결과 카드
// satisfaction_surveys row를 시각화 (전반 평균 + 항목별 막대 + 자유서술 목록)

import { useState } from 'react';
import { Star, FileText, ChevronDown, ChevronUp, Trash2, MessageSquare } from 'lucide-react';
import type { SatisfactionSurvey } from '../../../types/database';

interface Props {
  survey: SatisfactionSurvey;
  onDelete?: () => void;
}

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch { return iso; }
}

export default function SurveyResultCard({ survey, onDelete }: Props) {
  const [expanded, setExpanded] = useState(true);
  const items = Object.entries(survey.summary_json ?? {});
  const overall = survey.avg_overall != null ? Number(survey.avg_overall) : null;

  return (
    <section className="rounded-2xl border border-violet-100 bg-white p-4 shadow-[0_4px_16px_rgba(124,58,237,0.06)] space-y-3">
      <header className="flex items-start justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <p className="text-sm font-bold text-[#1E1B4B] flex items-center gap-1.5">
            <FileText size={14} className="text-violet-500" aria-hidden="true" />
            {survey.file_name ?? '만족도 응답'}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {formatDateTime(survey.uploaded_at)} · 응답 <strong className="text-slate-700">{survey.total_count}</strong>건
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {overall != null && (
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">전반 평균</p>
              <p className="text-2xl font-bold text-orange-600 tabular-nums inline-flex items-center gap-1">
                <Star size={20} className="text-orange-500 fill-orange-400" aria-hidden="true" /> {overall.toFixed(2)}
              </p>
            </div>
          )}
          <button type="button" onClick={() => setExpanded((v) => !v)} aria-label={expanded ? '접기' : '펼치기'}
            className="inline-flex items-center justify-center w-7 h-7 rounded-md text-slate-400 hover:bg-violet-50 hover:text-violet-600">
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {onDelete && (
            <button type="button" onClick={onDelete} aria-label="삭제"
              className="inline-flex items-center justify-center w-7 h-7 rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-500">
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </header>

      {expanded && (
        <>
          {items.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">항목별 평균</p>
              {items.map(([label, avg]) => {
                const pct = Math.max(0, Math.min(100, (avg / 5) * 100));
                return (
                  <div key={label} className="grid grid-cols-[minmax(0,1fr)_minmax(120px,180px)_44px] items-center gap-2 text-xs">
                    <span className="text-slate-700 truncate" title={label}>{label}</span>
                    <span className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <span className="block h-full bg-gradient-to-r from-violet-400 to-orange-400" style={{ width: `${pct}%` }} aria-hidden="true" />
                    </span>
                    <span className="font-bold tabular-nums text-orange-600 text-right">{Number(avg).toFixed(2)}</span>
                  </div>
                );
              })}
            </div>
          )}
          {survey.comments && survey.comments.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                <MessageSquare size={11} aria-hidden="true" /> 자유서술 ({survey.comments.length})
              </p>
              <ul className="space-y-1 max-h-[240px] overflow-y-auto rounded-lg bg-slate-50/60 p-2">
                {survey.comments.map((c, i) => (
                  <li key={i} className="text-xs text-slate-700 px-2 py-1 rounded bg-white border border-slate-100">
                    · {c}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {items.length === 0 && (!survey.comments || survey.comments.length === 0) && (
            <p className="text-xs text-slate-400 italic text-center py-2">분석할 데이터가 없어요.</p>
          )}
        </>
      )}
    </section>
  );
}
