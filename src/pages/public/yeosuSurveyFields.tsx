// 사전 수요조사 폼 — 공용 보조 컴포넌트·상수 (V-1 분리).
// 박경수님 2026-05-28 STEP-PROGRAM-SURVEY.

import type { ReactNode } from 'react';

export const SURVEY_INPUT_CLASS =
  'w-full border-2 border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-800 bg-white outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-200';

export function SectionHeader({ num, title, sub }: { num: number; title: string; sub: string }) {
  return (
    <div className="flex gap-3 items-start mb-4">
      <div className="w-9 h-9 rounded-full bg-teal-700 text-white font-extrabold flex items-center justify-center shrink-0">
        {num}
      </div>
      <div>
        <div className="text-base font-extrabold text-slate-800">{title}</div>
        <div className="text-xs text-slate-400 mt-0.5">{sub}</div>
      </div>
    </div>
  );
}

interface FieldProps {
  label: string;
  required?: boolean;
  auto?: boolean;
  note?: string;
  children: ReactNode;
}

export function Field({ label, required, auto, note, children }: FieldProps) {
  return (
    <div className="mb-3.5">
      <label className="block text-sm font-bold text-slate-700 mb-1.5">
        {label}
        {required && <span className="text-rose-500 ml-0.5">*</span>}
        {auto && <AutoBadge label="자동" />}
        {note && <span className="text-[11px] text-slate-500 font-normal ml-1.5">{note}</span>}
      </label>
      {children}
    </div>
  );
}

export function AutoBadge({ label }: { label: string }) {
  return (
    <span className="inline-block bg-teal-50 text-teal-700 text-[11px] font-bold px-2 py-0.5 rounded ml-1.5 border border-teal-200">
      {label}
    </span>
  );
}

export const SURVEY_MONTHS: Array<{ key: 'jun' | 'sep' | 'oct'; label: string; color: string; sub: string }> = [
  { key: 'jun', label: '6월',  color: '#0f766e', sub: '2차 교육 & 멘토링' },
  { key: 'sep', label: '9월',  color: '#3b82f6', sub: '3차 교육 & 멘토링' },
  { key: 'oct', label: '10월', color: '#8b5cf6', sub: '4차 교육 & 멘토링' },
];

// 박경수님 2026-05-28 — 헤더/안내/푸터 등 정적 JSX 분리 (V-1).
export function SurveyTopHeader({ title, description }: { title: string; description: string }) {
  return (
    <header className="text-white px-5 py-9" style={{ background: 'linear-gradient(135deg,#0f766e,#1d4ed8)' }}>
      <div className="max-w-[720px] mx-auto">
        <span className="inline-block bg-white/20 text-xs font-semibold px-3 py-1 rounded-full mb-3">
          🌊 전라남도여수교육지원청
        </span>
        <h1 className="text-2xl font-extrabold leading-snug mb-2">
          {title}<br /><span className="text-teal-200">사전 수요조사</span>
        </h1>
        <p className="text-sm text-teal-100 leading-relaxed">{description}</p>
        <div className="flex flex-wrap gap-2 mt-3">
          <span className="bg-white/15 text-xs px-3 py-1 rounded-full">📅 방문 일정 조율 (6·9·10월)</span>
          <span className="bg-white/15 text-xs px-3 py-1 rounded-full">🎯 프로그램 맞춤 설계</span>
          <span className="bg-white/15 text-xs px-3 py-1 rounded-full">👨‍🏫 분야별 전문가 매칭</span>
        </div>
      </div>
    </header>
  );
}

export function SurveyNotice() {
  return (
    <div className="max-w-[720px] mx-auto px-4 pt-4">
      <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 flex gap-3">
        <span className="text-base shrink-0">⚠️</span>
        <div>
          <p className="text-sm font-bold text-amber-800 mb-1">작성 전 확인 사항</p>
          <ul className="list-disc pl-4 text-sm text-amber-800 leading-relaxed">
            <li>본 조사 결과는 <b>학교 방문 멘토링 일정 조율</b>에 활용됩니다.</li>
            <li>일정은 조사 결과를 바탕으로 담당자가 개별 연락 후 최종 확정됩니다.</li>
            <li>1차 집합교육(5월 13일)과 성과 공유회(11월 9일)는 별도 안내됩니다.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export function SurveyErrors({ errors }: { errors: string[] }) {
  if (errors.length === 0) return null;
  return (
    <div className="max-w-[720px] mx-auto px-4 pt-3">
      <div className="bg-rose-50 border border-rose-300 rounded-2xl p-4">
        <p className="text-sm font-bold text-rose-700 mb-2">⛔ 필수 항목을 확인해 주세요</p>
        <ul className="list-disc pl-5 text-sm text-rose-600 leading-relaxed">
          {errors.map((e) => <li key={e}>{e}</li>)}
        </ul>
      </div>
    </div>
  );
}

export function SurveyFooter() {
  return (
    <footer className="bg-slate-800 text-slate-300 text-xs text-center py-5 leading-loose">
      <p className="font-bold">2026 여수 해양·창업 학생 동아리 운영 사업</p>
      <p>전라남도여수교육지원청 교육지원과&nbsp;|&nbsp;☎ 061-690-5523</p>
      <p>운영기관: (주)밸런스닷&nbsp;|&nbsp;ks@bal24.com</p>
    </footer>
  );
}
