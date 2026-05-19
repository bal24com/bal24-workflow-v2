// bal24 v2 — STEP-STAFF-PORTAL-P2
// /staff-portal/:token (비로그인 공개) — 토큰 검증 + 6탭 디스패처.
// P3·P4·P5 에서 멘토링·강의·일지·일정·자료 탭 본격 구현.

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import StaffPortalHeader from './StaffPortalHeader';
import StaffOverviewTab from './tabs/StaffOverviewTab';
import StaffMentoringTab from './tabs/StaffMentoringTab';
import StaffLectureTab from './tabs/StaffLectureTab';
import StaffLogTab from './tabs/StaffLogTab';
import StaffScheduleTab from './tabs/StaffScheduleTab';
import StaffMaterialsTab from './tabs/StaffMaterialsTab';
import StaffInfoEditModal from './StaffInfoEditModal';
import { resolveStaffByToken, type StaffPortalIdentity } from './staffPortalUtils';

const TABS = [
  { key: 'overview',   label: '개요' },
  { key: 'mentoring',  label: '멘토링' },
  { key: 'lecture',    label: '강의' },
  { key: 'log',        label: '일지' },
  { key: 'schedule',   label: '일정' },
  { key: 'materials',  label: '자료' },
] as const;
type TabKey = typeof TABS[number]['key'];

export default function StaffPortalPage() {
  const { token } = useParams<{ token: string }>();
  const [staff, setStaff] = useState<StaffPortalIdentity | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  // STEP-STAFF-PORTAL-P5 — 내 정보 수정 모달
  const [infoOpen, setInfoOpen] = useState(false);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const result = await resolveStaffByToken(token);
      if (cancelled) return;
      setStaff(result);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-400 text-sm">불러오는 중…</p>
      </div>
    );
  }

  if (!staff) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-8 text-center">
          <p className="text-slate-700 font-semibold">유효하지 않은 링크예요.</p>
          <p className="text-sm text-slate-500 mt-2">PM에게 새 링크를 요청해 주세요.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <StaffPortalHeader staff={staff} onEditInfo={() => setInfoOpen(true)} />

      {/* 탭 메뉴 — 모바일 가로 스크롤 + sticky */}
      <nav role="tablist" aria-label="강사 포털 탭"
        className="flex gap-0 overflow-x-auto bg-white border-b border-slate-200 sticky top-0 z-10">
        {TABS.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button key={tab.key} type="button" role="tab" aria-selected={active}
              onClick={() => setActiveTab(tab.key)}
              className={`whitespace-nowrap px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${
                active
                  ? 'border-violet-600 text-violet-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}>
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* 탭 콘텐츠 */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        {activeTab === 'overview'  && <StaffOverviewTab staff={staff} />}
        {activeTab === 'mentoring' && <StaffMentoringTab staff={staff} />}
        {activeTab === 'lecture'   && <StaffLectureTab staff={staff} />}
        {activeTab === 'log'       && <StaffLogTab staff={staff} />}
        {activeTab === 'schedule'  && <StaffScheduleTab staff={staff} />}
        {activeTab === 'materials' && <StaffMaterialsTab staff={staff} />}
      </div>

      {/* STEP-STAFF-PORTAL-P5 — 내 정보 수정 모달 */}
      <StaffInfoEditModal open={infoOpen} staff={staff}
        onClose={() => setInfoOpen(false)}
        onSaved={(next) => setStaff({ ...staff, name: next.name, affiliation: next.affiliation })} />
    </div>
  );
}
