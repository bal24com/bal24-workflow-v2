// 외주/급여 일괄 액션 바 — 박경수님 + SkyClaw STEP-PAYROLL-LIST-REDESIGN PART A (2026-05-28)
// 선택 행에 대해 수신확인·처리중·지급완료·반려·휴지통 일괄 실행. PayrollPage V-1 한도 줄이는 wrapper.

import { useState } from 'react';
import { CheckCircle2, Clock, DollarSign, XCircle, Trash2 } from 'lucide-react';
import { Button } from '../../components/ui';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import { bulkSoftDeletePayroll, bulkTransitionPayroll } from './payrollUtils';

interface Props {
  selectedIds: Set<string>;
  onCleared: () => void;
  onSaved: () => void;
}

export default function PayrollBulkActions({ selectedIds, onCleared, onSaved }: Props) {
  const toast = useToast();
  const { user } = useAuth();
  const [busy, setBusy] = useState<'received' | 'processing' | 'paid' | 'cancelled' | 'delete' | null>(null);
  const ids = Array.from(selectedIds);
  if (ids.length === 0) return null;

  async function runTransition(next: 'received' | 'processing' | 'paid' | 'cancelled') {
    setBusy(next);
    const err = await bulkTransitionPayroll(ids, next, user?.id);
    setBusy(null);
    if (err) { toast.error(`일괄 처리 실패: ${err}`); return; }
    toast.success(`${ids.length}건 처리 완료`);
    onCleared(); onSaved();
  }

  async function runDelete() {
    if (!window.confirm(`선택한 ${ids.length}건을 휴지통으로 보낼까요?`)) return;
    setBusy('delete');
    const err = await bulkSoftDeletePayroll(ids);
    setBusy(null);
    if (err) { toast.error(err); return; }
    toast.success(`${ids.length}건 삭제했어요.`);
    onCleared(); onSaved();
  }

  return (
    <div className="inline-flex items-center gap-1.5 flex-wrap">
      <span className="text-xs font-semibold text-slate-600 mr-1">{ids.length}건 선택</span>
      <Button size="sm" variant="outline" disabled={busy !== null} loading={busy === 'received'}
        onClick={() => void runTransition('received')} leftIcon={<CheckCircle2 size={12} />}
        className="!text-blue-700 !border-blue-200 hover:!bg-blue-50">수신확인</Button>
      <Button size="sm" variant="outline" disabled={busy !== null} loading={busy === 'processing'}
        onClick={() => void runTransition('processing')} leftIcon={<Clock size={12} />}
        className="!text-amber-700 !border-amber-200 hover:!bg-amber-50">처리중</Button>
      <Button size="sm" disabled={busy !== null} loading={busy === 'paid'}
        onClick={() => void runTransition('paid')} leftIcon={<DollarSign size={12} />}
        className="!bg-emerald-600 hover:!bg-emerald-700 !text-white">지급완료</Button>
      <Button size="sm" variant="outline" disabled={busy !== null} loading={busy === 'cancelled'}
        onClick={() => void runTransition('cancelled')} leftIcon={<XCircle size={12} />}
        className="!text-rose-600 !border-rose-200 hover:!bg-rose-50">반려</Button>
      <Button size="sm" variant="outline" disabled={busy !== null} loading={busy === 'delete'}
        onClick={() => void runDelete()} leftIcon={<Trash2 size={12} />}
        className="!border-rose-300 !text-rose-600 hover:!bg-rose-50">휴지통</Button>
      <button type="button" onClick={onCleared} className="text-[11px] text-slate-500 hover:text-slate-700 underline ml-1">선택 해제</button>
    </div>
  );
}
