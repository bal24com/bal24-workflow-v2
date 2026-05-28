// 설문 응답 폼 — 팀원 이름 입력 후 개별 제출.
// 박경수님 2026-05-28 STEP-SCHOOL-PORTAL PART D-3.
// URL — /survey-respond/:surveyId?t=:portalToken

import { useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Loader2, Send, RotateCcw } from 'lucide-react';
import { getSurveyForResponse, submitResponse } from '../../../hooks/portal/useSurvey';
import type { Survey, SurveyQuestion } from '../../../types/schoolPortal';

export default function SurveyFormPage() {
  const { surveyId } = useParams<{ surveyId: string }>();
  const [searchParams] = useSearchParams();
  const portalToken = searchParams.get('t');
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const fetchSurvey = useCallback(async () => {
    if (!surveyId) {
      setLoadError('잘못된 링크예요.');
      setLoading(false);
      return;
    }
    setLoading(true);
    const res = await getSurveyForResponse(surveyId);
    if (res.error || !res.survey) {
      setLoadError(res.error ?? '설문을 찾을 수 없어요.');
    } else {
      setSurvey(res.survey);
      setQuestions(res.questions);
    }
    setLoading(false);
  }, [surveyId]);

  useEffect(() => { void fetchSurvey(); }, [fetchSurvey]);

  const setAnswer = (qId: string, value: unknown) => {
    setAnswers((prev) => ({ ...prev, [qId]: value }));
  };

  const validate = (): string[] => {
    const errs: string[] = [];
    if (!name.trim()) errs.push('응답자 이름을 입력해 주세요.');
    for (const q of questions) {
      if (!q.is_required) continue;
      const v = answers[q.id];
      if (v == null || v === '') errs.push(`"${q.question_text}" 항목을 입력해 주세요.`);
    }
    return errs;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!survey || !surveyId) return;
    const errs = validate();
    if (errs.length > 0) {
      setErrors(errs);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setErrors([]);
    setSubmitting(true);
    const res = await submitResponse({
      surveyId, portalToken, respondentName: name, answers,
    });
    setSubmitting(false);
    if (res.error) {
      setErrors([res.error]);
      return;
    }
    setSubmitted(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetForm = () => {
    setName('');
    setAnswers({});
    setSubmitted(false);
    setErrors([]);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-violet-500" size={28} /></div>;
  }
  if (loadError || !survey) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md bg-white rounded-2xl shadow p-8 text-center space-y-3">
          <div className="text-3xl">⚠️</div>
          <p className="text-base font-bold text-rose-600">{loadError ?? '설문이 없어요.'}</p>
        </div>
      </div>
    );
  }
  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md bg-white rounded-2xl shadow p-8 text-center space-y-3">
          <div className="text-5xl">🎉</div>
          <h2 className="text-lg font-bold">응답이 제출되었습니다</h2>
          <p className="text-sm text-slate-600">소중한 의견 감사합니다.</p>
          <button type="button" onClick={resetForm}
            className="inline-flex items-center gap-1.5 mt-2 px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-bold hover:bg-violet-700">
            <RotateCcw size={14} /> 다른 팀원 응답하기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-gradient-to-r from-violet-600 to-violet-800 text-white px-5 py-7">
        <div className="max-w-[700px] mx-auto">
          <h1 className="text-xl font-extrabold mb-1">{survey.title}</h1>
          {survey.description && <p className="text-sm text-violet-100">{survey.description}</p>}
          {survey.due_date && <p className="text-xs text-violet-200 mt-1">마감 {survey.due_date}</p>}
        </div>
      </header>

      {errors.length > 0 && (
        <div className="max-w-[700px] mx-auto px-4 pt-3">
          <div className="bg-rose-50 border border-rose-300 rounded-2xl p-4">
            <p className="text-sm font-bold text-rose-700 mb-1">⛔ 확인이 필요해요</p>
            <ul className="list-disc pl-5 text-sm text-rose-600">
              {errors.map((e) => <li key={e}>{e}</li>)}
            </ul>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="max-w-[700px] mx-auto px-4 py-5 space-y-3">
        <section className="bg-white rounded-2xl shadow-sm p-5">
          <label className="block text-sm font-bold text-slate-700 mb-1.5">
            응답자 이름 <span className="text-rose-500">*</span>
          </label>
          <input value={name} onChange={(e) => setName(e.target.value)}
            placeholder="홍길동" className={INPUT_CLASS} />
        </section>

        {questions.map((q, i) => (
          <section key={q.id} className="bg-white rounded-2xl shadow-sm p-5">
            <label className="block text-sm font-bold text-slate-700 mb-2">
              {i + 1}. {q.question_text}
              {q.is_required && <span className="text-rose-500 ml-0.5">*</span>}
            </label>
            <QuestionInput q={q} value={answers[q.id]} onChange={(v) => setAnswer(q.id, v)} />
          </section>
        ))}

        <div className="text-center pt-2">
          <button type="submit" disabled={submitting}
            className="inline-flex items-center gap-1.5 bg-violet-600 text-white text-base font-bold px-8 py-3 rounded-full shadow-lg hover:bg-violet-700 disabled:opacity-50">
            {submitting ? <><Loader2 className="animate-spin" size={14} /> 제출 중…</> : <><Send size={14} /> 제출하기</>}
          </button>
        </div>
      </form>
    </div>
  );
}

const INPUT_CLASS = 'w-full border-2 border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-violet-500';

function QuestionInput({ q, value, onChange }: { q: SurveyQuestion; value: unknown; onChange: (v: unknown) => void }) {
  if (q.question_type === 'rating') {
    const cur = Number(value) || 0;
    return (
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" onClick={() => onChange(n)}
            className={`w-11 h-11 rounded-lg text-sm font-bold border-2 transition ${
              cur === n ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-slate-600 border-slate-300 hover:border-violet-400'
            }`}>
            {n}
          </button>
        ))}
        <span className="self-center ml-1 text-xs text-slate-400">1점(매우 불만) ~ 5점(매우 만족)</span>
      </div>
    );
  }
  if (q.question_type === 'choice') {
    const cur = String(value ?? '');
    return (
      <div className="space-y-1.5">
        {q.options.map((opt) => (
          <label key={opt} className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 cursor-pointer transition ${
            cur === opt ? 'bg-violet-50 border-violet-500 text-violet-700' : 'border-slate-200 hover:border-violet-300'
          }`}>
            <input type="radio" checked={cur === opt} onChange={() => onChange(opt)}
              className="accent-violet-600" />
            <span className="text-sm">{opt}</span>
          </label>
        ))}
      </div>
    );
  }
  // text
  return (
    <textarea value={String(value ?? '')} onChange={(e) => onChange(e.target.value)}
      rows={3} className={INPUT_CLASS + ' resize-none'} placeholder="답변을 입력해 주세요" />
  );
}
