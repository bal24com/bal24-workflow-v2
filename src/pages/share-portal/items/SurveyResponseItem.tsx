// 박경수님 2026-06-02 STEP-SURVEY-MULTI-TARGET — 외부 토큰 페이지 동적 설문 응답 항목.
// 박경수님 2026-06-07 — date-schedule·club-autofill 타입 렌더 + HTML 폼 스타일 반영.

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
  /** 동아리 토큰 페이지에서 이미 식별된 팀 정보 — club-autofill 자동완성에 사용 */
  prefilledClub?: ClubAnswer;
}

export default function SurveyResponseItem({ programId, role, respondentToken, prefilledClub }: Props) {
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
          prefilledClub={prefilledClub}
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
  prefilledClub?: ClubAnswer;
}

// ── 동아리 자동완성용 타입 ────────────────────────────────────────────────────
interface ClubRow { id: string; club_name: string; school_name: string | null; teacher_name: string | null; teacher_phone: string | null; }
type ClubAnswer = { clubId: string; clubName: string; school: string; teacher: string; phone: string; };

function SurveyFormResponder({ form, programId, role, respondentToken, alreadySubmitted, onSubmitted, prefilledClub }: ResponderProps) {
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
        <div className="space-y-4">
          {questions.map((q) => (
            <QuestionField key={q.id} q={q} programId={programId}
              value={answers[q.id] ?? ''}
              onChange={(v) => setAnswer(q.id, v)}
              disabled={submitting}
              prefilledClub={prefilledClub} />
          ))}
          {err && (
            <p role="alert" className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{err}</p>
          )}
          <button type="button" onClick={() => void handleSubmit()} disabled={submitting}
            className="w-full h-11 rounded-xl bg-gradient-to-r from-violet-600 to-violet-700 text-white font-bold hover:from-violet-700 hover:to-violet-800 disabled:opacity-50 inline-flex items-center justify-center gap-2 text-sm shadow-md shadow-violet-200 transition-all">
            {submitting && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
            <Send size={14} aria-hidden="true" /> 응답 제출
          </button>
        </div>
      )}
    </ItemCard>
  );
}

function QuestionField({ q, programId, value, onChange, disabled, prefilledClub }: {
  q: SurveyFormQuestion; programId: string; value: string; onChange: (v: string) => void; disabled: boolean; prefilledClub?: ClubAnswer;
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
    <div className="space-y-1.5">
      <label className="text-xs font-bold text-[#1E1B4B] flex items-center gap-1">
        <span className="w-1 h-3.5 rounded-full bg-violet-400 inline-block" aria-hidden="true" />
        {q.label}
        {q.required && <span className="text-rose-500 ml-0.5">*</span>}
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
              <label key={opt} className={`flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer text-sm transition-colors ${
                checked ? 'border-violet-300 bg-violet-50 text-violet-800' : 'border-slate-200 bg-white text-slate-600 hover:bg-violet-50/50'
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
      ) : q.type === 'date-schedule' ? (
        <DateScheduleField q={q} value={value} onChange={onChange} disabled={disabled} />
      ) : q.type === 'club-autofill' ? (
        <ClubAutofillField programId={programId} value={value} onChange={onChange} disabled={disabled} prefilledClub={prefilledClub} />
      ) : (
        <input type={q.type} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} required={q.required}
          placeholder={q.type === 'number' ? '숫자' : q.type === 'date' ? '' : `${q.label} 입력`}
          className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-violet-500 disabled:opacity-60" />
      )}
    </div>
  );
}

// ── 월별 일정 수요조사 ──────────────────────────────────────────────────────────
// 저장 형식: JSON { "6월": [{"date":"","time":"","duration":""},{"date":"","time":"","duration":""}], ... }
type ScheduleSlot = { date: string; time: string; duration: string; };
type ScheduleVal = Record<string, ScheduleSlot[]>;

function DateScheduleField({ q, value, onChange, disabled }: {
  q: SurveyFormQuestion; value: string; onChange: (v: string) => void; disabled: boolean;
}) {
  const months = q.options ?? [];
  const priorities = q.priorities ?? 2;

  const parsed: ScheduleVal = useMemo(() => {
    if (!value) return {};
    try { return JSON.parse(value) as ScheduleVal; } catch { return {}; }
  }, [value]);

  function getSlot(month: string, idx: number): ScheduleSlot {
    return parsed[month]?.[idx] ?? { date: '', time: '', duration: '' };
  }

  function setSlot(month: string, idx: number, field: keyof ScheduleSlot, v: string) {
    const next: ScheduleVal = { ...parsed };
    const slots: ScheduleSlot[] = Array.from({ length: priorities }, (_, i) => getSlot(month, i));
    slots[idx] = { ...slots[idx], [field]: v };
    next[month] = slots;
    onChange(JSON.stringify(next));
  }

  const priorityLabels = ['희망 1일', '희망 2일', '희망 3일'];

  // 편의기능: 1순위의 시간+소요시간을 나머지 순위에 복사
  function copyTimeToOthers(month: string) {
    const first = getSlot(month, 0);
    if (!first.time && !first.duration) return;
    const next: ScheduleVal = { ...parsed };
    const slots: ScheduleSlot[] = Array.from({ length: priorities }, (_, i) => ({
      ...getSlot(month, i),
      time: first.time,
      duration: first.duration,
    }));
    next[month] = slots;
    onChange(JSON.stringify(next));
  }

  return (
    <div className="space-y-3">
      {months.map((month) => (
        <div key={month} className="rounded-xl border border-violet-100 bg-violet-50/30 overflow-hidden">
          <div className="px-3 py-2 bg-violet-100/60 border-b border-violet-100 flex items-center justify-between">
            <span className="text-xs font-black text-violet-700">{month}</span>
            {priorities > 1 && !disabled && (
              <button type="button" onClick={() => copyTimeToOthers(month)}
                className="text-[10px] text-violet-600 hover:text-violet-800 font-bold px-2 py-0.5 rounded bg-white border border-violet-200 hover:bg-violet-50">
                희망 1일 시간 → 전체 복사
              </button>
            )}
          </div>
          <div className="p-3 space-y-2">
            {Array.from({ length: priorities }, (_, idx) => (
              <div key={idx} className="space-y-1">
                <p className="text-[10px] font-bold text-violet-500 uppercase tracking-wide">{priorityLabels[idx]}</p>
                <div className="grid grid-cols-3 gap-1.5">
                  <div>
                    <p className="text-[9px] text-slate-400 mb-0.5">날짜</p>
                    <input type="date" value={getSlot(month, idx).date} disabled={disabled}
                      onChange={(e) => setSlot(month, idx, 'date', e.target.value)}
                      className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none focus:border-violet-500 disabled:opacity-60" />
                  </div>
                  <div>
                    <p className="text-[9px] text-slate-400 mb-0.5">시작시간</p>
                    <input type="text" value={getSlot(month, idx).time} disabled={disabled}
                      onChange={(e) => setSlot(month, idx, 'time', e.target.value)}
                      placeholder="예) 14:00"
                      className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none focus:border-violet-500 disabled:opacity-60" />
                  </div>
                  <div>
                    <p className="text-[9px] text-slate-400 mb-0.5">진행시간</p>
                    <input type="text" value={getSlot(month, idx).duration} disabled={disabled}
                      onChange={(e) => setSlot(month, idx, 'duration', e.target.value)}
                      placeholder="예) 2시간"
                      className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none focus:border-violet-500 disabled:opacity-60" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── 동아리 선택 + 지도교사 자동완성 ──────────────────────────────────────────
// 저장 형식: JSON { "clubId":"...", "clubName":"...", "school":"...", "teacher":"...", "phone":"..." }
// prefilledClub 제공 시: 토큰으로 이미 식별된 팀 → 드롭다운 없이 자동 완성 + 잠금
function ClubAutofillField({ programId, value, onChange, disabled, prefilledClub }: {
  programId: string; value: string; onChange: (v: string) => void; disabled: boolean; prefilledClub?: ClubAnswer;
}) {
  // 토큰 자동완성 모드: 마운트 시 한 번 자동 세팅
  useEffect(() => {
    if (prefilledClub && !value) {
      onChange(JSON.stringify(prefilledClub));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefilledClub]);

  // 토큰 자동완성 모드 — 드롭다운 없이 잠금 카드로 표시
  if (prefilledClub) {
    return (
      <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-bold text-[#1E1B4B]">{prefilledClub.clubName}</p>
            <p className="text-[11px] text-slate-500">{prefilledClub.school}</p>
          </div>
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700">
            ✓ 자동 완성
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-violet-100">
          <div>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">지도교사</p>
            <p className="text-xs font-semibold text-[#1E1B4B]">{prefilledClub.teacher || '미지정'}</p>
          </div>
          <div>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">연락처</p>
            <p className="text-xs font-semibold text-[#1E1B4B]">{prefilledClub.phone || '미지정'}</p>
          </div>
        </div>
      </div>
    );
  }

  // 일반 모드 — 드롭다운으로 직접 선택
  return <ClubAutofillDropdown programId={programId} value={value} onChange={onChange} disabled={disabled} />;
}

function ClubAutofillDropdown({ programId, value, onChange, disabled }: {
  programId: string; value: string; onChange: (v: string) => void; disabled: boolean;
}) {
  const [clubs, setClubs] = useState<ClubRow[]>([]);
  const [loadingClubs, setLoadingClubs] = useState(true);

  const parsed: Partial<ClubAnswer> = useMemo(() => {
    if (!value) return {};
    try { return JSON.parse(value) as ClubAnswer; } catch { return {}; }
  }, [value]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from('program_clubs')
        .select('id, club_name, school_name, teacher_name, teacher_phone')
        .eq('program_id', programId)
        .is('deleted_at', null)
        .order('club_name');
      if (cancelled) return;
      if (error) { console.error('[ClubAutofillDropdown] 동아리 조회 실패:', error.message); }
      setClubs((data ?? []) as ClubRow[]);
      setLoadingClubs(false);
    })();
    return () => { cancelled = true; };
  }, [programId]);

  function handleSelect(clubId: string) {
    const club = clubs.find((c) => c.id === clubId);
    if (!club) return;
    onChange(JSON.stringify({
      clubId: club.id, clubName: club.club_name,
      school: club.school_name ?? '', teacher: club.teacher_name ?? '', phone: club.teacher_phone ?? '',
    }));
  }

  if (loadingClubs) return <div className="flex items-center gap-1 text-xs text-slate-400"><Loader2 size={12} className="animate-spin" /> 동아리 목록 로딩 중…</div>;

  // 사전 등록된 동아리가 없을 때 안내
  if (clubs.length === 0) {
    return (
      <p className="text-xs text-slate-500 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
        아직 사전 등록된 동아리가 없어요. 담당자가 동아리를 등록하면 여기서 선택할 수 있어요.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <select value={parsed.clubId ?? ''} onChange={(e) => handleSelect(e.target.value)} disabled={disabled}
        className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-violet-500 disabled:opacity-60">
        <option value="">동아리 선택 ({clubs.length}개)</option>
        {clubs.map((c) => (
          <option key={c.id} value={c.id}>{c.club_name}{c.school_name ? ` (${c.school_name})` : ''}</option>
        ))}
      </select>
      {parsed.clubId && (
        <div className="grid grid-cols-2 gap-2 rounded-lg border border-violet-100 bg-violet-50/40 p-3">
          <div>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">지도교사</p>
            <p className="text-sm font-semibold text-[#1E1B4B]">{parsed.teacher || '미지정'}</p>
          </div>
          <div>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">연락처</p>
            <p className="text-sm font-semibold text-[#1E1B4B]">{parsed.phone || '미지정'}</p>
          </div>
        </div>
      )}
    </div>
  );
}
