// 박경수님 2026-06-02 STEP-SURVEY-MULTI-TARGET — 외부 토큰 페이지 동적 설문 응답 항목.
// 4역할(supporter·beneficiary·team·staff) 토큰 페이지에서 활성 설문 목록 + 응답 폼.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, ClipboardList, Send, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import {
  SURVEY_FORM_KIND_LABEL,
  type ProgramSurveyForm, type SurveyFormQuestion,
} from '../../../types/database';
import ItemCard from './ItemCard';

interface Props {
  programId: string;
  /** 외부 페이지의 역할 ('supporter'|'beneficiary'|'team'|'staff') */
  role: string;
  /** 응답자 식별 토큰 (URL token) */
  respondentToken: string;
}

export default function SurveyResponseItem({ programId, role, respondentToken }: Props) {
  const [forms, setForms] = useState<ProgramSurveyForm[]>([]);
  const [loading, setLoading] = useState(true);
  // 이미 응답한 form id 집합 (sessionStorage 기반 — 단순 중복 방지)
  const submittedKey = useRef(`survey_submitted_${respondentToken}`);
  const [submitted, setSubmitted] = useState<Set<string>>(new Set());

  const reload = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('program_survey_forms')
      .select('*')
      .eq('program_id', programId)
      .eq('is_active', true);
    if (error) {
      console.error('[SurveyResponseItem] 설문 조회 실패:', error.message);
      setForms([]);
      setLoading(false);
      return;
    }
    const list = (data ?? []) as ProgramSurveyForm[];
    // 응답 대상 4역할에 현재 role 포함된 설문만
    setForms(list.filter((f) => f.target_audiences.includes(role)));
    setLoading(false);
  }, [programId, role]);

  useEffect(() => { void reload(); }, [reload]);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(submittedKey.current);
      if (raw) setSubmitted(new Set(JSON.parse(raw) as string[]));
    } catch (err) {
      console.warn('[SurveyResponseItem] sessionStorage 읽기 실패:', err);
    }
  }, []);

  function markSubmitted(formId: string) {
    setSubmitted((prev) => {
      const next = new Set(prev);
      next.add(formId);
      try { sessionStorage.setItem(submittedKey.current, JSON.stringify(Array.from(next))); }
      catch (err) { console.warn('[SurveyResponseItem] sessionStorage 저장 실패:', err); }
      return next;
    });
  }

  if (loading) {
    return (
      <ItemCard icon={<ClipboardList size={18} />} title="설문 응답">
        <div className="flex justify-center py-4">
          <Loader2 size={16} className="animate-spin text-violet-400" aria-hidden="true" />
        </div>
      </ItemCard>
    );
  }

  if (forms.length === 0) return null;

  return (
    <>
      {forms.map((form) => (
        <SurveyFormResponder
          key={form.id}
          form={form}
          programId={programId}
          role={role}
          respondentToken={respondentToken}
          alreadySubmitted={submitted.has(form.id)}
          onSubmitted={() => markSubmitted(form.id)}
        />
      ))}
    </>
  );
}

interface ResponderProps {
  form: ProgramSurveyForm;
  programId: string;
  role: string;
  respondentToken: string;
  alreadySubmitted: boolean;
  onSubmitted: () => void;
}

function SurveyFormResponder({ form, programId, role, respondentToken, alreadySubmitted, onSubmitted }: ResponderProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [doneNow, setDoneNow] = useState(false);

  const questions = useMemo(() => form.questions ?? [], [form]);

  function setAnswer(qid: string, v: string) {
    setAnswers((prev) => ({ ...prev, [qid]: v }));
  }

  async function handleSubmit() {
    setErr(null);
    for (const q of questions) {
      if (q.required && !(answers[q.id] ?? '').trim()) {
        setErr(`'${q.label}' 항목을 입력해 주세요.`);
        return;
      }
    }
    setSubmitting(true);
    // survey_responses 에 문항별 행 INSERT
    const rows = questions.map((q) => ({
      program_id: programId,
      form_id: form.id,
      question_id: null,
      respondent_token: respondentToken,
      respondent_role: role,
      answer_score: q.type === 'number' ? Number(answers[q.id] ?? 0) || null : null,
      answer_text: (answers[q.id] ?? '').trim() || null,
      phase: form.kind,
    }));
    const { error } = await supabase.from('survey_responses').insert(rows);
    setSubmitting(false);
    if (error) {
      console.error('[SurveyResponseItem] 응답 INSERT 실패:', error.message);
      setErr('응답 제출에 실패했어요. 잠시 후 다시 시도해 주세요.');
      return;
    }
    setDoneNow(true);
    onSubmitted();
  }

  const completed = alreadySubmitted || doneNow;

  return (
    <ItemCard icon={<ClipboardList size={18} className="text-violet-600" />}
      title={`${form.title} (${SURVEY_FORM_KIND_LABEL[form.kind] ?? form.kind})`}>
      {completed ? (
        <div className="text-center py-4 space-y-2">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <CheckCircle2 size={20} aria-hidden="true" />
          </div>
          <p className="text-sm font-semibold text-[#1E1B4B]">응답해 주셔서 감사해요.</p>
          <p className="text-[11px] text-slate-500">제출이 완료됐어요.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {questions.map((q) => (
            <QuestionField key={q.id} q={q}
              value={answers[q.id] ?? ''}
              onChange={(v) => setAnswer(q.id, v)} disabled={submitting} />
          ))}
          {err && (
            <p role="alert" className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{err}</p>
          )}
          <button type="button" onClick={() => void handleSubmit()} disabled={submitting}
            className="w-full h-10 rounded-xl bg-violet-600 text-white font-bold hover:bg-violet-700 disabled:opacity-50 inline-flex items-center justify-center gap-2 text-sm">
            {submitting && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
            <Send size={14} aria-hidden="true" /> 응답 제출
          </button>
        </div>
      )}
    </ItemCard>
  );
}

function QuestionField({ q, value, onChange, disabled }: {
  q: SurveyFormQuestion; value: string; onChange: (v: string) => void; disabled: boolean;
}) {
  // 박경수님 2026-06-02 STEP-SURVEY-CHECKBOX — 다중 선택은 ", " 로 구분된 문자열로 저장
  const checkedSet = q.type === 'checkbox'
    ? new Set(value.split(',').map((s) => s.trim()).filter(Boolean))
    : new Set<string>();

  function toggleCheckbox(opt: string) {
    const next = new Set(checkedSet);
    if (next.has(opt)) next.delete(opt); else next.add(opt);
    onChange(Array.from(next).join(', '));
  }

  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-slate-700">
        {q.label}
        {q.required && <span className="text-rose-500 ml-1">*</span>}
      </label>
      {q.type === 'select' ? (
        <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} required={q.required}
          className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-violet-500 disabled:opacity-60">
          <option value="">선택해 주세요</option>
          {(q.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : q.type === 'checkbox' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {(q.options ?? []).map((opt) => {
            const checked = checkedSet.has(opt);
            return (
              <label key={opt} className={`flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer text-sm ${
                checked ? 'border-violet-300 bg-violet-50 text-violet-800' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}>
                <input type="checkbox" checked={checked} disabled={disabled}
                  onChange={() => toggleCheckbox(opt)}
                  className="rounded text-violet-600" />
                <span>{opt}</span>
              </label>
            );
          })}
        </div>
      ) : q.type === 'textarea' ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} required={q.required}
          rows={3} placeholder={`${q.label} 입력`}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm resize-none outline-none focus:border-violet-500 disabled:opacity-60" />
      ) : (
        <input type={q.type} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} required={q.required}
          placeholder={q.type === 'number' ? '숫자' : q.type === 'date' ? '' : `${q.label} 입력`}
          className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-violet-500 disabled:opacity-60" />
      )}
    </div>
  );
}
