// bal24 v2 — 강사 통합 탭 (강사 배정 + 강사료 + 강사조서 / PARTNER는 담당팀)
// 박경수님 + SkyClaw STEP-STAFF-PORTAL-REDESIGN PART G (2026-05-28) — 강사조서 서브탭 추가

import { useState } from 'react';
import SubToggle from './SubToggle';
import StaffStudentsTab from './StaffStudentsTab';
import StaffFeeTab from './StaffFeeTab';
import MentorTeamTab from './MentorTeamTab';
import InstructorProfileTab from './InstructorProfileTab';

interface Props {
  programId: string;
  isPartner: boolean;
}

type SubKey = 'staff' | 'staff_fee' | 'profile';

const ITEMS: { key: SubKey; label: string }[] = [
  { key: 'staff',     label: '강사 배정' },
  { key: 'staff_fee', label: '강사료' },
  { key: 'profile',   label: '강사조서' },
];

export default function InstructorManageTab({ programId, isPartner }: Props) {
  const [sub, setSub] = useState<SubKey>('staff');

  if (isPartner) {
    return <MentorTeamTab programId={programId} />;
  }

  return (
    <div className="space-y-4">
      <SubToggle items={ITEMS} active={sub} onChange={setSub} />
      {sub === 'staff'     && <StaffStudentsTab    programId={programId} />}
      {sub === 'staff_fee' && <StaffFeeTab         programId={programId} />}
      {sub === 'profile'   && <InstructorProfileTab programId={programId} />}
    </div>
  );
}
