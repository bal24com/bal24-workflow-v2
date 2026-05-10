// bal24 v2 — 설정·공유 통합 탭 (외부공유 + 파일 + 멘토링 토글)

import { useState } from 'react';
import SubToggle from './SubToggle';
import ShareTab from './ShareTab';
import ProgramFilesTab from './ProgramFilesTab';
import MentoringTab from './MentoringTab';

interface Props {
  programId: string;
}

type SubKey = 'share' | 'files' | 'mentoring';

const ITEMS: { key: SubKey; label: string }[] = [
  { key: 'share',     label: '외부 공유' },
  { key: 'files',     label: '파일' },
  { key: 'mentoring', label: '멘토링' },
];

export default function SettingsShareTab({ programId }: Props) {
  const [sub, setSub] = useState<SubKey>('share');
  return (
    <div className="space-y-4">
      <SubToggle items={ITEMS} active={sub} onChange={setSub} />
      {sub === 'share'     && <ShareTab programId={programId} />}
      {sub === 'files'     && <ProgramFilesTab programId={programId} />}
      {sub === 'mentoring' && <MentoringTab programId={programId} />}
    </div>
  );
}
