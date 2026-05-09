// bal24 v2 — 멘토 배정 모달 (STEP-MENTORING)
// 외부(staff_pool) / 내부(profiles) 선택 + 지급방식 + 원천징수 + 메모

import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Modal, Button, Input } from '../../../components/ui';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../contexts/ToastContext';
import { calcMentoringPay } from '../../../types/mentoring';
import type {
  MentoringAssignment, MentoringMeetType, MentoringPayType, MentoringTaxType,
} from '../../../types/mentoring';

interface Option { id: string; name: string; specialty?: string[] | null }

interface Props {
  open: boolean;
  programId: string;
  onClose: () => void;
  onSaved: () => void;
}

const SELECT_CLASS =
  'w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60';

export default function MentoringAssignModal({ open, programId, onClose, onSaved }: Props) {
  const toast = useToast();
  const [mentorSource, setMentorSource] = useState<'external' | 'internal'>('external');
  const [pools, setPools] = useState<Option[]>([]);
  const [profiles, setProfiles] = useState<Option[]>([]);
  const [mentorId, setMentorId] = useState('');
  const [meetType, setMeetType] = useState<MentoringMeetType>('대면');
  const [payType, setPayType] = useState<MentoringPayType>('단가×회수');
  const [unitPrice, setUnitPrice] = useState('');
  const [sessionCount, setSessionCount] = useState('');
  const [contractAmount, setContractAmount] = useState('');
  const [taxType, setTaxType] = useState<MentoringTaxType>('3.3%');
  const [pmNote, setPmNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 멘토 옵션 fetch
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      const [poolRes, profRes] = await Promise.all([
        supabase.from('staff_pool').select('id, name, specialty').order('name'),
        supabase.from('profiles').select('id, name, specialty').eq('is_active', true).order('name'),
      ]);
      if (cancelled) return;
      if (poolRes.error) console.error('[mentoring] 외부 멘토 조회 실패:', poolRes.error.message);
      else setPools((poolRes.data as Option[] | null) ?? []);
      if (profRes.error) console.error('[mentoring] 내부 멘토 조회 실패:', profRes.error.message);
      else setProfiles((profRes.data as Option[] | null) ?? []);
    })();
    return () => { cancelled = true; };
  }, [open]);

  // 닫힘 시 초기화
  useEffect(() => {
    if (open) return;
    setMentorSource('external');
    setMentorId('');
    setMeetType('대면');
    setPayType('단가×회수');
    setUnitPrice('');
    setSessionCount('');
    setContractAmount('');
    setTaxType('3.3%');
    setPmNote('');
    setSubmitting(false);
  }, [open]);

  // 미리보기 (계획 회수 기준)
  const preview = useMemo(() => {
    const draft: MentoringAssignment = {
      id: '', program_id: programId,
      mentor_pool_id: null, mentor_profile_id: null, mentee_ids: null,
      meet_type: meetType, pay_type: payType,
      unit_price: Number(unitPrice.replace(/,/g, '')) || null,
      session_count: Number(sessionCount.replace(/,/g, '')) || null,
      contract_amount: Number(contractAmount.replace(/,/g, '')) || null,
      tax_type: taxType, tax_type_locked: false,
      mentor_access_token: '', mentee_access_token: '',
      pm_note: null, status: '진행',
      created_at: '', updated_at: '',
    };
    const planned = Number(sessionCount.replace(/,/g, '')) || 0;
    return calcMentoringPay(draft, planned);
  }, [programId, meetType, payType, unitPrice, sessionCount, contractAmount, taxType]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!mentorId) {
      toast.error('멘토를 선택해 주세요.');
      return;
    }
    if (payType === '단가×회수' && (!unitPrice.trim() || !sessionCount.trim())) {
      toast.error('단가와 계획 회수를 입력해 주세요.');
      return;
    }
    if (payType === '전체계약' && !contractAmount.trim()) {
      toast.error('계약 금액을 입력해 주세요.');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        program_id: programId,
        mentor_pool_id: mentorSource === 'external' ? mentorId : null,
        mentor_profile_id: mentorSource === 'internal' ? mentorId : null,
        meet_type: meetType,
        pay_type: payType,
        unit_price: payType === '단가×회수' ? Number(unitPrice.replace(/,/g, '')) : null,
        session_count: payType === '단가×회수' ? Number(sessionCount.replace(/,/g, '')) : null,
        contract_amount: payType === '전체계약' ? Number(contractAmount.replace(/,/g, '')) : null,
        tax_type: taxType,
        pm_note: pmNote.trim() || null,
      };
      const { error } = await supabase.from('mentoring_assignments').insert(payload);
      if (error) {
        console.error('[mentoring] 배정 추가 실패:', error.message);
        toast.error('멘토 배정에 실패했어요. 잠시 후 다시 시도해 주세요.');
        return;
      }
      toast.success('멘토를 배정했어요.');
      onSaved();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const mentorOptions = mentorSource === 'external' ? pools : profiles;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="멘토 배정"
      description="외부 전문가풀 또는 내부 팀원 중에서 선택해 주세요."
      size="lg"
      closeOnBackdrop={!submitting}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submitting}>취소</Button>
          <Button type="submit" form="mentoring-assign-form" variant="primary" loading={submitting}>저장</Button>
        </>
      }
    >
      <form id="mentoring-assign-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
        {/* 멘토 소스 */}
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-slate-700">멘토 소스</label>
          <div className="flex items-center gap-2">
            {(['external', 'internal'] as const).map((src) => (
              <button
                key={src}
                type="button"
                onClick={() => { setMentorSource(src); setMentorId(''); }}
                disabled={submitting}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  mentorSource === src
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {src === 'external' ? '외부 (전문가풀)' : '내부 (팀원)'}
              </button>
            ))}
          </div>
        </div>

        {/* 멘토 선택 */}
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-slate-700">멘토</label>
          <select
            value={mentorId}
            onChange={(e) => setMentorId(e.target.value)}
            disabled={submitting}
            className={SELECT_CLASS}
          >
            <option value="">선택해 주세요</option>
            {mentorOptions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}{m.specialty && m.specialty.length > 0 ? ` · ${m.specialty.join('/')}` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* 방식 */}
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-slate-700">멘토링 방식</label>
          <div className="flex items-center gap-2">
            {(['대면', '비대면', '혼합'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMeetType(m)}
                disabled={submitting}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  meetType === m
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >{m}</button>
            ))}
          </div>
        </div>

        {/* 지급 방식 */}
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-slate-700">지급 방식</label>
          <div className="flex items-center gap-2">
            {(['단가×회수', '전체계약'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPayType(p)}
                disabled={submitting}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  payType === p
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >{p}</button>
            ))}
          </div>
        </div>

        {payType === '단가×회수' ? (
          <div className="grid grid-cols-2 gap-3">
            <Input label="단가 (원)" inputMode="numeric" value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)} disabled={submitting} placeholder="예) 100,000" />
            <Input label="계획 회수" inputMode="numeric" value={sessionCount}
              onChange={(e) => setSessionCount(e.target.value)} disabled={submitting} placeholder="예) 4" />
          </div>
        ) : (
          <Input label="계약 금액 (원)" inputMode="numeric" value={contractAmount}
            onChange={(e) => setContractAmount(e.target.value)} disabled={submitting} placeholder="예) 1,000,000" />
        )}

        {/* 원천징수 */}
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-slate-700">원천징수 (PM 초안)</label>
          <div className="flex items-center gap-2">
            {(['3.3%', '8.8%', '면세'] as const).map((t) => (
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
              >
                {t === '3.3%' ? '3.3% 사업소득' : t === '8.8%' ? '8.8% 기타소득' : '면세'}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-slate-400 italic">
            💡 멘토가 직접 1회 변경 가능해요. 이후에는 변경 요청이 필요해요.
          </p>
        </div>

        {/* 미리보기 */}
        <div className="rounded-xl border border-violet-100 bg-violet-50/40 p-3 text-xs space-y-1">
          <div className="flex justify-between"><span className="text-slate-600">예상 지급액</span><span className="font-bold text-[#1E1B4B] tabular-nums">{preview.base.toLocaleString()}원</span></div>
          <div className="flex justify-between"><span className="text-slate-600">원천징수 ({taxType})</span><span className="text-rose-600 tabular-nums">-{preview.deduction.toLocaleString()}원</span></div>
          <div className="flex justify-between border-t border-violet-200 pt-1"><span className="text-slate-700 font-semibold">실수령액</span><span className="font-bold text-violet-700 tabular-nums">{preview.net.toLocaleString()}원</span></div>
        </div>

        {/* PM 메모 */}
        <div className="space-y-1.5">
          <label htmlFor="pm-note" className="text-sm font-semibold text-slate-700">관리자 메모 (멘토 비공개)</label>
          <textarea
            id="pm-note"
            rows={2}
            value={pmNote}
            onChange={(e) => setPmNote(e.target.value)}
            disabled={submitting}
            placeholder="내부 메모"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60 resize-none"
          />
        </div>
      </form>
    </Modal>
  );
}
