// bal24 v2 — STEP-CONSORTIUM-REDESIGN (박경수님 2026-05-27)
// 컨소시엄 [참여사 관리] 탭 — 자사·지분율·정산 방향 + 모달 연동.

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, Pencil, Trash2, Users2, AlertTriangle } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../contexts/ToastContext';
import type { ConsortiumMember } from '../../../types/database';
import {
  getDirectionBadge, getRoleBadge, calcTotalShareRate,
  formatShareRate, formatBudget,
} from '../consortiumMemberUtils';
import ConsortiumMemberModal from '../modals/ConsortiumMemberModal';

interface Props {
  consortiumId: string;
  totalBudget: number | null | undefined;
}

const CARD_CLASS = 'bg-white rounded-2xl border border-violet-100 shadow-[0_4px_16px_rgba(124,58,237,0.06)] p-5';

export default function ConMembersTab({ consortiumId, totalBudget }: Props) {
  const toast = useToast();
  const [members, setMembers] = useState<ConsortiumMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalTarget, setModalTarget] = useState<ConsortiumMember | null | 'new'>(null);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('consortium_members')
      .select(`
        id, consortium_id, client_id, org_name, role,
        budget_ratio, budget_amount, share_rate, settlement_direction, is_self,
        responsibilities, access_token, created_at,
        clients:clients!consortium_members_client_id_fkey(id, name, is_own_company)
      `)
      .eq('consortium_id', consortiumId)
      .order('is_self', { ascending: false })
      .order('created_at', { ascending: true });
    setLoading(false);
    if (error) {
      console.error('[ConMembersTab] fetch:', error.message);
      toast.error('참여사 목록을 불러오지 못했어요.');
      return;
    }
    setMembers(((data ?? []) as unknown) as ConsortiumMember[]);
  }, [consortiumId, toast]);

  useEffect(() => { void fetchMembers(); }, [fetchMembers]);

  async function handleDelete(m: ConsortiumMember) {
    if (m.is_self) {
      toast.error('자사 행은 삭제할 수 없어요.');
      return;
    }
    if (!window.confirm(`"${m.org_name}" 참여사를 삭제할까요?`)) return;
    const { error } = await supabase.from('consortium_members').delete().eq('id', m.id);
    if (error) {
      console.error('[ConMembersTab] 삭제:', error.message);
      toast.error('삭제 중 오류가 발생했어요.');
      return;
    }
    toast.success('참여사를 삭제했어요.');
    void fetchMembers();
  }

  const totalShare = calcTotalShareRate(members);

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-violet-400" /></div>;
  }

  return (
    <div className="space-y-4">
      <section className={CARD_CLASS}>
        <header className="flex items-center justify-between gap-2 flex-wrap mb-3">
          <h2 className="text-base font-bold text-[#1E1B4B] inline-flex items-center gap-2">
            <Users2 size={16} className="text-violet-500" aria-hidden="true" />
            참여사 ({members.length}개)
          </h2>
          <button type="button" onClick={() => setModalTarget('new')}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-bold text-white bg-violet-600 hover:bg-violet-700">
            <Plus size={12} aria-hidden="true" /> 참여사 추가
          </button>
        </header>

        {members.length === 0 ? (
          <p className="text-sm text-slate-400 italic text-center py-6">아직 등록된 참여사가 없어요.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-violet-50/50 text-slate-500 text-xs">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold">참여사명</th>
                    <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">역할</th>
                    <th className="text-right px-3 py-2 font-semibold whitespace-nowrap">지분율</th>
                    <th className="text-right px-3 py-2 font-semibold whitespace-nowrap">예산 배정액</th>
                    <th className="text-center px-3 py-2 font-semibold whitespace-nowrap">정산 방향</th>
                    <th className="text-center px-3 py-2 font-semibold whitespace-nowrap">액션</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {members.map((m) => (
                    <tr key={m.id} className={m.is_self ? 'bg-violet-50/40' : 'hover:bg-violet-50/30'}>
                      <td className="px-3 py-2 text-sm font-medium text-slate-800">
                        <div className="inline-flex items-center gap-1.5">
                          {m.is_self && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 bg-teal-100 text-teal-700 rounded">자사</span>
                          )}
                          <span>{m.org_name || m.clients?.name || '-'}</span>
                        </div>
                        {m.responsibilities && (
                          <p className="text-[11px] text-slate-500 mt-0.5">{m.responsibilities}</p>
                        )}
                      </td>
                      <td className="px-3 py-2">{getRoleBadge(m.role ?? null, m.is_self)}</td>
                      <td className="px-3 py-2 text-right text-sm font-semibold text-violet-700 tabular-nums">
                        {formatShareRate(m.share_rate)}
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-slate-700 tabular-nums">
                        {formatBudget(m.budget_amount)}
                      </td>
                      <td className="px-3 py-2 text-center">{getDirectionBadge(m.settlement_direction)}</td>
                      <td className="px-3 py-2 text-center whitespace-nowrap">
                        <button type="button" onClick={() => setModalTarget(m)}
                          className="inline-flex items-center justify-center w-6 h-6 rounded text-slate-500 hover:bg-violet-100 hover:text-violet-700">
                          <Pencil size={11} aria-hidden="true" />
                        </button>
                        {!m.is_self && (
                          <button type="button" onClick={() => void handleDelete(m)}
                            className="inline-flex items-center justify-center w-6 h-6 rounded text-rose-500 hover:bg-rose-50 ml-1">
                            <Trash2 size={11} aria-hidden="true" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 지분율 합계 */}
            <div className={`mt-3 inline-flex items-center gap-1 text-sm font-bold ${
              totalShare === 100 ? 'text-emerald-600' : 'text-amber-600'
            }`}>
              {totalShare !== 100 && <AlertTriangle size={13} aria-hidden="true" />}
              지분율 합계 {formatShareRate(totalShare)}
              {totalShare !== 100 && ' — 100% 가 되어야 해요'}
            </div>
          </>
        )}
      </section>

      {modalTarget !== null && (
        <ConsortiumMemberModal
          open={true}
          consortiumId={consortiumId}
          totalBudget={totalBudget}
          member={modalTarget === 'new' ? null : modalTarget}
          onClose={() => setModalTarget(null)}
          onSaved={() => void fetchMembers()} />
      )}
    </div>
  );
}
