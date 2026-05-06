// bal24 v2 — 결과보고서 하단 정산 진행 바 (STEP 14: SettlementActionModal 연동)
// 5단계: 결과보고서 제출 → 고객사 승인 → 세금계산서 → 입금 → 출금

import { useState } from 'react';
import { Check } from 'lucide-react';
import { Button } from '../../components/ui';
import { formatKoreanDate } from './reportUtils';
import type { ProjectSettlementRow, SettlementStep } from '../../types/database';
import SettlementActionModal from '../settlements/SettlementActionModal';

const STEPS: { step: SettlementStep; label: string }[] = [
  { step: 1, label: '결과보고서 제출' },
  { step: 2, label: '고객사 승인' },
  { step: 3, label: '세금계산서' },
  { step: 4, label: '입금' },
  { step: 5, label: '출금' },
];

const NEXT_LABELS: Record<SettlementStep, string> = {
  1: '고객사 승인 처리',
  2: '세금계산서 발행',
  3: '입금 확인',
  4: '출금 처리',
  5: '완료',
};

type Props = {
  settlement: ProjectSettlementRow | null;
  /** 보고서가 제출된 상태일 때만 step 1 이상으로 진입 가능 */
  reportSubmitted: boolean;
  /** SettlementActionModal에 전달용 */
  projectId: string;
  projectName: string;
  onChanged: () => void;
};

export default function ReportSettlementBar({
  settlement, reportSubmitted, projectId, projectName, onChanged,
}: Props) {
  const [actionOpen, setActionOpen] = useState(false);

  if (!reportSubmitted && !settlement) {
    return (
      <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-xs text-muted">
        💡 결과보고서를 <strong>제출</strong>하면 정산 5단계 진행이 시작돼요.
      </div>
    );
  }

  const currentStep: SettlementStep = settlement?.current_step ?? 1;

  const stamps: Record<SettlementStep, string | null> = {
    1: settlement?.created_at ?? null,
    2: settlement?.approved_at ?? null,
    3: settlement?.invoice_at ?? null,
    4: settlement?.received_at ?? null,
    5: settlement?.paid_out_at ?? null,
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-white border border-slate-200 p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {STEPS.map(({ step, label }, idx) => {
              const isDone = step < currentStep;
              const isActive = step === currentStep;
              const stamp = stamps[step];
              return (
                <div key={step} className="flex items-center gap-2">
                  <div className={[
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                    isDone ? 'bg-success/10 text-success'
                      : isActive ? 'bg-primary text-white shadow-sm'
                      : 'bg-slate-100 text-slate-500',
                  ].join(' ')}>
                    {isDone ? <Check size={12} /> : <span>{step}</span>}
                    <span>{label}</span>
                  </div>
                  {idx < STEPS.length - 1 && (
                    <span className={['hidden sm:inline-block w-4 h-px',
                      step < currentStep ? 'bg-success' : 'bg-slate-200'].join(' ')} />
                  )}
                  {stamp && step <= currentStep && (
                    <span className="text-[10px] text-muted hidden md:inline">
                      {formatKoreanDate(stamp)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          {settlement && currentStep < 5 && (
            <Button variant="primary" size="sm" onClick={() => setActionOpen(true)}>
              {NEXT_LABELS[currentStep]}
            </Button>
          )}
          {settlement && currentStep === 5 && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-success">
              <Check size={14} /> 정산 완료
            </span>
          )}
        </div>
      </div>

      {settlement && (
        <SettlementActionModal
          open={actionOpen}
          settlement={settlement}
          projectId={projectId}
          projectName={projectName}
          onClose={() => setActionOpen(false)}
          onSaved={onChanged}
        />
      )}
    </div>
  );
}
