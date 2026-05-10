// bal24 v2 — 만족도·보고 통합 탭 (권한별 sub-tab 분기)

import { useState } from 'react';
import SubToggle from './SubToggle';
import SurveyTab from './SurveyTab';
import ReportBuilderTab from './ReportBuilderTab';
import EvalReportTab from './EvalReportTab';
import ReportReviewTab from './ReportReviewTab';
import PerformanceReportTab from './PerformanceReportTab';

interface Props {
  programId: string;
  isPartner: boolean;
  isMember: boolean;
  isStaff: boolean;
  applicationType?: 'open' | 'evaluation' | null;
}

type SubKey = 'survey' | 'report' | 'eval_report' | 'report_review';

export default function ReportManageTab({ programId, isPartner, isMember, isStaff, applicationType }: Props) {
  // MEMBER — 본인 보고서 작성
  if (isMember) {
    return <PerformanceReportTab programId={programId} />;
  }

  // PM·STAFF·ADMIN — 4 sub-tab (평가형일 때만 평가보고)
  const items: { key: SubKey; label: string }[] = [
    { key: 'survey',        label: '만족도' },
    { key: 'report',        label: '결과보고' },
  ];
  if (applicationType === 'evaluation') {
    items.push({ key: 'eval_report', label: '평가보고' });
  }
  if (!isPartner) {
    items.push({ key: 'report_review', label: '사업보고 검수' });
  }

  const [sub, setSub] = useState<SubKey>('survey');

  return (
    <div className="space-y-4">
      <SubToggle items={items} active={sub} onChange={setSub} />
      {sub === 'survey'        && <SurveyTab programId={programId} canEdit={isStaff} />}
      {sub === 'report'        && <ReportBuilderTab programId={programId} />}
      {sub === 'eval_report'   && <EvalReportTab programId={programId} />}
      {sub === 'report_review' && <ReportReviewTab programId={programId} />}
    </div>
  );
}
