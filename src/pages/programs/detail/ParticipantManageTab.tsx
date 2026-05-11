// bal24 v2 — 교육생 통합 탭 (명단 + 신청 + 모집 + 출석)
// STEP-PROGRAM-UX-A — '출석' 서브탭 추가
// STEP-TAB-RESTRUCTURE-A — '모집' 서브탭 추가 (강사 배정 탭에서 이동)

import { useState } from 'react';
import SubToggle from './SubToggle';
import ParticipantTab from './ParticipantTab';
import ApplicationTab from './ApplicationTab';
import AttendanceSection from './AttendanceSection';
import RecruitsPanel from './applications/RecruitsPanel';

interface Props {
  programId: string;
  programName: string;
  canEdit: boolean;
}

type SubKey = 'participants' | 'applications' | 'recruit' | 'attendance';

const ITEMS: { key: SubKey; label: string }[] = [
  { key: 'participants', label: '명단' },
  { key: 'applications', label: '신청' },
  { key: 'recruit',      label: '모집' },
  { key: 'attendance',   label: '출석' },
];

export default function ParticipantManageTab({ programId, programName, canEdit }: Props) {
  const [sub, setSub] = useState<SubKey>('participants');
  return (
    <div className="space-y-4">
      <SubToggle items={ITEMS} active={sub} onChange={setSub} />
      {sub === 'participants' && <ParticipantTab programId={programId} programName={programName} canEdit={canEdit} />}
      {sub === 'applications' && <ApplicationTab programId={programId} />}
      {sub === 'recruit'      && (
        <section className="rounded-2xl border border-violet-100 bg-white p-5 shadow-[0_4px_16px_rgba(124,58,237,0.06)]">
          <RecruitsPanel programId={programId} />
        </section>
      )}
      {sub === 'attendance'   && <AttendanceSection programId={programId} />}
    </div>
  );
}
