// 지출결의서 목록 + 결재 — 박경수님 + SkyClaw STEP-PAYROLL-SYSTEM (2026-05-28)
// 작성자 = draft → submitted / 재무팀장 = submitted → approved | rejected / approved → paid

import { useCallback, useEffect, useState } from 'react';
import { Plus, Loader2, Receipt } from 'lucide-react';
import { Button } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { formatMoney } from '../../lib/utils';
import ExpenseClaimFormModal from './ExpenseClaimFormModal';

type ClaimStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'paid';

interface ClaimRow {
  id: string; claim_number: string | null; claim_date: string; purpose: string;
  total_amount: number; status: ClaimStatus; reject_reason: string | null;
  requester: { id: string; name: string } | null;
}

const STATUS_LABEL: Record<ClaimStatus, string> = { draft: '초안', submitted: '검토중', approved: '승인', rejected: '반려', paid: '지급완료' };
const STATUS_STYLE: Record<ClaimStatus, string> = {
  draft: 'bg-slate-50 text-slate-600 border-slate-200',
  submitted: 'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-rose-50 text-rose-700 border-rose-200',
  paid: 'bg-violet-50 text-violet-700 border-violet-200',
};

export default function ExpenseClaimTab() {
  const { user } = useAuth();
  const toast = useToast();
  const [rows, setRows] = useState<ClaimRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'mine'>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('expense_claims')
      .select('id, claim_number, claim_date, purpose, total_amount, status, reject_reason, requester:profiles!expense_claims_requester_id_fkey(id, name)')
      .is('deleted_at', null).order('claim_date', { ascending: false });
    if (filter === 'mine' && user) q = q.eq('requester_id', user.id);
    const { data, error } = await q;
    setLoading(false);
    if (error) { console.error('[ExpenseClaimTab] 조회 실패:', error.message); toast.error('결의서 조회 실패'); return; }
    setRows((data ?? []) as unknown as ClaimRow[]);
  }, [filter, user, toast]);

  useEffect(() => { void reload(); }, [reload]);

  async function transition(id: string, next: ClaimStatus, reason?: string) {
    const patch: Record<string, unknown> = { status: next };
    if (next === 'submitted') patch.submitted_at = new Date().toISOString();
    if (next === 'approved') patch.approved_at = new Date().toISOString();
    if (next === 'paid') patch.paid_at = new Date().toISOString();
    if (next === 'rejected') patch.reject_reason = reason ?? '';
    const { error } = await supabase.from('expense_claims').update(patch).eq('id', id);
    if (error) { console.error('[ExpenseClaimTab] 상태 변경 실패:', error.message); toast.error('상태 변경 실패'); return; }
    toast.success(`상태 → ${STATUS_LABEL[next]}`);
    void reload();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-bold text-slate-800 inline-flex items-center gap-1.5"><Receipt size={14} aria-hidden="true" />지출결의서 ({rows.length}건)</h3>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
            {(['all', 'mine'] as const).map((f) => (
              <button key={f} type="button" onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded-md text-xs font-semibold ${filter === f ? 'bg-violet-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
                {f === 'all' ? '전체' : '내 결의서'}
              </button>
            ))}
          </div>
          <Button variant="primary" size="sm" leftIcon={<Plus size={12} />} onClick={() => { setEditId(null); setFormOpen(true); }}>작성</Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10 text-xs text-slate-400"><Loader2 size={14} className="animate-spin mr-1.5" aria-hidden="true" /> 불러오는 중…</div>
      ) : rows.length === 0 ? (
        <p className="text-center py-8 text-xs text-slate-400">{filter === 'mine' ? '내가 작성한 결의서가 없어요.' : '등록된 결의서가 없어요.'}</p>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs">
              <tr>
                <th className="text-left px-3 py-2.5 font-semibold">번호</th>
                <th className="text-left px-3 py-2.5 font-semibold">작성자</th>
                <th className="text-left px-3 py-2.5 font-semibold">목적</th>
                <th className="text-right px-3 py-2.5 font-semibold">금액</th>
                <th className="text-center px-3 py-2.5 font-semibold">상태</th>
                <th className="text-left px-3 py-2.5 font-semibold">발의일</th>
                <th className="text-right px-3 py-2.5 font-semibold">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => {
                const isMine = user?.id === r.requester?.id;
                return (
                  <tr key={r.id} className="hover:bg-violet-50/40">
                    <td className="px-3 py-2 text-xs font-mono">{r.claim_number ?? '-'}</td>
                    <td className="px-3 py-2 text-xs">{r.requester?.name ?? '-'}</td>
                    <td className="px-3 py-2 text-sm">{r.purpose}{r.reject_reason && <div className="text-[10px] text-rose-600 mt-0.5">반려: {r.reject_reason}</div>}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatMoney(r.total_amount)}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-semibold ${STATUS_STYLE[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted">{r.claim_date}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {isMine && r.status === 'draft' && (<>
                        <button type="button" onClick={() => { setEditId(r.id); setFormOpen(true); }} className="text-xs text-violet-600 hover:underline mr-2">수정</button>
                        <button type="button" onClick={() => void transition(r.id, 'submitted')} className="text-xs text-emerald-600 hover:underline">제출</button>
                      </>)}
                      {!isMine && r.status === 'submitted' && (<>
                        <button type="button" onClick={() => void transition(r.id, 'approved')} className="text-xs text-emerald-600 hover:underline mr-2">승인</button>
                        <button type="button" onClick={() => { const reason = window.prompt('반려 사유'); if (reason) void transition(r.id, 'rejected', reason); }} className="text-xs text-rose-600 hover:underline">반려</button>
                      </>)}
                      {r.status === 'approved' && (
                        <button type="button" onClick={() => void transition(r.id, 'paid')} className="text-xs text-violet-600 hover:underline">지급완료</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ExpenseClaimFormModal open={formOpen} claimId={editId} onClose={() => { setFormOpen(false); setEditId(null); }} onSaved={() => void reload()} />
    </div>
  );
}
