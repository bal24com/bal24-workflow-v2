// bal24 v2 — 결과보고서 하단 정산 진행 바
// 5단계: 결과보고서 제출 → 고객사 승인 → 세금계산서 → 입금 → 출금

import { useState } from 'react';
import { Check } from 'lucide-react';
import { Button } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { formatKoreanDate } from './reportUtils';
import type { ProjectSettlementRow, SettlementStep } from '../../types/database';

const STEPS: { step: SettlementStep; label: string; field: keyof ProjectSettlementRow | null }[] = [
  { step: 1, label: '결과보고서 제출', field: null }, // step 1 진입은 보고서 submit 시
  { step: 2, label: '고객사 승인',   field: 'approved_at' },
  { step: 3, label: '세금계산서',     field: 'invoice_at' },
  { step: 4, label: '입금',           field: 'received_at' },
  { step: 5, label: '출금',           field: 'paid_out_at' },
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
  onChanged: () => void;
};

function translateError(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes('row-level security')) return '단계 변경 권한이 없어요.';
  return '단계 변경에 실패했어요. 잠시 후 다시 시도해 주세요.';
}

export default function ReportSettlementBar({ settlement, reportSubmitted, onChanged }: Props) {
  const [pending, setPending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!reportSubmitted && !settlement) {
    return (
      <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-xs text-muted">
        💡 결과보고서를 <strong>제출</strong>하면 정산 5단계 진행이 시작돼요.
      </div>
    );
  }

  const currentStep: SettlementStep = settlement?.current_step ?? 1;

  const handleNext = async () => {
    if (!settlement) return;
    if (currentStep >= 5) return;
    const nextStep = (currentStep + 1) as SettlementStep;
    const nowIso = new Date().toISOString();

    const fieldUpdates: Partial<ProjectSettlementRow> = { current_step: nextStep };
    // 단계 진입 시 해당 timestamp 기록
    if (nextStep === 2) fieldUpdates.approved_at = nowIso;
    if (nextStep === 3) fieldUpdates.invoice_at = nowIso;
    if (nextStep === 4) fieldUpdates.received_at = nowIso;
    if (nextStep === 5) fieldUpdates.paid_out_at = nowIso;

    setPending(true);
    setErrorMsg(null);
    try {
      const { error } = await supabase
        .from('project_settlements')
        .update(fieldUpdates)
        .eq('id', settlement.id);
      if (error) throw error;
      onChanged();
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[settlement] 단계 변경 실패:', raw);
      setErrorMsg(translateError(raw));
    } finally {
      setPending(false);
    }
  };

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
            <Button variant="primary" size="sm" loading={pending} onClick={() => void handleNext()}>
              {NEXT_LABELS[currentStep]}
            </Button>
          )}
          {settlement && currentStep === 5 && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-success">
              <Check size={14} /> 정산 완료
            </span>
          )}
        </div>
        {errorMsg && (
          <div role="alert" className="mt-3 rounded-lg bg-danger/10 border border-danger/20 px-3 py-2 text-xs text-danger">
            {errorMsg}
          </div>
        )}
      </div>
    </div>
  );
}
