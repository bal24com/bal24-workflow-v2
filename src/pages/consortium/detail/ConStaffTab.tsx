// bal24 v2 — 컨소시엄 탭5: 인력·자원 (전문가 배정 — staff_pool 원본 무변경)

import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Loader2, Plus, Check, X, Trash2 } from 'lucide-react';
import { Modal, Button, Input } from '../../../components/ui';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../contexts/ToastContext';
import { BADGE_BASE } from '../../../utils/statusStyles';
import EmptyState from '../../../components/EmptyState';
import { STAFF_ROLE, STAFF_ROLE_LABEL, type ConsortiumStaff, type StaffRole } from '../consortiumTypes';
import type { Program, StaffPool } from '../../../types/database';

const FEE_TYPES = [
  { value: 'education', label: '교육비' },
  { value: 'mentoring', label: '멘토링비' },
  { value: 'consulting', label: '컨설팅비' },
  { value: 'etc', label: '기타' },
];

interface Props {
  consortiumId: string;
}

const STAFF_SELECT = `
  *,
  staff_pool!consortium_staff_expert_id_fkey(id, name, specialty),
  programs!consortium_staff_program_id_fkey(id, name)
`.replace(/\s+/g, ' ');

export default function ConStaffTab({ consortiumId }: Props) {
  const toast = useToast();
  const [staff, setStaff] = useState<ConsortiumStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignOpen, setAssignOpen] = useState(false);

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('consortium_staff')
        .select(STAFF_SELECT)
        .eq('consortium_id', consortiumId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setStaff((data as unknown as ConsortiumStaff[] | null) ?? []);
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[con-staff] 조회 실패:', raw);
      toast.error('인력 목록을 불러오지 못했어요.');
    } finally {
      setLoading(false);
    }
  }, [consortiumId, toast]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await fetchStaff();
      if (cancelled) return;
    })();
    return () => { cancelled = true; };
  }, [fetchStaff]);

  const handleToggleConfirm = async (s: ConsortiumStaff) => {
    const next = !s.confirmed;
    const { error } = await supabase.from('consortium_staff').update({ confirmed: next }).eq('id', s.id);
    if (error) {
      console.error('[con-staff] 확정 토글 실패:', error.message);
      toast.error('확정 상태를 변경하지 못했어요.');
      return;
    }
    toast.success(next ? '확정 처리했어요.' : '확정 해제했어요.');
    void fetchStaff();
  };

  const handleRemove = async (s: ConsortiumStaff) => {
    if (!window.confirm(`"${s.staff_pool?.name ?? '전문가'}" 배정을 취소할까요?`)) return;
    const { error } = await supabase.from('consortium_staff').delete().eq('id', s.id);
    if (error) {
      console.error('[con-staff] 배정 취소 실패:', error.message);
      toast.error('배정 취소 중 오류가 발생했어요.');
      return;
    }
    toast.success('배정을 취소했어요.');
    void fetchStaff();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">총 {staff.length}명 — staff_pool 원본 무변경</p>
        <Button variant="primary" size="sm" leftIcon={<Plus size={14} />} onClick={() => setAssignOpen(true)}>
          + 전문가 배정
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-violet-400" size={24} aria-hidden="true" />
        </div>
      ) : staff.length === 0 ? (
        <EmptyState
          emoji="👥"
          title="아직 배정된 전문가가 없어요."
          description="컨소시엄에서 활동할 전문가를 배정해 주세요."
          action={
            <Button variant="primary" leftIcon={<Plus size={14} />} onClick={() => setAssignOpen(true)}>
              + 전문가 배정
            </Button>
          }
        />
      ) : (
        <div className="bg-white rounded-2xl border border-violet-100 overflow-x-auto shadow-[0_4px_16px_rgba(124,58,237,0.06)]">
          <table className="w-full text-sm">
            <thead className="bg-violet-50/40 text-slate-500 text-xs">
              <tr>
                <th className="text-left px-3 py-2 font-semibold">이름</th>
                <th className="text-left px-3 py-2 font-semibold">전문분야</th>
                <th className="text-left px-3 py-2 font-semibold">역할</th>
                <th className="text-left px-3 py-2 font-semibold">연결 프로그램</th>
                <th className="text-left px-3 py-2 font-semibold">지급 유형</th>
                <th className="text-left px-3 py-2 font-semibold">비고</th>
                <th className="text-center px-3 py-2 font-semibold">확정</th>
                <th className="text-center px-3 py-2 font-semibold">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {staff.map((s) => (
                <tr key={s.id} className="hover:bg-violet-50/40">
                  <td className="px-3 py-2 font-semibold text-[#1E1B4B]">{s.staff_pool?.name ?? '미지정'}</td>
                  <td className="px-3 py-2 text-xs text-slate-600">
                    {s.staff_pool?.specialty?.length ? s.staff_pool.specialty.join(', ') : '-'}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`${BADGE_BASE} bg-violet-50 text-violet-700 border-violet-200`}>
                      {STAFF_ROLE_LABEL[s.role]}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-700 truncate max-w-[200px]">{s.programs?.name ?? '-'}</td>
                  <td className="px-3 py-2 text-xs text-slate-700">
                    {FEE_TYPES.find((f) => f.value === s.fee_type)?.label ?? '-'}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-600 truncate max-w-[180px]">{s.notes ?? '-'}</td>
                  <td className="px-3 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => void handleToggleConfirm(s)}
                      aria-label={s.confirmed ? '확정 해제' : '확정 처리'}
                      className={`inline-flex items-center justify-center w-7 h-7 rounded-md transition ${
                        s.confirmed
                          ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                          : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                      }`}
                    >
                      {s.confirmed ? <Check size={14} aria-hidden="true" /> : <X size={14} aria-hidden="true" />}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => void handleRemove(s)}
                      aria-label="배정 취소"
                      className="rounded p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {assignOpen && (
        <AssignModal
          consortiumId={consortiumId}
          onClose={() => setAssignOpen(false)}
          onSaved={() => {
            setAssignOpen(false);
            void fetchStaff();
          }}
        />
      )}
    </div>
  );
}

interface AssignModalProps {
  consortiumId: string;
  onClose: () => void;
  onSaved: () => void;
}

function AssignModal({ consortiumId, onClose, onSaved }: AssignModalProps) {
  const toast = useToast();
  const [experts, setExperts] = useState<Pick<StaffPool, 'id' | 'name' | 'specialty'>[]>([]);
  const [programs, setPrograms] = useState<Pick<Program, 'id' | 'name'>[]>([]);
  const [search, setSearch] = useState('');
  const [expertId, setExpertId] = useState('');
  const [role, setRole] = useState<StaffRole>('instructor');
  const [feeType, setFeeType] = useState<string>('');
  const [programId, setProgramId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [eRes, pRes] = await Promise.all([
        supabase.from('staff_pool').select('id, name, specialty').order('name'),
        supabase.from('programs').select('id, name').eq('consortium_id', consortiumId).order('created_at', { ascending: false }),
      ]);
      if (cancelled) return;
      if (eRes.error) console.error('[con-staff-assign] 전문가 조회 실패:', eRes.error.message);
      if (pRes.error) console.error('[con-staff-assign] 프로그램 조회 실패:', pRes.error.message);
      setExperts(eRes.data ?? []);
      setPrograms(pRes.data ?? []);
    })();
    return () => { cancelled = true; };
  }, [consortiumId]);

  const filtered = experts.filter((e) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return e.name.toLowerCase().includes(q) || (e.specialty ?? []).some((s) => s.toLowerCase().includes(q));
  });

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!expertId) {
      toast.error('전문가를 선택해 주세요.');
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from('consortium_staff').insert({
        consortium_id: consortiumId,
        expert_id: expertId,
        program_id: programId || null,
        role,
        fee_type: feeType || null,
        notes: notes.trim() || null,
        confirmed: false,
      });
      if (error) throw error;
      toast.success('전문가를 배정했어요.');
      onSaved();
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[con-staff-assign] 배정 실패:', raw);
      const m = raw.toLowerCase();
      if (m.includes('duplicate') || m.includes('unique')) {
        toast.error('이미 같은 역할로 배정된 전문가예요.');
      } else {
        toast.error('배정 중 오류가 발생했어요.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="전문가 배정"
      description="staff_pool 에서 선택만 — 원본 데이터는 변경되지 않아요."
      size="brand"
      closeOnBackdrop={!submitting}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submitting}>취소</Button>
          <Button type="submit" form="con-staff-assign-form" variant="primary" loading={submitting}>저장하기</Button>
        </>
      }
    >
      <form id="con-staff-assign-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Input label="전문가 검색" value={search} onChange={(e) => setSearch(e.target.value)} disabled={submitting} placeholder="이름 또는 분야" />

        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-slate-700">전문가 선택 <span className="text-rose-500">*</span></label>
          <select
            value={expertId}
            onChange={(e) => setExpertId(e.target.value)}
            disabled={submitting}
            size={Math.min(6, Math.max(3, filtered.length))}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary"
          >
            {filtered.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}{e.specialty?.length ? ` (${e.specialty.join(', ')})` : ''}
              </option>
            ))}
            {filtered.length === 0 && <option value="" disabled>검색 결과 없음</option>}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">역할 <span className="text-rose-500">*</span></label>
            <select value={role} onChange={(e) => setRole(e.target.value as StaffRole)} disabled={submitting}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary">
              {STAFF_ROLE.map((r) => (<option key={r} value={r}>{STAFF_ROLE_LABEL[r]}</option>))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">지급 유형</label>
            <select value={feeType} onChange={(e) => setFeeType(e.target.value)} disabled={submitting}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary">
              <option value="">선택 없음</option>
              {FEE_TYPES.map((f) => (<option key={f.value} value={f.value}>{f.label}</option>))}
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-slate-700">연결 프로그램 (선택)</label>
          <select value={programId} onChange={(e) => setProgramId(e.target.value)} disabled={submitting}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary">
            <option value="">선택 없음</option>
            {programs.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-slate-700">비고</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} disabled={submitting} rows={2}
            placeholder="추가 메모"
            className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary disabled:opacity-60" />
        </div>
      </form>
    </Modal>
  );
}
