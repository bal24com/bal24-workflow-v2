// bal24 v2 — STEP-STAFF-TOKEN-SIMPLIFY (PIN 제거 · staff_pool 영구 토큰 단순화)
// /staff-portal/:token (비로그인 공개) — staff_pool.staff_portal_token 으로 직접 조회 + 6탭 디스패처.

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import StaffPortalHeader from './StaffPortalHeader';
import StaffOverviewTab from './tabs/StaffOverviewTab';
import StaffMentoringTab from './tabs/StaffMentoringTab';
import StaffLectureTab from './tabs/StaffLectureTab';
import StaffLogTab from './tabs/StaffLogTab';
import StaffMaterialsTab from './tabs/StaffMaterialsTab';
import StaffInfoEditModal from './StaffInfoEditModal';
import PortalBoardTab from '../portal/PortalBoardTab';
import {
  resolveStaffByToken, fetchStaffPrograms,
  type StaffPortalIdentity, type StaffPortalProgram,
} from './staffPortalUtils';

// 박경수님 2026-05-26 STEP-PORTAL-MULTI-FIX PART E — 일정 탭 제거 (개요 탭 하단으로 이동).
const TABS = [
  { key: 'overview',   label: '개요' },
  { key: 'board',      label: '게시판' },
  { key: 'mentoring',  label: '멘토링' },
  { key: 'lecture',    label: '강의' },
  { key: 'log',        label: '일지' },
  { key: 'materials',  label: '자료' },
] as const;
type TabKey = typeof TABS[number]['key'];

export default function StaffPortalPage() {
  const { token } = useParams<{ token: string }>();
  const [staff, setStaff] = useState<StaffPortalIdentity | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [infoOpen, setInfoOpen] = useState(false);

  // STEP-STAFF-PORTAL-PROGRAM-SELECT — 프로그램 선택 컨텍스트
  const [programs, setPrograms] = useState<StaffPortalProgram[]>([]);
  const [programsLoading, setProgramsLoading] = useState(false);
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  const [portalId, setPortalId] = useState<string | null>(null);

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

  useEffect(() => {
    if (!staff) return;
    let cancelled = false;
    setProgramsLoading(true);
    void (async () => {
      const list = await fetchStaffPrograms(staff.id, staff.sourceType);
      if (cancelled) return;
      setPrograms(list);
      if (list.length === 1) setSelectedProgramId(list[0].id);
      setProgramsLoading(false);
    })();
    return () => { cancelled = true; };
  }, [staff]);

  const selectedProgram = useMemo(
    () => programs.find((p) => p.id === selectedProgramId) ?? null,
    [programs, selectedProgramId],
  );

  useEffect(() => {
    if (!selectedProgram) { setPortalId(null); return; }
    void (async () => {
      const { data } = await supabase
        .from('project_portals')
        .select('id')
        .eq('project_id', selectedProgram.project_id)
        .eq('is_active', true)
        .maybeSingle();
      if (data) setPortalId(data.id);
    })();
  }, [selectedProgram]);

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
          <p className="text-sm text-slate-500 mt-2">담당 PM에게 링크를 다시 요청해 주세요.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F7FF]">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <StaffPortalHeader staff={staff} onEditInfo={() => setInfoOpen(true)} />

        {selectedProgram && (
          <div className="mb-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-violet-50 border border-violet-200 text-violet-700 text-xs font-semibold">
            <CheckCircle2 size={12} aria-hidden="true" />
            선택된 프로그램: <span className="font-bold">{selectedProgram.name}</span>
          </div>
        )}

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

        <div>
          {activeTab === 'overview'  && (
            <StaffOverviewTab staff={staff} programs={programs} programsLoading={programsLoading}
              selectedProgramId={selectedProgramId}
              onSelectProgram={setSelectedProgramId} />
          )}
          {activeTab === 'board' && portalId && (
            <PortalBoardTab 
              portalId={portalId}
              staffId={staff.id}
              authorName={staff.name}
              authorRole="staff"
            />
          )}
          {activeTab === 'board' && !portalId && (
             <div className="bg-white rounded-3xl border border-dashed border-slate-200 p-12 text-center text-slate-400">
                <p className="text-sm">해당 프로젝트에 활성화된 포털이 없어 게시판을 이용할 수 없어요.</p>
             </div>
          )}
          {activeTab === 'mentoring' && <StaffMentoringTab staff={staff} selectedProgramId={selectedProgramId} onNavigateToLogTab={() => setActiveTab('log')} />}
          {activeTab === 'lecture'   && <StaffLectureTab   staff={staff} selectedProgramId={selectedProgramId} />}
          {activeTab === 'log'       && <StaffLogTab       staff={staff} selectedProgramId={selectedProgramId} />}
          {activeTab === 'materials' && <StaffMaterialsTab staff={staff} selectedProgramId={selectedProgramId} />}
        </div>
      </div>

      <StaffInfoEditModal open={infoOpen} staff={staff}
        onClose={() => setInfoOpen(false)}
        onSaved={(next) => setStaff({ ...staff, name: next.name, affiliation: next.affiliation })} />
    </div>
  );
}
