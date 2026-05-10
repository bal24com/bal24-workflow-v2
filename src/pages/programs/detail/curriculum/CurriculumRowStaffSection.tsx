// bal24 v2 — STEP-CURRICULUM-FULL 차시별 5역할 인력 섹션
// 강사·멘토·FT·TA·운영진을 한 카드 안에서 팝업 검색으로 추가/삭제

import { useCallback, useEffect, useState } from 'react';
import { Plus, X, Loader2 } from 'lucide-react';
import { supabase } from '../../../../lib/supabase';
import { useToast } from '../../../../contexts/ToastContext';
import StaffSearchModal, { type SelectedPerson } from '../../../../components/ui/StaffSearchModal';
import type { CurriculumStaffRole } from '../../../../types/database';

interface StaffRow {
  id: string;
  role: CurriculumStaffRole;
  source: 'external' | 'internal';
  sourceId: string;   // staff_pool_id 또는 profile_id
  name: string;
}

interface Props {
  curriculumId: string;
  /** 부모가 등록·삭제 시 사용하는 옵션 콜백 (외부 토스트 등) */
  onChanged?: () => void;
}

const ROLES: CurriculumStaffRole[] = ['강사', '멘토', 'FT', 'TA', '운영진'];

const ROLE_STYLE: Record<CurriculumStaffRole, string> = {
  강사:   'bg-violet-100 text-violet-700 border-violet-200',
  멘토:   'bg-orange-100 text-orange-700 border-orange-200',
  FT:     'bg-cyan-100 text-cyan-700 border-cyan-200',
  TA:     'bg-emerald-100 text-emerald-700 border-emerald-200',
  운영진: 'bg-slate-100 text-slate-700 border-slate-200',
};

type StaffJoin = {
  id: string;
  role: CurriculumStaffRole;
  staff_pool_id: string | null;
  profile_id: string | null;
  staff_pool: { id: string; name: string } | { id: string; name: string }[] | null;
  profile:    { id: string; name: string } | { id: string; name: string }[] | null;
};

function pickOne<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? v[0] ?? null : v;
}

export default function CurriculumRowStaffSection({ curriculumId, onChanged }: Props) {
  const toast = useToast();
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalRole, setModalRole] = useState<CurriculumStaffRole | null>(null);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase.from('curriculum_staff')
      .select('id, role, staff_pool_id, profile_id, staff_pool:staff_pool(id,name), profile:profiles(id,name)')
      .eq('curriculum_id', curriculumId);
    if (error) {
      console.error('[curriculum-staff-section] 조회 실패:', error.message);
      toast.error('배정 인력을 불러오지 못했어요.');
      setRows([]); return;
    }
    const next: StaffRow[] = ((data ?? []) as StaffJoin[]).map((s) => {
      const sp = pickOne(s.staff_pool);
      const pf = pickOne(s.profile);
      const isExternal = !!s.staff_pool_id;
      return {
        id: s.id, role: s.role, source: isExternal ? 'external' : 'internal',
        sourceId: (isExternal ? s.staff_pool_id : s.profile_id) ?? '',
        name: isExternal ? (sp?.name ?? '?') : (pf?.name ?? '?'),
      };
    });
    setRows(next);
  }, [curriculumId, toast]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => { await refresh(); if (!cancelled) setLoading(false); })();
    return () => { cancelled = true; };
  }, [refresh]);

  async function handleSelect(role: CurriculumStaffRole, person: SelectedPerson) {
    const payload = {
      curriculum_id: curriculumId,
      staff_pool_id: person.sourceType === 'staff_pool' ? person.id : null,
      profile_id: person.sourceType === 'profile' ? person.id : null,
      role,
    };
    const { error } = await supabase.from('curriculum_staff').insert(payload);
    if (error) {
      console.error('[curriculum-staff-section] 배정 실패:', error.message);
      toast.error('배정에 실패했어요. 동일 인력이 이미 배정됐는지 확인해 주세요.');
      return;
    }
    toast.success(`${person.name}님을 ${role}로 배정했어요.`);
    await refresh();
    onChanged?.();
  }

  async function handleRemove(row: StaffRow) {
    if (!window.confirm(`${row.name}님 배정을 해제할까요?`)) return;
    const { error } = await supabase.from('curriculum_staff').delete().eq('id', row.id);
    if (error) {
      console.error('[curriculum-staff-section] 삭제 실패:', error.message);
      toast.error('배정 해제에 실패했어요.');
      return;
    }
    toast.success('배정을 해제했어요.');
    await refresh();
    onChanged?.();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-3 text-xs text-slate-400">
        <Loader2 size={12} className="animate-spin mr-1.5" /> 인력 불러오는 중…
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {ROLES.map((role) => {
        const list = rows.filter((r) => r.role === role);
        return (
          <div key={role} className="grid grid-cols-[60px_minmax(0,1fr)] items-start gap-2 py-1">
            <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-md text-[11px] font-bold border ${ROLE_STYLE[role]}`}>
              {role}
            </span>
            <div className="flex flex-wrap items-center gap-1">
              {list.map((r) => (
                <span key={r.id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-white text-slate-700 border border-slate-200">
                  <span>{r.name}</span>
                  <span className="text-[9px] text-slate-400">{r.source === 'external' ? '전문가' : '팀원'}</span>
                  <button type="button" onClick={() => void handleRemove(r)}
                    aria-label="배정 해제" className="ml-0.5 opacity-60 hover:opacity-100">
                    <X size={9} aria-hidden="true" />
                  </button>
                </span>
              ))}
              <button type="button" onClick={() => setModalRole(role)}
                className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100 border border-dashed border-violet-300">
                <Plus size={10} aria-hidden="true" /> {role} 검색
              </button>
            </div>
          </div>
        );
      })}
      <StaffSearchModal
        open={modalRole !== null}
        onClose={() => setModalRole(null)}
        role={modalRole ?? '강사'}
        excludeIds={modalRole ? rows.filter((r) => r.role === modalRole).map((r) => r.sourceId) : []}
        onSelect={(person) => modalRole && void handleSelect(modalRole, person)}
      />
    </div>
  );
}
