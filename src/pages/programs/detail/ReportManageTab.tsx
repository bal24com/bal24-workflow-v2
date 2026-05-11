// bal24 v2 — 만족도·보고 탭
// STEP-TAB-RESTRUCTURE-A — 결과보고·사업보고 검수는 결과보고서 탭으로 이동. 만족도 + 평가보고(evaluation 전용)만 잔여.

import { useState } from 'react';
import SubToggle from './SubToggle';
import SurveyTab from './SurveyTab';
import EvalReportTab from './EvalReportTab';
import PerformanceReportTab from './PerformanceReportTab';

interface Props {
  programId: string;
  isPartner: boolean;
  isMember: boolean;
  isStaff: boolean;
  applicationType?: 'open' | 'evaluation' | null;
}

type SubKey = 'survey' | 'eval_report';

export default function ReportManageTab({ programId, isMember, isStaff, applicationType }: Props) {
  // MEMBER — 본인 보고서 작성
  if (isMember) {
    return <PerformanceReportTab programId={programId} />;
  }

  // 평가형 사업이 아니면 SubToggle 없이 만족도만 직접 렌더
  if (applicationType !== 'evaluation') {
    return <SurveyTab programId={programId} canEdit={isStaff} />;
  }

  // 평가형 사업 — [만족도] + [평가보고]
  return <ReportWithEvalSubToggle programId={programId} canEdit={isStaff} />;
}

function ReportWithEvalSubToggle({ programId, canEdit }: { programId: string; canEdit: boolean }) {
  const [sub, setSub] = useState<SubKey>('survey');
  const items: { key: SubKey; label: string }[] = [
    { key: 'survey',      label: '만족도' },
    { key: 'eval_report', label: '평가보고' },
  ];
  return (
    <div className="space-y-4">
      <SubToggle items={items} active={sub} onChange={setSub} />
      {sub === 'survey'      && <SurveyTab programId={programId} canEdit={canEdit} />}
      {sub === 'eval_report' && <EvalReportTab programId={programId} />}
    </div>
  );
}
