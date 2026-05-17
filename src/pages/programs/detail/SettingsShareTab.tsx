// bal24 v2 — 설정·공유 통합 탭
// STEP-TAB-RESTRUCTURE-B — '일지·수료증' / '지원금' / '수료 기준' 흡수
// STEP-MENTORING-FULL — '멘토링' sub 제거 (메인 탭으로 승격)

import { useState } from 'react';
import SubToggle from './SubToggle';
import ShareTab from './ShareTab';
import ProgramFilesTab from './ProgramFilesTab';
import AttendanceLogTab from './AttendanceLogTab';
import GrantManageTab from './GrantManageTab';
import CompletionThresholdPanel from './CompletionThresholdPanel';

interface Props {
  programId: string;
  isPM: boolean;
  consortiumId: string | null;
  applicationType?: 'open' | 'evaluation' | null;
  hasConsortium: boolean;
}

type SubKey = 'share' | 'files' | 'activity' | 'grant' | 'completion';

export default function SettingsShareTab({ programId, isPM, consortiumId, applicationType, hasConsortium }: Props) {
  const items: { key: SubKey; label: string }[] = [
    { key: 'share',      label: '외부 공유' },
    { key: 'files',      label: '파일' },
    { key: 'activity',   label: '일지·수료증' },
    ...(isPM ? [{ key: 'grant' as const, label: '지원금' }] : []),
    { key: 'completion', label: '수료 기준' },
  ];
  const [sub, setSub] = useState<SubKey>('share');
  return (
    <div className="space-y-4">
      <SubToggle items={items} active={sub} onChange={setSub} />
      {sub === 'share'      && <ShareTab programId={programId} />}
      {sub === 'files'      && <ProgramFilesTab programId={programId} />}
      {sub === 'activity'   && <AttendanceLogTab programId={programId} />}
      {sub === 'grant'      && isPM && (
        <GrantManageTab
          programId={programId}
          consortiumId={consortiumId}
          isPM={isPM}
          applicationType={applicationType}
          hasConsortium={hasConsortium}
        />
      )}
      {sub === 'completion' && <CompletionThresholdPanel programId={programId} />}
    </div>
  );
}
