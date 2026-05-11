// bal24 v2 — 교육생 통합 탭 (참여자 명단 + 신청자 관리 + 출석)
// STEP-PROGRAM-UX-A — '출석' 서브탭 추가 (AttendanceLogTab에서 이동)

import { useState } from 'react';
import SubToggle from './SubToggle';
import ParticipantTab from './ParticipantTab';
import ApplicationTab from './ApplicationTab';
import AttendanceSection from './AttendanceSection';

interface Props {
  programId: string;
  programName: string;
  canEdit: boolean;
}

type SubKey = 'participants' | 'applications' | 'attendance';

const ITEMS: { key: SubKey; label: string }[] = [
  { key: 'participants', label: '참여자 명단' },
  { key: 'applications', label: '신청자 관리' },
  { key: 'attendance',   label: '출석' },
];

export default function ParticipantManageTab({ programId, programName, canEdit }: Props) {
  const [sub, setSub] = useState<SubKey>('participants');
  return (
    <div className="space-y-4">
      <SubToggle items={ITEMS} active={sub} onChange={setSub} />
      {sub === 'participants' && <ParticipantTab programId={programId} programName={programName} canEdit={canEdit} />}
      {sub === 'applications' && <ApplicationTab programId={programId} />}
      {sub === 'attendance'   && <AttendanceSection programId={programId} />}
    </div>
  );
}
