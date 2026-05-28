// 팀·학생 포털 — scope=team 접근. 해당 팀 정보만 노출 (C3 본격 작성 예정 — 현재는 stub).
// 박경수님 2026-05-28 STEP-SCHOOL-PORTAL.

import { Users } from 'lucide-react';
import type { SchoolPortalContext } from '../../../types/schoolPortal';

interface Props { context: SchoolPortalContext }

export default function TeamPortalPage({ context }: Props) {
  const teamLabel = context.portal.team_label ?? '팀';
  const memberCount = context.portal.participant_ids.length;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-gradient-to-r from-teal-600 to-blue-700 text-white px-6 py-7">
        <div className="max-w-[800px] mx-auto">
          <div className="inline-flex items-center gap-1.5 bg-white/15 text-xs font-semibold px-3 py-1 rounded-full mb-3">
            <Users size={12} aria-hidden="true" /> 팀 포털
          </div>
          <h1 className="text-2xl font-extrabold leading-snug">
            {teamLabel}
            <span className="text-teal-200 ml-2 text-base font-bold">팀원 {memberCount}명</span>
          </h1>
          <div className="mt-1 text-sm text-teal-100">
            🏫 {context.schoolName ?? '학교 미지정'} · 📚 {context.programTitle}
          </div>
        </div>
      </header>

      <main className="max-w-[800px] mx-auto px-4 py-8 space-y-4">
        <section className="bg-white rounded-2xl shadow-sm p-6 text-center text-sm text-slate-500">
          팀 멘토·멘토링 일지·배정된 설문은 곧 제공돼요. (C3에서 본격 구현)
        </section>
      </main>
    </div>
  );
}
