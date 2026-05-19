// bal24 v2 — STEP-STAFF-PORTAL-P2
// 강사 통합 포털 헤더 — WorkFlow 로고 + 강사 이름·소속 + 내 정보 버튼 (P3에서 모달 구현).

import type { StaffPortalIdentity } from './staffPortalUtils';

interface Props {
  staff: StaffPortalIdentity;
  onEditInfo: () => void;
}

export default function StaffPortalHeader({ staff, onEditInfo }: Props) {
  return (
    <header className="bg-white border-b border-slate-200 px-4 py-4">
      <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-violet-600 font-semibold">WorkFlow · 강사 포털</p>
          <h1 className="text-lg font-bold text-[#1E1B4B] truncate">{staff.name}</h1>
          {staff.affiliation && (
            <p className="text-sm text-slate-500 truncate">{staff.affiliation}</p>
          )}
        </div>
        <button type="button" onClick={onEditInfo}
          className="shrink-0 text-xs text-violet-700 border border-violet-200 bg-white rounded-lg px-3 py-1.5 hover:bg-violet-50 transition-colors">
          내 정보
        </button>
      </div>
    </header>
  );
}
