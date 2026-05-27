// 2026 여수 해양·창업 학생 동아리 사전 수요조사 — 외부 공개 페이지.
// 박경수님 2026-05-28 STEP-PROGRAM-SURVEY (zip 폼 React 변환).
// 라우트 — /survey/:token

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
  YEOSU_CLUBS, YEOSU_TIMES, YEOSU_DURS, YEOSU_PROGS, YEOSU_VISIT_COUNTS,
  EMPTY_FORM, type YeosuSurveyForm, type MonthSlot,
} from './yeosuSurveyData';
import {
  SURVEY_INPUT_CLASS as INPUT_CLASS, SURVEY_MONTHS as MONTHS,
  SectionHeader, Field, AutoBadge,
  SurveyTopHeader, SurveyNotice, SurveyErrors, SurveyFooter,
} from './yeosuSurveyFields';

interface SurveyRecord {
  id: string;
  program_id: string;
  title: string;
  description: string | null;
  is_active: boolean;
}

export default function YeosuMarineStartupSurveyPage() {
  const { token } = useParams<{ token: string }>();
  const [survey, setSurvey] = useState<SurveyRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<YeosuSurveyForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // 1) 토큰으로 폼 조회
  useEffect(() => {
    if (!token) {
      setLoadError('잘못된 링크예요. 주최 측에 다시 문의해 주세요.');
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from('program_surveys')
        .select('id, program_id, title, description, is_active')
        .eq('token', token)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        console.error('[yeosu-survey] 조회 실패:', error.message);
        setLoadError('설문지를 불러오지 못했어요.');
      } else if (!data) {
        setLoadError('존재하지 않는 설문이에요.');
      } else if (!data.is_active) {
        setLoadError('이 설문은 종료되었어요.');
      } else {
        setSurvey(data as SurveyRecord);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [token]);

  // 2) 학교·동아리 선택 → 자동 채움
  const onSelectClub = useCallback((indexStr: string) => {
    if (indexStr === '') {
      setForm((prev) => ({
        ...prev, selectedClubIndex: null,
        clubName: '', clubType: '', clubGrade: '', clubMembers: '',
        teacherName: '', teacherPhone: '', teacherEmail: '',
      }));
      return;
    }
    const idx = Number(indexStr);
    const c = YEOSU_CLUBS[idx];
    if (!c) return;
    setForm((prev) => ({
      ...prev,
      selectedClubIndex: idx,
      clubName: c.club, clubType: c.type, clubGrade: c.grade,
      clubMembers: `${c.mem}명`,
      teacherName: c.teacher, teacherPhone: c.phone, teacherEmail: c.email,
    }));
  }, []);

  // 3) 슬롯 patch
  const updateSlot = useCallback((month: 'jun' | 'sep' | 'oct', pri: 'p1' | 'p2', patch: Partial<MonthSlot>) => {
    setForm((prev) => ({
      ...prev,
      [month]: { ...prev[month], [pri]: { ...prev[month][pri], ...patch } },
    }));
  }, []);

  // 4) 체크박스 토글
  const togglePram = useCallback((label: string) => {
    setForm((prev) => ({
      ...prev,
      programs: prev.programs.includes(label)
        ? prev.programs.filter((p) => p !== label)
        : [...prev.programs, label],
    }));
  }, []);

  // 5) 검증
  const validate = (): string[] => {
    const errs: string[] = [];
    if (form.selectedClubIndex === null) errs.push('학교 및 동아리를 선택해 주세요.');
    if (!form.teacherName.trim()) errs.push('지도교사 성명을 확인해 주세요.');
    if (!form.teacherPhone.trim()) errs.push('지도교사 연락처를 확인해 주세요.');
    if (!form.visitCount) errs.push('희망 방문 횟수를 선택해 주세요.');
    if (!form.jun.p1.time || !form.jun.p1.duration) errs.push('6월 1순위 시작 시간과 진행 시간을 선택해 주세요.');
    if (!form.sep.p1.time || !form.sep.p1.duration) errs.push('9월 1순위 시작 시간과 진행 시간을 선택해 주세요.');
    if (!form.oct.p1.time || !form.oct.p1.duration) errs.push('10월 1순위 시작 시간과 진행 시간을 선택해 주세요.');
    if (form.programs.length === 0) errs.push('선호 프로그램 유형을 1개 이상 선택해 주세요.');
    return errs;
  };

  // 6) 제출
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!survey) return;
    const errs = validate();
    if (errs.length > 0) {
      setErrors(errs);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setErrors([]);
    setSubmitting(true);
    const club = form.selectedClubIndex !== null ? YEOSU_CLUBS[form.selectedClubIndex] : null;
    const respondentLabel = club ? `${club.school} - ${club.club}` : '미선택';

    const { error } = await supabase.from('program_survey_responses').insert({
      survey_id: survey.id,
      respondent_label: respondentLabel,
      payload: form,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    });
    setSubmitting(false);
    if (error) {
      console.error('[yeosu-survey] 제출 실패:', error.message);
      setErrors(['응답을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.']);
      return;
    }
    setSubmitted(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const summaryText = useMemo(() => {
    if (!form.selectedClubIndex && form.selectedClubIndex !== 0) return '';
    const c = YEOSU_CLUBS[form.selectedClubIndex];
    return `${c.school} - ${c.club}`;
  }, [form.selectedClubIndex]);

  // ─── 렌더 ──────────────────────────────────────────
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500 text-sm">불러오는 중…</div>;
  }
  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md bg-white rounded-2xl shadow p-8 text-center space-y-3">
          <div className="text-3xl">⚠️</div>
          <p className="text-base font-bold text-rose-600">{loadError}</p>
        </div>
      </div>
    );
  }
  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-5"
        style={{ background: 'linear-gradient(135deg, #f0fdfa, #eff6ff)' }}>
        <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center space-y-3">
          <div className="text-5xl">✅</div>
          <h2 className="text-xl font-bold">제출 완료</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            사전 수요조사에 응답해 주셔서 감사합니다.<br />
            담당자가 확인 후 일정을 조율하여 연락드리겠습니다.<br />
            <b className="text-teal-700">여수교육지원청 교육지원과</b>&nbsp;☎ 061-690-5523
          </p>
          {summaryText && (
            <p className="text-xs text-slate-500 bg-slate-50 rounded-lg py-2 px-3">
              제출된 동아리 — <b>{summaryText}</b>
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: 'linear-gradient(135deg,#f0fdfa 0%,#eff6ff 50%,#f1f5f9 100%)', minHeight: '100vh' }}>
      <SurveyTopHeader
        title={survey?.title ?? '2026 여수 해양·창업 학생 동아리'}
        description={survey?.description ?? '학교 방문 전문가 멘토링 일정 및 프로그램 내용을 미리 파악하여 맞춤형 지원을 제공하기 위한 수요조사입니다.'}
      />
      <SurveyNotice />
      <SurveyErrors errors={errors} />

      <form onSubmit={handleSubmit} className="max-w-[720px] mx-auto px-4 py-4 pb-20 space-y-3">
        {/* ① 기본 정보 */}
        <section className="bg-white rounded-2xl shadow-sm p-6">
          <SectionHeader num={1} title="기본 정보"
            sub="동아리를 선택하면 지도교사·동아리 정보가 자동으로 채워집니다." />
          <Field label="학교 및 동아리 선택" required>
            <select
              value={form.selectedClubIndex === null ? '' : String(form.selectedClubIndex)}
              onChange={(e) => onSelectClub(e.target.value)}
              className={INPUT_CLASS}
            >
              <option value="">— 학교와 동아리를 선택하세요 —</option>
              {YEOSU_CLUBS.map((c, i) => (
                <option key={i} value={i}>{c.school} — {c.club}</option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <Field label="동아리명" auto><input value={form.clubName} readOnly className={INPUT_CLASS + ' bg-slate-50'} /></Field>
            <Field label="유형" auto><input value={form.clubType} readOnly className={INPUT_CLASS + ' bg-slate-50'} /></Field>
            <Field label="학년" auto><input value={form.clubGrade} readOnly className={INPUT_CLASS + ' bg-slate-50'} /></Field>
          </div>
          <Field label="팀 인원" auto>
            <input value={form.clubMembers} readOnly className={INPUT_CLASS + ' bg-slate-50'} />
          </Field>
          <div className="border-t border-slate-100 pt-3 mt-1">
            <p className="text-sm font-bold text-slate-700 mb-2">
              지도교사 정보 <AutoBadge label="자동완성 (수정 가능)" />
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <Field label="성명" required>
                <input value={form.teacherName} onChange={(e) => setForm((p) => ({ ...p, teacherName: e.target.value }))}
                  placeholder="홍길동" className={INPUT_CLASS} />
              </Field>
              <Field label="연락처" required>
                <input value={form.teacherPhone} onChange={(e) => setForm((p) => ({ ...p, teacherPhone: e.target.value }))}
                  placeholder="010-0000-0000" className={INPUT_CLASS} />
              </Field>
              <Field label="이메일">
                <input type="email" value={form.teacherEmail} onChange={(e) => setForm((p) => ({ ...p, teacherEmail: e.target.value }))}
                  placeholder="teacher@school.kr" className={INPUT_CLASS} />
              </Field>
            </div>
          </div>
        </section>

        {/* ② 일정 수요조사 */}
        <section className="bg-white rounded-2xl shadow-sm p-6">
          <SectionHeader num={2} title="방문 멘토링 일정 수요조사"
            sub="월별로 1순위·2순위 희망 일정을 각각 입력해 주세요." />
          <Field label="전체 방문 횟수 희망" required>
            <div className="flex flex-wrap gap-2">
              {YEOSU_VISIT_COUNTS.map((v) => (
                <label key={v} className={`cursor-pointer border-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  form.visitCount === v ? 'border-teal-600 bg-teal-50 text-teal-700' : 'border-slate-200 text-slate-500 hover:border-teal-400'
                }`}>
                  <input type="radio" name="visitCount" value={v} checked={form.visitCount === v}
                    onChange={() => setForm((p) => ({ ...p, visitCount: v }))} className="sr-only" />
                  {v}
                </label>
              ))}
            </div>
          </Field>

          {MONTHS.map(({ key, label, color, sub }) => (
            <div key={key} className="border-2 border-slate-200 rounded-2xl p-4 mb-3">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-white text-sm font-extrabold px-3 py-1 rounded-full" style={{ background: color }}>{label}</span>
                <span className="text-sm text-slate-500">{sub}</span>
              </div>
              {([
                { pri: 'p1' as const, priLbl: '1순위', req: true },
                { pri: 'p2' as const, priLbl: '2순위', req: false },
              ]).map(({ pri, priLbl, req }) => (
                <div key={pri} className="bg-slate-50 rounded-lg p-3 mb-2 last:mb-0">
                  <div className="text-xs font-bold text-slate-500 mb-2 flex items-center gap-1.5">
                    <span className="bg-slate-200 px-2 py-0.5 rounded-full">{priLbl}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <Field label="희망 날짜">
                      <input type="date" value={form[key][pri].date}
                        onChange={(e) => updateSlot(key, pri, { date: e.target.value })}
                        className={INPUT_CLASS} />
                    </Field>
                    <Field label="시작 시간" required={req}>
                      <select value={form[key][pri].time}
                        onChange={(e) => updateSlot(key, pri, { time: e.target.value })}
                        className={INPUT_CLASS}>
                        <option value="">— 선택 —</option>
                        {YEOSU_TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </Field>
                    <Field label="진행 시간" required={req}>
                      <select value={form[key][pri].duration}
                        onChange={(e) => updateSlot(key, pri, { duration: e.target.value })}
                        className={INPUT_CLASS}>
                        <option value="">— 선택 —</option>
                        {YEOSU_DURS.map((d) => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </Field>
                  </div>
                </div>
              ))}
            </div>
          ))}

          <p className="text-xs text-slate-500 bg-slate-100 rounded-lg p-3 mt-2">
            📌 희망 일자는 추후 운영진이 학교별 연락을 통해 조정될 수 있습니다.
          </p>
        </section>

        {/* ③ 프로그램 선호도 */}
        <section className="bg-white rounded-2xl shadow-sm p-6">
          <SectionHeader num={3} title="프로그램 내용 선호도"
            sub="원하는 프로그램 유형을 선택해 주세요. (복수 선택 가능)" />
          <Field label="선호하는 프로그램 유형" required note="(복수 선택 가능)">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {YEOSU_PROGS.map((prog) => {
                const checked = form.programs.includes(prog.label);
                return (
                  <label key={prog.id} className={`cursor-pointer border-2 rounded-lg px-3 py-2 text-sm font-semibold flex items-center gap-2 transition ${
                    checked ? 'border-teal-600 bg-teal-50 text-teal-700' : 'border-slate-200 text-slate-500 hover:border-teal-400'
                  }`}>
                    <input type="checkbox" checked={checked} onChange={() => togglePram(prog.label)} className="sr-only" />
                    <span className={`inline-flex w-4 h-4 items-center justify-center rounded text-[10px] font-bold border-2 ${
                      checked ? 'bg-teal-600 border-teal-600 text-white' : 'border-slate-300 text-transparent'
                    }`}>✓</span>
                    {prog.label}
                  </label>
                );
              })}
            </div>
          </Field>
          {form.programs.includes('기타 (직접 입력)') && (
            <Field label="기타 희망 프로그램">
              <input value={form.otherProgram}
                onChange={(e) => setForm((p) => ({ ...p, otherProgram: e.target.value }))}
                placeholder="기타 희망 프로그램을 입력해 주세요"
                className={INPUT_CLASS} />
            </Field>
          )}
        </section>

        {/* ④ 운영 환경 및 건의사항 */}
        <section className="bg-white rounded-2xl shadow-sm p-6">
          <SectionHeader num={4} title="운영 환경 및 건의사항"
            sub="원활한 멘토링 운영을 위한 정보와 건의사항을 작성해 주세요." />
          <Field label="활동 가능 장소">
            <input value={form.venue} onChange={(e) => setForm((p) => ({ ...p, venue: e.target.value }))}
              placeholder="예: 3학년 교실, 과학실, 시청각실 등" className={INPUT_CLASS} />
          </Field>
          <Field label="학생 수준 및 특이사항">
            <textarea value={form.studentNote} onChange={(e) => setForm((p) => ({ ...p, studentNote: e.target.value }))}
              placeholder="예: 창업에 관심 높고 발표력이 좋음 / IT 기초 교육 필요 / 초등 저학년이라 쉬운 언어 요청 등"
              className={INPUT_CLASS + ' resize-none h-20'} />
          </Field>
          <Field label="건의사항">
            <textarea value={form.request} onChange={(e) => setForm((p) => ({ ...p, request: e.target.value }))}
              placeholder="희망하는 전문가 분야, 프로그램 요청사항, 기타 건의사항을 자유롭게 작성해 주세요."
              className={INPUT_CLASS + ' resize-none h-20'} />
          </Field>
        </section>

        {/* 제출 */}
        <div className="text-center pt-2">
          <p className="text-xs text-slate-500 mb-4 leading-relaxed">
            ✅ 제출 후 담당자가 검토하여 개별 연락드립니다.<br />
            <b>여수교육지원청 교육지원과</b>&nbsp;☎ 061-690-5523
          </p>
          <button type="submit" disabled={submitting}
            className="text-white text-base font-extrabold px-12 py-3.5 rounded-full shadow-lg transition hover:-translate-y-0.5 disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg,#0f766e,#1d4ed8)' }}>
            {submitting ? '제출 중…' : '🌊  설문 제출하기'}
          </button>
        </div>
      </form>

      <SurveyFooter />
    </div>
  );
}

// 보조 컴포넌트·상수는 yeosuSurveyFields.tsx 로 분리됨 (V-1).
