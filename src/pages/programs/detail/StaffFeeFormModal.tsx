// bal24 v2 — STEP-STAFF-FEE-TAX 등록/수정 모달
// 외부전문가/내부직원 토글 + 단가×회수/총액 토글 + 원천징수 라디오 + 실시간 계산.

import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Modal, Button, Input } from '../../../components/ui';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { calculateFee } from './staffFeeUtils';
import type {
  StaffFee, FeeType, TaxType, InputMode,
} from '../../../types/staffFee';
import { FEE_TYPE_LABEL, TAX_TYPE_LABEL } from '../../../types/staffFee';

type TargetType = 'expert' | 'profile';

interface NameOption { id: string; name: string }

interface Props {
  open: boolean;
  programId: string;
  fee?: StaffFee | null;        // 있으면 수정, 없으면 신규
  onClose: () => void;
  onSaved: () => void;
}

const FEE_TYPE_OPTIONS: FeeType[] = ['education', 'mentoring', 'consulting', 'facilitation', 'etc'];
const TAX_OPTIONS: TaxType[] = ['3.3', '8.8', '면세'];

export default function StaffFeeFormModal({ open, programId, fee, onClose, onSaved }: Props) {
  const { user } = useAuth();
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [experts, setExperts] = useState<NameOption[]>([]);
  const [profiles, setProfiles] = useState<NameOption[]>([]);

  // form state
  const [targetType, setTargetType] = useState<TargetType>('expert');
  const [expertId, setExpertId] = useState<string>('');
  const [profileId, setProfileId] = useState<string>('');
  const [feeType, setFeeType] = useState<FeeType>('education');
  const [description, setDescription] = useState('');
  const [inputMode, setInputMode] = useState<InputMode>('unit');
  const [unitPrice, setUnitPrice] = useState('0');
  const [quantity, setQuantity] = useState('1');
  const [grossInput, setGrossInput] = useState('0');
  const [taxType, setTaxType] = useState<TaxType>('3.3');
  const [note, setNote] = useState('');

  // 강사 후보 fetch
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      const [{ data: poolData, error: poolErr }, { data: profData, error: profErr }] = await Promise.all([
        supabase.from('staff_pool').select('id, name').order('name'),
        supabase.from('profiles').select('id, name').eq('is_active', true).order('name'),
      ]);
      if (cancelled) return;
      if (poolErr) console.error('[staff-fee] 외부 전문가 조회 실패:', poolErr.message);
      if (profErr) console.error('[staff-fee] 내부 직원 조회 실패:', profErr.message);
      setExperts(((poolData ?? []) as NameOption[]).filter((r) => !!r.name));
      setProfiles(((profData ?? []) as NameOption[]).filter((r) => !!r.name));
    })();
    return () => { cancelled = true; };
  }, [open]);

  // 폼 초기화 (모달 open 또는 fee 변경)
  useEffect(() => {
    if (!open) return;
    if (fee) {
      setTargetType(fee.profile_id ? 'profile' : 'expert');
      setExpertId(fee.expert_id ?? '');
      setProfileId(fee.profile_id ?? '');
      setFeeType(fee.fee_type);
      setDescription(fee.description ?? '');
      setInputMode(fee.input_mode);
      setUnitPrice(String(fee.unit_price ?? 0));
      setQuantity(String(fee.quantity ?? 1));
      setGrossInput(String(fee.gross_amount ?? 0));
      setTaxType(fee.tax_type);
      setNote(fee.note ?? '');
    } else {
      setTargetType('expert');
      setExpertId(''); setProfileId('');
      setFeeType('education'); setDescription('');
      setInputMode('unit'); setUnitPrice('0'); setQuantity('1'); setGrossInput('0');
      setTaxType('3.3'); setNote('');
    }
  }, [open, fee]);

  // 실시간 계산
  const calc = useMemo(() => {
    const gross = inputMode === 'unit'
      ? Number(unitPrice || 0) * Number(quantity || 0)
      : Number(grossInput || 0);
    return calculateFee(gross, taxType);
  }, [inputMode, unitPrice, quantity, grossInput, taxType]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (targetType === 'expert' && !expertId) { toast.error('외부 전문가를 선택해 주세요.'); return; }
    if (targetType === 'profile' && !profileId) { toast.error('내부 직원을 선택해 주세요.'); return; }
    if (calc.grossAmount <= 0) { toast.error('금액을 입력해 주세요.'); return; }

    setSubmitting(true);
    try {
      const payload = {
        program_id: programId,
        expert_id: targetType === 'expert' ? expertId : null,
        profile_id: targetType === 'profile' ? profileId : null,
        fee_type: feeType,
        description: description.trim() || null,
        input_mode: inputMode,
        unit_price: inputMode === 'unit' ? Number(unitPrice || 0) : 0,
        quantity: inputMode === 'unit' ? Number(quantity || 1) : 1,
        gross_amount: calc.grossAmount,
        tax_type: taxType,
        tax_amount: calc.taxAmount,
        net_amount: calc.netAmount,
        note: note.trim() || null,
        created_by: fee ? undefined : (user?.id ?? null),
        updated_at: new Date().toISOString(),
      };
      const res = fee
        ? await supabase.from('program_staff_fees').update(payload).eq('id', fee.id)
        : await supabase.from('program_staff_fees').insert(payload);
      if (res.error) {
        console.error('[staff-fee] 저장 실패:', res.error.message);
        const msg = res.error.message.includes('duplicate')
          ? '동일 강사·활동유형 조합이 이미 등록되어 있어요.'
          : '저장에 실패했어요. 잠시 후 다시 시도해 주세요.';
        toast.error(msg);
        return;
      }
      toast.success('지급 기준을 저장했어요.');
      onSaved();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={fee ? '지급 기준 수정' : '지급 기준 추가'}
      size="lg"
      closeOnBackdrop={!submitting}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submitting}>취소</Button>
          <Button type="submit" form="staff-fee-form" variant="primary" loading={submitting}>저장</Button>
        </>
      }
    >
      <form id="staff-fee-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
        {/* 강사 선택 */}
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-slate-700">강사 구분</label>
          <div className="flex items-center gap-2">
            {(['expert', 'profile'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTargetType(t)}
                disabled={submitting}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  targetType === t
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >{t === 'expert' ? '외부 전문가' : '내부 직원'}</button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-slate-700">{targetType === 'expert' ? '외부 전문가' : '내부 직원'} <span className="text-rose-500">*</span></label>
          <select
            value={targetType === 'expert' ? expertId : profileId}
            onChange={(e) => targetType === 'expert' ? setExpertId(e.target.value) : setProfileId(e.target.value)}
            disabled={submitting}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
          >
            <option value="">— 선택 —</option>
            {(targetType === 'expert' ? experts : profiles).map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* 활동 정보 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">활동 유형 <span className="text-rose-500">*</span></label>
            <select
              value={feeType}
              onChange={(e) => setFeeType(e.target.value as FeeType)}
              disabled={submitting}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
            >
              {FEE_TYPE_OPTIONS.map((t) => <option key={t} value={t}>{FEE_TYPE_LABEL[t]}</option>)}
            </select>
          </div>
          <Input label="세부 내용" value={description} onChange={(e) => setDescription(e.target.value)} disabled={submitting} placeholder="예) 오프라인 9/11" />
        </div>

        {/* 금액 입력 */}
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-slate-700">금액 입력 방식</label>
          <div className="flex items-center gap-2">
            {(['unit', 'total'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setInputMode(m)}
                disabled={submitting}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  inputMode === m
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >{m === 'unit' ? '단가 × 회수' : '총액 직접 입력'}</button>
            ))}
          </div>
        </div>

        {inputMode === 'unit' ? (
          <div className="grid grid-cols-2 gap-3">
            <Input type="number" label="단가 (원)" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} disabled={submitting} min={0} step={1000} />
            <Input type="number" label="회수" value={quantity} onChange={(e) => setQuantity(e.target.value)} disabled={submitting} min={0.01} step={0.5} />
          </div>
        ) : (
          <Input type="number" label="총액 (원)" value={grossInput} onChange={(e) => setGrossInput(e.target.value)} disabled={submitting} min={0} step={1000} />
        )}

        {/* 원천징수 */}
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-slate-700">원천징수</label>
          <div className="flex items-center gap-2 flex-wrap">
            {TAX_OPTIONS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTaxType(t)}
                disabled={submitting}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  taxType === t
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >{TAX_TYPE_LABEL[t]}</button>
            ))}
          </div>
        </div>

        {/* 계산 미리보기 */}
        <div className="rounded-xl bg-violet-50/60 p-3 text-xs space-y-1">
          <div className="flex justify-between text-slate-600">
            <span>합계</span>
            <span className="tabular-nums font-semibold">{calc.grossAmount.toLocaleString()}원</span>
          </div>
          <div className="flex justify-between text-rose-600">
            <span>원천세 ({TAX_TYPE_LABEL[taxType]})</span>
            <span className="tabular-nums">▲ {calc.taxAmount.toLocaleString()}원</span>
          </div>
          <div className="flex justify-between border-t border-violet-200 pt-1 font-bold text-violet-700">
            <span>실수령</span>
            <span className="tabular-nums">{calc.netAmount.toLocaleString()}원</span>
          </div>
        </div>

        <Input label="메모" value={note} onChange={(e) => setNote(e.target.value)} disabled={submitting} placeholder="(선택)" />
      </form>
    </Modal>
  );
}
