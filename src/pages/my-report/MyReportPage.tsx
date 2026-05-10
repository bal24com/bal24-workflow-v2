// bal24 v2 — STEP-MEMBER-INVITE-REPORT MEMBER 사업보고 placeholder
// 본격 구현은 별도 STEP (사업실적보고서 작성·제출 흐름) 예정.

import { FileText, Sparkles } from 'lucide-react';

export default function MyReportPage() {
  return (
    <div className="space-y-5 max-w-3xl">
      <h1 className="text-2xl font-bold text-[#1E1B4B] flex items-center gap-2">
        <FileText size={22} className="text-violet-600" aria-hidden="true" />
        내 사업보고
      </h1>

      <div className="rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50/50 to-orange-50/40 p-8 text-center space-y-3">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-violet-100 text-violet-700">
          <Sparkles size={20} aria-hidden="true" />
        </div>
        <h2 className="text-base font-bold text-[#1E1B4B]">사업실적보고서 페이지 (준비 중)</h2>
        <p className="text-sm text-slate-500">
          선정된 사업의 실적·집행·성과 보고서를 작성·제출하는 페이지가 곧 열려요.
          <br />
          담당자가 개별 안내드릴 거예요.
        </p>
      </div>
    </div>
  );
}
