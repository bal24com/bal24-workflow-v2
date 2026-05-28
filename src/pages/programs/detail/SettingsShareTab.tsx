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
// 박경수님 + SkyClaw STEP-STAFF-PORTAL-REDESIGN PART E PM (2026-05-28) — 일정 4단계 등록 UI
import ScheduleItemsManager from './ScheduleItemsManager';
// 박경수님 2026-05-28 STEP-PM-PORTAL-ADMIN — 포털 발급·개요·설문 관리
import PortalIntroEditor from '../../../components/portal-admin/PortalIntroEditor';
import PortalIssueSection from '../../../components/portal-admin/PortalIssueSection';
import ProgramSurveyManagerTab from '../../portal/survey/ProgramSurveyManagerTab';

interface Props {
  programId: string;
  projectId?: string | null;
  isPM: boolean;
  consortiumId: string | null;
  applicationType?: 'open' | 'evaluation' | null;
  hasConsortium: boolean;
}

type SubKey = 'share' | 'files' | 'activity' | 'schedule' | 'grant' | 'completion' | 'portal';

export default function SettingsShareTab({ programId, projectId, isPM, consortiumId, applicationType, hasConsortium }: Props) {
  const items: { key: SubKey; label: string }[] = [
    { key: 'share',      label: '외부 공유' },
    { key: 'files',      label: '파일' },
    { key: 'activity',   label: '일지·수료증' },
    // STEP-STAFF-PORTAL-REDESIGN PART E (2026-05-28) — PM 만 일정 4단계 등록
    ...(isPM ? [{ key: 'schedule' as const, label: '일정 단계' }] : []),
    ...(isPM ? [{ key: 'grant' as const, label: '지원금' }] : []),
    { key: 'completion', label: '수료 기준' },
    // 박경수님 2026-05-28 STEP-PM-PORTAL-ADMIN — PM 만 포털·설문 관리
    ...(isPM ? [{ key: 'portal' as const, label: '포털·설문' }] : []),
  ];
  const [sub, setSub] = useState<SubKey>('share');
  return (
    <div className="space-y-4">
      <SubToggle items={items} active={sub} onChange={setSub} />
      {sub === 'share'      && <ShareTab programId={programId} />}
      {sub === 'files'      && <ProgramFilesTab programId={programId} />}
      {sub === 'activity'   && <AttendanceLogTab programId={programId} />}
      {sub === 'schedule'   && isPM && <ScheduleItemsManager programId={programId} />}
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
      {sub === 'portal' && isPM && (
        <div className="space-y-4">
          <PortalIntroEditor programId={programId} editable={true} />
          <PortalIssueSection programId={programId} projectId={projectId ?? null} />
          <ProgramSurveyManagerTab programId={programId} projectId={projectId ?? null} />
        </div>
      )}
    </div>
  );
}
