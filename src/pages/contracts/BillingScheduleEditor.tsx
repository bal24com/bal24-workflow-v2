// 청구 단계 jsonb 편집 컴포넌트 — ContractFormModal 분리
// STEP-ACCOUNTING-FOLLOWUP3 (V-1 한도 분리)

import { Plus, Trash2 } from 'lucide-react';
import { Button, Input } from '../../components/ui';
import type { BillingScheduleItem } from '../../types/database';

interface Props {
  schedule: BillingScheduleItem[];
  onAdd: () => void;
  onUpdate: (idx: number, patch: Partial<BillingScheduleItem>) => void;
  onRemove: (idx: number) => void;
}

export default function BillingScheduleEditor({ schedule, onAdd, onUpdate, onRemove }: Props) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-slate-500">청구 단계</span>
        <Button variant="outline" size="sm" leftIcon={<Plus size={12} />} onClick={onAdd}>단계 추가</Button>
      </div>
      {schedule.length === 0 ? (
        <p className="text-xs text-slate-400 italic">청구 단계를 추가하지 않으면 일괄 계약으로 처리됩니다.</p>
      ) : (
        <div className="space-y-2">
          {schedule.map((s, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 items-center">
              <div className="col-span-1 text-center text-xs text-slate-500">{s.seq}회차</div>
              <Input
                className="col-span-3"
                type="number"
                value={String(s.amount || '')}
                onChange={(e) => onUpdate(idx, { amount: Number(e.target.value) || 0 })}
                placeholder="금액"
              />
              <Input
                className="col-span-3"
                type="date"
                value={s.due_date}
                onChange={(e) => onUpdate(idx, { due_date: e.target.value })}
              />
              <select
                className="col-span-3 h-10 rounded-xl border border-slate-200 px-2 text-xs"
                value={s.status}
                onChange={(e) => onUpdate(idx, { status: e.target.value as BillingScheduleItem['status'] })}
              >
                <option value="pending">대기</option>
                <option value="issued">발행</option>
                <option value="paid">완료</option>
              </select>
              <button
                type="button"
                onClick={() => onRemove(idx)}
                className="col-span-2 inline-flex items-center justify-center h-9 rounded-lg text-xs text-rose-600 hover:bg-rose-50"
              >
                <Trash2 size={12} className="mr-1" />삭제
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
