// bal24 v2 — STEP-STAFF-PORTAL-P2
// /staff-portal/:token (비로그인 공개) — 토큰 검증 + 6탭 디스패처.
// STEP-STAFF-PORTAL-UI-UNIFY: WorkFlow 디자인 시스템 통일 (bg #F8F7FF + 카드/탭/모달 패턴).

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
      <div className="min-h-screen flex items-center justify-center bg-[#F8F7FF]">
        <p className="text-slate-400 text-sm">불러오는 중…</p>
      </div>
    );
  }

  if (!staff) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F7FF] px-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-violet-100 shadow-[0_4px_16px_rgba(124,58,237,0.08)] p-8 text-center">
          <p className="text-[#1E1B4B] font-semibold">유효하지 않은 링크예요.</p>
          <p className="text-sm text-slate-500 mt-2">PM에게 새 링크를 요청해 주세요.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F7FF]">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <StaffPortalHeader staff={staff} onEditInfo={() => setInfoOpen(true)} />

        {/* 탭 메뉴 */}
        <nav role="tablist" aria-label="강사 포털 탭"
          className="flex gap-1 overflow-x-auto bg-white rounded-2xl border border-violet-100 shadow-[0_4px_16px_rgba(124,58,237,0.08)] p-1.5 mb-4">
          {TABS.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <button key={tab.key} type="button" role="tab" aria-selected={active}
                onClick={() => setActiveTab(tab.key)}
                className={`whitespace-nowrap px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
                  active
                    ? 'bg-violet-600 text-white'
                    : 'text-slate-500 hover:text-violet-600 hover:bg-violet-50'
                }`}>
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* 탭 콘텐츠 */}
        <div>
          {activeTab === 'overview'  && <StaffOverviewTab staff={staff} />}
          {activeTab === 'mentoring' && <StaffMentoringTab staff={staff} />}
          {activeTab === 'lecture'   && <StaffLectureTab staff={staff} />}
          {activeTab === 'log'       && <StaffLogTab staff={staff} />}
          {activeTab === 'schedule'  && <StaffScheduleTab staff={staff} />}
          {activeTab === 'materials' && <StaffMaterialsTab staff={staff} />}
        </div>
      </div>

      <StaffInfoEditModal open={infoOpen} staff={staff}
        onClose={() => setInfoOpen(false)}
        onSaved={(next) => setStaff({ ...staff, name: next.name, affiliation: next.affiliation })} />
    </div>
  );
}
