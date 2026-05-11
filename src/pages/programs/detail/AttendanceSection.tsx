// bal24 v2 — STEP-PROGRAM-UX-A
// 출석 섹션 (교육생 탭 안으로 이동) — AI 자동 처리 + 출석 현황 + 차시별 링크·파일 + 세션 토큰

import { useState } from 'react';
import { ClipboardCheck } from 'lucide-react';
import SessionManagePanel from './attendance/SessionManagePanel';
import AttendanceLinkSection from './attendance/AttendanceLinkSection';
import AttendanceAISection from './attendance/AttendanceAISection';
import AttendanceGridTable from './attendance/AttendanceGridTable';

interface Props { programId: string }

export default function AttendanceSection({ programId }: Props) {
  const [gridKey, setGridKey] = useState(0);

  return (
    <div className="flex flex-col gap-3">
      {/* STEP-PROGRAM-ENHANCE-FULL — AI 출석 자동 처리 */}
      <section className="rounded-2xl border border-violet-100 bg-white p-5 shadow-[0_4px_16px_rgba(124,58,237,0.06)] space-y-3">
        <h3 className="text-sm font-bold text-[#1E1B4B] flex items-center gap-1.5">
          <ClipboardCheck size={16} className="text-violet-500" aria-hidden="true" />
          AI 출석 자동 처리
        </h3>
        <AttendanceAISection programId={programId} onProcessed={() => setGridKey((k) => k + 1)} />
      </section>

      <section className="rounded-2xl border border-violet-100 bg-white p-5 shadow-[0_4px_16px_rgba(124,58,237,0.06)] space-y-3">
        <h3 className="text-sm font-bold text-[#1E1B4B]">출석 현황</h3>
        <AttendanceGridTable programId={programId} refreshKey={gridKey} />
      </section>

      {/* STEP-CURRICULUM-ATTEND-SURVEY-FULL — 차시별 외부 출석 링크·파일 */}
      <section className="rounded-2xl border border-violet-100 bg-white p-5 shadow-[0_4px_16px_rgba(124,58,237,0.06)] space-y-2">
        <h3 className="text-sm font-bold text-[#1E1B4B]">차시별 출석 링크·파일</h3>
        <AttendanceLinkSection programId={programId} />
      </section>

      <section className="rounded-2xl border border-violet-100 bg-white p-5 shadow-[0_4px_16px_rgba(124,58,237,0.06)]">
        <SessionManagePanel programId={programId} />
      </section>
    </div>
  );
}
