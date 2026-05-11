// bal24 v2 — 차시별 인력 섹션
//   STEP-CURRICULUM-INLINE-ROLE (옵션 B) — 행2에 항상 노출, 4역할(강사·멘토·FT·TA),
//   STEP-CURRICULUM-INVITE-UPLOAD-FIX — 미등록 인력 직접 입력 + 초대 링크 생성

import { useCallback, useEffect, useState } from 'react';
import { Plus, X, Loader2, UserPlus, Send } from 'lucide-react';
import { supabase } from '../../../../lib/supabase';
import { useToast } from '../../../../contexts/ToastContext';
import { copyToClipboard } from '../../../../lib/clipboard';
import { getInvitationUrl } from '../../../instructor-portal/invitationUtils';
import StaffSearchModal, { type SelectedPerson } from '../../../../components/ui/StaffSearchModal';
import type { CurriculumStaffRole, InvitationRole } from '../../../../types/database';

interface StaffRow {
  id: string;
  role: CurriculumStaffRole;
  source: 'external' | 'internal' | 'manual';
  sourceId: string;
  name: string;
}

export interface StaffOption {
  id: string;
  name: string;
  organization?: string | null;
}

interface Props {
  curriculumId: string;
  /** STEP-CURRICULUM-INVITE-UPLOAD-FIX — 차시별 외부 강사 초대 INSERT용 */
  programId?: string;
  onChanged?: () => void;
  staffOptions?: StaffOption[];
}

const ROLES: CurriculumStaffRole[] = ['강사', '멘토', 'FT', 'TA'];

const ROLE_STYLE: Record<CurriculumStaffRole, string> = {
  강사:   'bg-violet-100 text-violet-700 border-violet-200',
  멘토:   'bg-orange-100 text-orange-700 border-orange-200',
  FT:     'bg-cyan-100 text-cyan-700 border-cyan-200',
  TA:     'bg-emerald-100 text-emerald-700 border-emerald-200',
  운영진: 'bg-slate-100 text-slate-700 border-slate-200',
};

const ROLE_TO_INVITATION: Record<CurriculumStaffRole, InvitationRole> = {
  강사:   'instructor',
  멘토:   'mentor',
  FT:     'facilitator',
  TA:     'ta',
  운영진: 'instructor',
};

type StaffJoin = {
  id: string;
  role: CurriculumStaffRole;
  staff_pool_id: string | null;
  profile_id: string | null;
  instructor_name_raw: string | null;
  staff_pool: { id: string; name: string } | { id: string; name: string }[] | null;
  profile:    { id: string; name: string } | { id: string; name: string }[] | null;
};

function pickOne<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? v[0] ?? null : v;
}

export default function CurriculumRowStaffSection({ curriculumId, programId, onChanged, staffOptions = [] }: Props) {
  const toast = useToast();
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickRole, setPickRole] = useState<CurriculumStaffRole>('강사');
  const [modalOpen, setModalOpen] = useState(false);
  // STEP-CURRICULUM-INVITE-UPLOAD-FIX — 직접 입력 인라인 모드
  const [manualOpen, setManualOpen] = useState(false);
  const [manualName, setManualName] = useState('');
  const [inviting, setInviting] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase.from('curriculum_staff')
      .select('id, role, staff_pool_id, profile_id, instructor_name_raw, staff_pool:staff_pool(id,name), profile:profiles(id,name)')
      .eq('curriculum_id', curriculumId);
    if (error) {
      console.error('[curriculum-staff-section] 조회 실패:', error.message);
      toast.error('배정 인력을 불러오지 못했어요.');
      setRows([]); return;
    }
    const next: StaffRow[] = ((data ?? []) as StaffJoin[]).map((s) => {
      const sp = pickOne(s.staff_pool);
      const pf = pickOne(s.profile);
      if (s.staff_pool_id) return { id: s.id, role: s.role, source: 'external', sourceId: s.staff_pool_id, name: sp?.name ?? '?' };
      if (s.profile_id)    return { id: s.id, role: s.role, source: 'internal', sourceId: s.profile_id,    name: pf?.name ?? '?' };
      return { id: s.id, role: s.role, source: 'manual', sourceId: '', name: s.instructor_name_raw ?? '?' };
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
    await refresh(); onChanged?.();
  }

  // STEP-CURRICULUM-INVITE-UPLOAD-FIX — 미등록 이름만 등록
  async function handleManualAdd() {
    const name = manualName.trim();
    if (!name) { toast.error('이름을 입력해 주세요.'); return; }
    const { error } = await supabase.from('curriculum_staff').insert({
      curriculum_id: curriculumId, role: pickRole,
      staff_pool_id: null, profile_id: null, instructor_name_raw: name,
    });
    if (error) {
      console.error('[curriculum-staff-section] 직접 입력 실패:', error.message);
      toast.error('등록에 실패했어요. 마이그레이션이 적용됐는지 확인해 주세요.');
      return;
    }
    toast.success(`${name}님을 ${pickRole}(미등록)로 등록했어요.`);
    setManualName(''); setManualOpen(false);
    await refresh(); onChanged?.();
  }

  async function handleRemove(row: StaffRow) {
    if (!window.confirm(`${row.name}님 배정을 해제할까요?`)) return;
    const { error } = await supabase.from('curriculum_staff').delete().eq('id', row.id);
    if (error) {
      console.error('[curriculum-staff-section] 삭제 실패:', error.message);
      toast.error('배정 해제에 실패했어요.'); return;
    }
    toast.success('배정을 해제했어요.');
    await refresh(); onChanged?.();
  }

  // STEP-CURRICULUM-INVITE-UPLOAD-FIX — 미등록 인력 → instructor_invitations INSERT + 링크 복사
  async function handleCreateInvite(row: StaffRow) {
    if (!programId) { toast.error('프로그램 정보가 없어요.'); return; }
    setInviting(row.id);
    try {
      const token = crypto.randomUUID().replace(/-/g, '');
      const { data, error } = await supabase.from('instructor_invitations').insert({
        program_id: programId,
        curriculum_id: curriculumId,
        name: row.name,
        role: ROLE_TO_INVITATION[row.role],
        status: '대기',
        portal_token: token,
        notes: `${row.role} 차시 초대 (미등록 인력 직접 등록)`,
        invited_at: new Date().toISOString(),
      }).select('portal_token').single();
      if (error || !data?.portal_token) {
        console.error('[curriculum-staff-section] 초대 생성 실패:', error?.message);
        toast.error('초대 링크 생성에 실패했어요.'); return;
      }
      const url = getInvitationUrl(data.portal_token);
      const ok = await copyToClipboard(url);
      toast.success(ok ? '초대 링크가 클립보드에 복사됐어요. 카카오톡·이메일로 전달하세요.' : `링크: ${url}`);
    } finally {
      setInviting(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-3 text-xs text-slate-400">
        <Loader2 size={12} className="animate-spin mr-1.5" /> 인력 불러오는 중…
      </div>
    );
  }

  const grouped = ROLES.map((role) => ({ role, list: rows.filter((r) => r.role === role) }))
    .filter((g) => g.list.length > 0);

  return (
    <div className="flex items-center gap-2 flex-wrap py-1">
      {grouped.length > 0 ? grouped.map(({ role, list }) => (
        <div key={role} className="inline-flex items-center gap-1 flex-wrap">
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border ${ROLE_STYLE[role]}`}>
            {role}
          </span>
          {list.map((r) => {
            const isManual = r.source === 'manual';
            return (
              <span key={r.id}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border ${isManual ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-white text-slate-700 border-slate-200'}`}>
                <span>{r.name}</span>
                <span className={`text-[9px] ${isManual ? 'text-rose-500' : 'text-slate-400'}`}>
                  {isManual ? '미등록' : r.source === 'external' ? '전문가' : '팀원'}
                </span>
                {isManual && (
                  <button type="button" onClick={() => void handleCreateInvite(r)} aria-label="초대 링크 생성"
                    title="초대 링크 생성·복사" disabled={inviting === r.id}
                    className="opacity-70 hover:opacity-100 text-violet-600 disabled:opacity-40">
                    {inviting === r.id ? <Loader2 size={10} className="animate-spin" aria-hidden="true" /> : <Send size={10} aria-hidden="true" />}
                  </button>
                )}
                <button type="button" onClick={() => void handleRemove(r)} aria-label="배정 해제"
                  className="ml-0.5 opacity-60 hover:opacity-100"><X size={9} aria-hidden="true" /></button>
              </span>
            );
          })}
        </div>
      )) : (
        <span className="text-[11px] text-slate-400 italic">배정된 인력이 없어요.</span>
      )}

      <div className="inline-flex items-center gap-1 ml-auto flex-wrap">
        <select value={pickRole} onChange={(e) => setPickRole(e.target.value as CurriculumStaffRole)}
          className="h-7 px-2 rounded-md border border-violet-200 bg-white text-[11px] font-semibold text-violet-700 focus:outline-none focus:border-violet-400">
          {ROLES.map((r) => (<option key={r} value={r}>{r}</option>))}
        </select>
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
        <button type="button" onClick={() => setManualOpen((v) => !v)}
          className="inline-flex items-center gap-0.5 h-7 px-2.5 rounded-md text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100">
          <UserPlus size={10} aria-hidden="true" /> 직접 입력
        </button>
      </div>

      {manualOpen && (
        <div className="flex items-center gap-1.5 w-full pt-1.5 border-t border-rose-100/70">
          <span className="text-[10px] text-slate-500 shrink-0">{pickRole}(미등록)</span>
          <input type="text" value={manualName} autoFocus
            onChange={(e) => setManualName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void handleManualAdd(); if (e.key === 'Escape') { setManualOpen(false); setManualName(''); } }}
            placeholder="이름 입력 후 Enter"
            className="h-7 flex-1 px-2 rounded-md border border-rose-200 bg-white text-xs focus:outline-none focus:border-rose-400" />
          <button type="button" onClick={() => void handleManualAdd()}
            className="h-7 px-2.5 rounded-md text-[11px] font-bold text-white bg-rose-500 hover:bg-rose-600">등록</button>
          <button type="button" onClick={() => { setManualOpen(false); setManualName(''); }}
            className="h-7 px-2 rounded-md text-[11px] text-slate-500 hover:bg-slate-100">취소</button>
        </div>
      )}

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
