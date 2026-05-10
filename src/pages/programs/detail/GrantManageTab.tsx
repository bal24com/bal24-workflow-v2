// bal24 v2 — 지원금 통합 탭 (배정 + 평가위원 / PM 전용)

import { useState } from 'react';
import SubToggle from './SubToggle';
import AssignmentTab from './AssignmentTab';
import EvaluatorTab from './EvaluatorTab';

interface Props {
  programId: string;
  consortiumId: string | null;
  isPM: boolean;
  applicationType?: 'open' | 'evaluation' | null;
  hasConsortium: boolean;
}

type SubKey = 'assignment' | 'evaluator';

export default function GrantManageTab({ programId, consortiumId, isPM, applicationType, hasConsortium }: Props) {
  const items: { key: SubKey; label: string }[] = [];
  if (isPM && hasConsortium) items.push({ key: 'assignment', label: '컨소시엄 배정' });
  if (applicationType === 'evaluation') items.push({ key: 'evaluator', label: '평가위원' });

  const [sub, setSub] = useState<SubKey>(items[0]?.key ?? 'assignment');

  if (items.length === 0) {
    return (
      <p className="text-sm text-slate-400 italic text-center py-8">
        이 프로그램에 표시할 지원금 항목이 없어요.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <SubToggle items={items} active={sub} onChange={setSub} />
      {sub === 'assignment' && isPM && hasConsortium && (
        <AssignmentTab programId={programId} consortiumId={consortiumId} isPM={isPM} />
      )}
      {sub === 'evaluator' && <EvaluatorTab programId={programId} />}
    </div>
  );
}
