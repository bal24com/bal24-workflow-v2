// bal24 v2 — 차시별 인력 섹션
//   STEP-CURRICULUM-INLINE-ROLE (옵션 B) — 행2에 항상 노출, 4역할(강사·멘토·FT·TA),
//   역할 콤보 + 검색 모달로 한 명씩 추가 / 배정된 인원만 태그로 노출

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

/** STEP-PROGRAM-ENHANCE-FULL — 부모(CurriculumTab)가 1회 fetch한 staff_pool 옵션 */
export interface StaffOption {
  id: string;
  name: string;
  organization?: string | null;
}

interface Props {
  curriculumId: string;
  /** 부모가 등록·삭제 시 사용하는 옵션 콜백 (외부 토스트 등) */
  onChanged?: () => void;
  /** STEP-PROGRAM-ENHANCE-FULL — staff_pool 인라인 select용 옵션 (N번 fetch 방지) */
  staffOptions?: StaffOption[];
}

// 운영진 제외 4역할 (박경수님 요청 — 강사·멘토·FT·TA만)
const ROLES: CurriculumStaffRole[] = ['강사', '멘토', 'FT', 'TA'];

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

export default function CurriculumRowStaffSection({ curriculumId, onChanged, staffOptions = [] }: Props) {
  const toast = useToast();
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  // 콤보로 역할 선택 후 검색 모달 → 한 명 추가
  const [pickRole, setPickRole] = useState<CurriculumStaffRole>('강사');
  const [modalOpen, setModalOpen] = useState(false);

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

  // 배정된 인력만 역할 그룹으로 묶음 (빈 역할은 노출 안 함)
  const grouped = ROLES.map((role) => ({ role, list: rows.filter((r) => r.role === role) }))
    .filter((g) => g.list.length > 0);

  return (
    <div className="flex items-center gap-2 flex-wrap py-1">
      {/* 배정된 인력 태그 — 역할별로 묶어서 표시 */}
      {grouped.length > 0 ? grouped.map(({ role, list }) => (
        <div key={role} className="inline-flex items-center gap-1 flex-wrap">
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border ${ROLE_STYLE[role]}`}>
            {role}
          </span>
          {list.map((r) => (
            <span key={r.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-white text-slate-700 border border-slate-200">
              <span>{r.name}</span>
              <span className="text-[9px] text-slate-400">{r.source === 'external' ? '전문가' : '팀원'}</span>
              <button type="button" onClick={() => void handleRemove(r)} aria-label="배정 해제"
                className="ml-0.5 opacity-60 hover:opacity-100"><X size={9} aria-hidden="true" /></button>
            </span>
          ))}
        </div>
      )) : (
        <span className="text-[11px] text-slate-400 italic">배정된 인력이 없어요.</span>
      )}

      {/* 콤보 + 인라인 select + 모달 검색 — 박경수님 spec: 빠른 선택 + 상세 검색 둘 다 */}
      <div className="inline-flex items-center gap-1 ml-auto flex-wrap">
        <select value={pickRole} onChange={(e) => setPickRole(e.target.value as CurriculumStaffRole)}
          className="h-7 px-2 rounded-md border border-violet-200 bg-white text-[11px] font-semibold text-violet-700 focus:outline-none focus:border-violet-400">
          {ROLES.map((r) => (<option key={r} value={r}>{r}</option>))}
        </select>
        {/* STEP-PROGRAM-ENHANCE-FULL — 인라인 staff_pool 빠른 선택 */}
        {staffOptions.length > 0 && (
          <select
            onChange={(e) => {
              const opt = staffOptions.find((s) => s.id === e.target.value);
              if (opt) void handleSelect(pickRole, { sourceType: 'staff_pool', id: opt.id, name: opt.name, organization: opt.organization ?? undefined });
              e.target.value = '';
            }}
            className="h-7 px-2 rounded-md border border-slate-200 bg-white text-[11px] focus:outline-none focus:border-violet-400 max-w-[160px]">
            <option value="">+ 전문가 선택</option>
            {staffOptions
              .filter((s) => !rows.some((r) => r.sourceId === s.id))
              .map((s) => (<option key={s.id} value={s.id}>{s.name}{s.organization ? ` (${s.organization})` : ''}</option>))}
          </select>
        )}
        <button type="button" onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-0.5 h-7 px-2.5 rounded-md text-[11px] font-bold text-white bg-violet-600 hover:bg-violet-700">
          <Plus size={10} aria-hidden="true" /> 상세 검색
        </button>
      </div>

      <StaffSearchModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        role={pickRole}
        excludeIds={rows.filter((r) => r.role === pickRole).map((r) => r.sourceId)}
        onSelect={(person) => void handleSelect(pickRole, person)}
      />
    </div>
  );
}
