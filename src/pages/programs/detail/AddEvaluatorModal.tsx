// bal24 v2 — STEP-EVALUATION-SYSTEM 평가위원 추가 모달
// staff_pool 검색 + 평가비/유형 입력 → INSERT.

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Modal, Button, Input } from '../../../components/ui';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { addEvaluator } from './evaluatorUtils';
import type { EvaluatorFeeType } from '../../../types/database';

interface Props {
  open: boolean;
  programId: string;
  onClose: () => void;
  onAdded: () => void;
}

interface StaffPoolOption {
  id: string;
  name: string;
  email: string | null;
}

const FEE_TYPE_OPTIONS: EvaluatorFeeType[] = ['3.3', '8.8', '면세'];
const FEE_TYPE_LABELS: Record<EvaluatorFeeType, string> = {
  '3.3': '3.3% 사업소득',
  '8.8': '8.8% 기타소득',
  '면세': '면세',
};

export default function AddEvaluatorModal({ open, programId, onClose, onAdded }: Props) {
  const { user } = useAuth();
  const toast = useToast();
  const [pool, setPool] = useState<StaffPoolOption[]>([]);
  const [loadingPool, setLoadingPool] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [search, setSearch] = useState('');
  const [feeAmount, setFeeAmount] = useState('100000');
  const [feeType, setFeeType] = useState<EvaluatorFeeType>('3.3');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingPool(true);
    void (async () => {
      const { data, error } = await supabase
        .from('staff_pool')
        .select('id, name, email')
        .order('name');
      if (cancelled) return;
      if (error) {
        console.error('[evaluator] staff_pool 조회 실패:', error.message);
        toast.error('전문가 목록을 불러오지 못했어요.');
      } else {
        setPool(((data ?? []) as StaffPoolOption[]).filter((s) => !!s.name));
      }
      setLoadingPool(false);
    })();
    return () => { cancelled = true; };
  }, [open, toast]);

  useEffect(() => {
    if (open) return;
    setSelectedId('');
    setSearch('');
    setFeeAmount('100000');
    setFeeType('3.3');
    setNote('');
  }, [open]);

  const filteredPool = pool.filter((s) => {
    const k = search.trim().toLowerCase();
    if (!k) return true;
    return s.name.toLowerCase().includes(k) || (s.email ?? '').toLowerCase().includes(k);
  });

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedId) { toast.error('평가위원을 선택해 주세요.'); return; }
    const amount = Number(feeAmount.replace(/,/g, ''));
    if (Number.isNaN(amount) || amount < 0) { toast.error('평가비는 0 이상의 숫자여야 해요.'); return; }
    setSubmitting(true);
    try {
      const result = await addEvaluator({
        programId,
        staffPoolId: selectedId,
        feeAmount: amount,
        feeType,
        note,
        createdBy: user?.id ?? null,
      });
      if (!result.success) {
        toast.error(result.error ?? '평가위원 추가에 실패했어요.');
        return;
      }
      toast.success('평가위원을 추가했어요.');
      onAdded();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="평가위원 추가"
      description="staff_pool 에서 평가위원을 선택하고 평가비를 입력해요."
      size="md"
      closeOnBackdrop={!submitting}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submitting}>취소</Button>
          <Button type="submit" form="add-evaluator-form" variant="primary" loading={submitting}>저장</Button>
        </>
      }
    >
      <form id="add-evaluator-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Input
          label="검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="이름·이메일로 검색"
          disabled={submitting}
        />

        <div className="space-y-1.5">
          <label htmlFor="evaluator-pool" className="text-sm font-semibold text-slate-700">
            평가위원 <span className="text-rose-500">*</span>
          </label>
          <select
            id="evaluator-pool"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            disabled={submitting || loadingPool}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
          >
            <option value="">— 선택 —</option>
            {filteredPool.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}{s.email ? ` (${s.email})` : ''}
              </option>
            ))}
          </select>
          {loadingPool && <p className="text-[11px] text-slate-400">불러오는 중…</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            type="number"
            label="평가비 (원)"
            inputMode="numeric"
            value={feeAmount}
            onChange={(e) => setFeeAmount(e.target.value)}
            disabled={submitting}
            min={0}
            step={10000}
          />
          <div className="space-y-1.5">
            <label htmlFor="evaluator-fee-type" className="text-sm font-semibold text-slate-700">원천징수</label>
            <select
              id="evaluator-fee-type"
              value={feeType}
              onChange={(e) => setFeeType(e.target.value as EvaluatorFeeType)}
              disabled={submitting}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
            >
              {FEE_TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>{FEE_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>
        </div>

        <Input
          label="메모"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={submitting}
          placeholder="(선택)"
        />
      </form>
    </Modal>
  );
}
