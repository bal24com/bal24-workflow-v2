// 설문 폼 미리보기 패널 — 응답자 화면을 읽기 전용으로 시뮬레이션.
// 박경수님 2026-06-08 — description(안내문) 표시 + 문항 없어도 버튼 항상 표시

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import type { SurveyFormQuestion } from '../../../types/database';

interface Props {
  questions: SurveyFormQuestion[];
  description?: string;
}

export default function SurveyFormPreviewPanel({ questions, description }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 px-3 h-8 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
      >
        {open ? <EyeOff size={13} aria-hidden="true" /> : <Eye size={13} aria-hidden="true" />}
        {open ? '미리보기 닫기' : '응답자 미리보기'}
      </button>

      {open && (
        <div className="mt-3 rounded-xl border border-violet-100 bg-violet-50/30 p-4 space-y-4">
          <p className="text-[10px] font-bold text-violet-600 uppercase tracking-widest">미리보기 — 실제 응답 화면</p>

          {/* 안내문 */}
          {description && description.trim() && (
            <div className="rounded-lg bg-white border border-violet-100 px-4 py-3 text-sm text-slate-700 leading-relaxed whitespace-pre-line">
              {description}
            </div>
          )}

          {questions.length === 0 ? (
            <p className="text-xs text-slate-400 italic text-center py-3">
              아직 문항이 없어요. [+ 문항 추가] 로 문항을 만들면 여기서 미리볼 수 있어요.
            </p>
          ) : (
            questions.map((q, i) => (
              <PreviewField key={q.id} q={q} index={i + 1} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function PreviewField({ q, index }: { q: SurveyFormQuestion; index: number }) {
  const [value, setValue] = useState('');
  const [checked, setChecked] = useState<string[]>([]);

  function toggleCheckbox(opt: string) {
    setChecked((prev) => prev.includes(opt) ? prev.filter((v) => v !== opt) : [...prev, opt]);
  }

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold text-[#1E1B4B] flex items-center gap-1">
        <span className="text-slate-400 font-normal tabular-nums">{index}.</span>
        {q.label}
        {q.required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>

      {q.type === 'text' && (
        <input type="text" value={value} onChange={(e) => setValue(e.target.value)}
          placeholder={`${q.label} 입력`}
          className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none focus:border-violet-400" />
      )}
      {q.type === 'textarea' && (
        <textarea value={value} onChange={(e) => setValue(e.target.value)}
          rows={2} placeholder={`${q.label} 입력`}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs resize-none outline-none focus:border-violet-400" />
      )}
      {q.type === 'number' && (
        <input type="number" value={value} onChange={(e) => setValue(e.target.value)}
          placeholder="숫자"
          className="w-32 h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none focus:border-violet-400" />
      )}
      {q.type === 'date' && (
        <input type="date" value={value} onChange={(e) => setValue(e.target.value)}
          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none focus:border-violet-400" />
      )}
      {q.type === 'select' && (
        <select value={value} onChange={(e) => setValue(e.target.value)}
          className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none focus:border-violet-400">
          <option value="">선택해 주세요</option>
          {(q.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      )}
      {q.type === 'checkbox' && (
        <div className="grid grid-cols-2 gap-1">
          {(q.options ?? []).map((opt) => {
            const on = checked.includes(opt);
            return (
              <label key={opt} onClick={() => toggleCheckbox(opt)}
                className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 cursor-pointer text-xs transition-colors ${
                  on ? 'border-violet-300 bg-violet-50 text-violet-800' : 'border-slate-200 bg-white text-slate-600'
                }`}>
                <input type="checkbox" readOnly checked={on} className="rounded text-violet-600 pointer-events-none" />
                {opt}
              </label>
            );
          })}
        </div>
      )}
      {q.type === 'date-schedule' && (
        <div className="rounded-lg border border-violet-100 bg-white px-3 py-2 text-[11px] text-slate-500 space-y-0.5">
          {(q.options ?? []).length === 0
            ? <span className="text-slate-300 italic">월 목록을 설정하면 여기서 미리볼 수 있어요.</span>
            : (q.options ?? []).map((m) => (
              <div key={m} className="flex items-center gap-2">
                <span className="font-bold text-violet-600 w-10">{m}</span>
                <span className="text-slate-400">{q.priorities ?? 2}순위 일정 선택</span>
              </div>
            ))}
        </div>
      )}
      {q.type === 'club-autofill' && (
        <select className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none">
          <option>동아리 선택 → 지도교사 자동 완성</option>
        </select>
      )}
    </div>
  );
}
