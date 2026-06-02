// 박경수님 2026-06-02 STEP-RECRUIT-CUSTOM-QUESTIONS — 신청자 추가 질문 응답 집계 배지.
// select 형 질문마다 한 줄로 [응답값 N명] 배지 노출. ApplicationTab 의 V-1 (400줄) 확보용 분리.

import type { ParticipantApplication, AppQuestion } from '../../../types/application';
import { tallySelectAnswers } from './applicationMgmtUtils';

interface Props {
  questions: AppQuestion[];
  items: ParticipantApplication[];
}

export default function ExtraAnswerTallyBar({ questions, items }: Props) {
  const selects = questions.filter((q) => q.type === 'select');
  if (selects.length === 0) return null;
  return (
    <>
      {selects.map((q) => {
        const entries = Object.entries(tallySelectAnswers(items, q)).sort((a, b) => b[1] - a[1]);
        return (
          <div key={q.id} className="flex items-center gap-2 text-xs rounded-xl border border-violet-100 bg-white px-3 py-2 flex-wrap">
            <span className="text-slate-500 font-semibold">{q.label}</span>
            {entries.length === 0 ? (
              <span className="text-slate-300 italic">응답 없음</span>
            ) : entries.map(([ans, n]) => (
              <span key={ans} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-violet-50 border border-violet-100 text-violet-700">
                {ans} <strong className="tabular-nums">{n}</strong>명
              </span>
            ))}
          </div>
        );
      })}
    </>
  );
}
