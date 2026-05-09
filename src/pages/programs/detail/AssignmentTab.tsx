// bal24 v2 — 프로그램 담당사 배정 탭 (STEP-PROGRAM-ASSIGNMENT)
// PM/ADMIN 만 진입 (호출자가 분기). 컨소시엄 미연결 시 안내문구.
// lead 1명 제약은 UI 레이어에서 검증 (toast 경고 + 거부).

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Crown, Loader2, Plus, Trash2, Users2, AlertTriangle } from 'lucide-react';
import { Button } from '../../../components/ui';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import EmptyState from '../../../components/EmptyState';
import {
  ASSIGNMENT_ROLE_LABEL, ASSIGNMENT_ROLE_BADGE,
  flattenAssignment, isLeadAvailable, pickOne,
  type AssignmentDisplay, type AssignmentRow,
} from '../programAssignmentUtils';
import type { AssignmentRole } from '../../../types/database';

interface Props {
  programId: string;
  consortiumId: string | null | undefined;
  isPM: boolean;
}

interface MemberOption {
  id: string;
  name: string;
}

interface RawMember {
  id: string;
  clients: { id: string; name: string } | { id: string; name: string }[] | null;
}

export default function AssignmentTab({ programId, consortiumId, isPM }: Props) {
  const { user } = useAuth();
  const toast = useToast();
  const [assignments, setAssignments] = useState<AssignmentDisplay[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [newMemberId, setNewMemberId] = useState('');
  const [newRole, setNewRole] = useState<AssignmentRole>('support');
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // 컨소시엄 참여사 + 배정 목록 동시 fetch
  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [aRes, mRes] = await Promise.all([
      supabase
        .from('program_assignments')
        .select('*, clients!consortium_members_client_id_fkey(id, name)')
        .eq('program_id', programId)
        .order('role', { ascending: true }),
      consortiumId
        ? supabase
            .from('consortium_members')
            .select('id, clients!consortium_members_client_id_fkey(id, name)')
            .eq('consortium_id', consortiumId)
            .order('created_at', { ascending: true })
        : Promise.resolve({ data: [], error: null } as const),
    ]);

    if (aRes.error) {
      console.error('[assignment] 배정 조회 실패:', aRes.error.message);
      toast.error('배정 정보를 불러오지 못했어요.');
      setAssignments([]);
    } else {
      // join 행이 직접 clients 를 들고 옴 — flattenAssignment 호환을 위해 매핑
      const rows = (aRes.data as unknown as Array<AssignmentRow & {
        clients: { id: string; name: string } | { id: string; name: string }[] | null;
      }> | null) ?? [];
      setAssignments(rows.map((r) => flattenAssignment(r)));
    }

    if (mRes.error) {
      console.error('[assignment] 참여사 조회 실패:', mRes.error.message);
    } else if (mRes.data) {
      const rows = (mRes.data as unknown as RawMember[]) ?? [];
      setMembers(
        rows.map((m) => {
          const c = pickOne(m.clients);
          return { id: m.id, name: c?.name ?? '미지정' };
        }),
      );
    }
    setLoading(false);
  }, [programId, consortiumId, toast]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await fetchAll();
      if (cancelled) return;
    })();
    return () => { cancelled = true; };
  }, [fetchAll]);

  const availableMembers = useMemo(() => {
    const assigned = new Set(assignments.map((a) => a.consortium_member_id));
    return members.filter((m) => !assigned.has(m.id));
  }, [members, assignments]);

  async function handleAdd() {
    if (!newMemberId) {
      toast.error('참여사를 선택해 주세요.');
      return;
    }
    if (!isLeadAvailable(assignments, newRole)) {
      toast.error('주담당은 1명만 배정할 수 있어요. 기존 주담당을 먼저 변경해 주세요.');
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from('program_assignments').insert({
        program_id: programId,
        consortium_member_id: newMemberId,
        role: newRole,
        created_by: user?.id ?? null,
      });
      if (error) {
        console.error('[assignment] 배정 추가 실패:', error.message);
        toast.error('배정 추가 중 오류가 발생했어요.');
        return;
      }
      toast.success('담당사를 배정했어요.');
      setAddOpen(false);
      setNewMemberId('');
      setNewRole('support');
      await fetchAll();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('이 배정을 삭제할까요?')) return;
    setDeletingId(id);
    try {
      const { error } = await supabase.from('program_assignments').delete().eq('id', id);
      if (error) {
        console.error('[assignment] 배정 삭제 실패:', error.message);
        toast.error('배정 삭제 중 오류가 발생했어요.');
        return;
      }
      toast.success('배정을 삭제했어요.');
      await fetchAll();
    } finally {
      setDeletingId(null);
    }
  }

  // 컨소시엄 미연결 안내
  if (!consortiumId) {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50/50 p-6 flex items-start gap-3">
        <AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
        <div>
          <p className="text-sm font-bold text-amber-900">컨소시엄에 연결되지 않은 프로그램이에요</p>
          <p className="mt-1 text-xs text-amber-800 leading-relaxed">
            담당사 배정은 컨소시엄으로 운영하는 프로그램에서만 의미 있어요.
            먼저 프로그램 정보에서 컨소시엄을 연결해 주세요.
          </p>
        </div>
      </section>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="animate-spin text-violet-400" size={20} aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <Users2 size={14} className="text-violet-500" aria-hidden="true" />
          참여사별 담당 배정 ({assignments.length}건)
        </div>
        {isPM && (
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus size={14} />}
            onClick={() => setAddOpen((v) => !v)}
            disabled={availableMembers.length === 0}
          >
            {addOpen ? '취소' : '배정 추가'}
          </Button>
        )}
      </header>

      {/* 추가 폼 */}
      {isPM && addOpen && (
        <div className="rounded-2xl border border-violet-100 bg-violet-50/30 p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-semibold text-slate-700">참여사</label>
              <select
                value={newMemberId}
                onChange={(e) => setNewMemberId(e.target.value)}
                disabled={submitting}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
              >
                <option value="">선택해 주세요</option>
                {availableMembers.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">역할</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as AssignmentRole)}
                disabled={submitting}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
              >
                <option value="support">{ASSIGNMENT_ROLE_LABEL.support}</option>
                <option value="lead">{ASSIGNMENT_ROLE_LABEL.lead}</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end">
            <Button variant="primary" size="sm" onClick={() => void handleAdd()} loading={submitting}>
              저장
            </Button>
          </div>
        </div>
      )}

      {/* 배정 목록 */}
      {assignments.length === 0 ? (
        <EmptyState
          emoji="👥"
          title="아직 배정된 참여사가 없어요"
          description={isPM ? '"배정 추가" 버튼으로 시작해 보세요.' : '담당자가 곧 배정해 줄 거예요.'}
        />
      ) : (
        <ul className="space-y-2">
          {assignments.map((a) => (
            <li
              key={a.id}
              className="flex items-center gap-3 rounded-2xl border border-violet-100 bg-white px-4 py-3"
            >
              <span className={`shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md border ${ASSIGNMENT_ROLE_BADGE[a.role]}`}>
                {a.role === 'lead' && <Crown size={10} aria-hidden="true" />}
                {ASSIGNMENT_ROLE_LABEL[a.role]}
              </span>
              <span className="flex-1 min-w-0 text-sm font-bold text-[#1E1B4B] truncate">
                {a.client_name}
              </span>
              <span className="shrink-0 text-[10px] text-slate-400 hidden sm:flex items-center gap-2">
                {a.can_manage_participants && <span>참여자✓</span>}
                {a.can_manage_files && <span>파일✓</span>}
                {a.can_view_finance && <span>재무✓</span>}
              </span>
              {isPM && (
                <button
                  type="button"
                  onClick={() => void handleDelete(a.id)}
                  disabled={deletingId === a.id}
                  className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                  aria-label="배정 삭제"
                >
                  {deletingId === a.id
                    ? <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                    : <Trash2 size={14} aria-hidden="true" />}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {!isPM && (
        <p className="text-[11px] text-slate-400 italic">
          💡 배정 변경은 PM/ADMIN 만 가능해요.
        </p>
      )}
    </div>
  );
}
