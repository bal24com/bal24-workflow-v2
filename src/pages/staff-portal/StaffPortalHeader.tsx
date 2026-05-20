// bal24 v2 — STEP-STAFF-PORTAL-P2 / STEP-STAFF-PORTAL-UI-UNIFY / STEP-PIN-FIX-V2
// 강사 통합 포털 헤더 — 누구의 포털인지 한눈에 확인 (이름 + 님 + 소속).

import type { StaffPortalIdentity } from './staffPortalUtils';

interface Props {
  staff: StaffPortalIdentity;
  onEditInfo: () => void;
}

export default function StaffPortalHeader({ staff, onEditInfo }: Props) {
  return (
    <header className="bg-white rounded-2xl border border-violet-100 shadow-[0_4px_16px_rgba(124,58,237,0.08)] p-5 mb-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-violet-600 font-semibold">WorkFlow · 강사 포털</p>
          <h1 className="text-xl font-bold text-[#1E1B4B] truncate mt-0.5">
            {staff.name}
            <span className="text-base font-semibold text-slate-500 ml-0.5">님</span>
          </h1>
          {staff.affiliation && (
            <p className="text-sm text-slate-500 truncate mt-0.5">{staff.affiliation}</p>
          )}
        </div>
        <button type="button" onClick={onEditInfo}
          className="shrink-0 px-4 py-2 text-sm font-semibold text-violet-600 border border-violet-600 rounded-[10px] hover:bg-violet-50 transition-all duration-200">
          내 정보
        </button>
      </div>
    </header>
  );
}
