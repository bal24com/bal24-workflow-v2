// 박경수님 2026-06-02 STEP-RECRUIT-CUSTOM-QUESTIONS — 외부 신청 폼 추가 질문 동적 렌더.
// programs.application_questions 를 받아 text/select/number/date 4유형을 렌더. ApplyPage V-1 확보용 분리.

import type { AppQuestion } from '../../types/application';

interface Props {
  questions: AppQuestion[];
  answers: Record<string, string>;
  onChange: (id: string, value: string) => void;
  disabled?: boolean;
}

export default function ApplyQuestionsSection({ questions, answers, onChange, disabled }: Props) {
  if (questions.length === 0) return null;
  return (
    <>
      {questions.map((q) => (
        <div key={q.id} className="space-y-1.5">
          <label className="text-sm font-semibold text-slate-700">
            {q.label}
            {q.required && <span className="text-rose-500 ml-1">*</span>}
          </label>
          {q.type === 'select' ? (
            <select
              value={answers[q.id] ?? ''}
              onChange={(e) => onChange(q.id, e.target.value)}
              disabled={disabled}
              required={q.required}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
            >
              <option value="">선택해 주세요</option>
              {(q.options ?? []).map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          ) : (
            <input
              type={q.type}
              value={answers[q.id] ?? ''}
              onChange={(e) => onChange(q.id, e.target.value)}
              disabled={disabled}
              required={q.required}
              placeholder={q.type === 'number' ? '숫자만 입력' : q.type === 'date' ? '' : `${q.label} 입력`}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
            />
          )}
        </div>
      ))}
    </>
  );
}
