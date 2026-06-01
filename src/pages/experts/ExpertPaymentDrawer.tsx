// 박경수님 2026-05-29 STEP-CLEANUP Phase 2 — 강사·멘토 지급 내역 드로어.
// payroll_expenses 에서 staff_pool_id 또는 payee_name 매칭하여 지급 이력 조회.

import { useEffect, useState } from 'react';
import { Loader2, X, CreditCard } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatMoney } from '../../lib/utils';
import type { StaffPool } from '../../types/database';

interface PaymentRow {
  id: string;
  payment_date: string | null;
  created_at: string;
  expense_type: string | null;
  payee_name: string | null;
  subtotal: number | null;
  net_amount: number | null;
  payment_status: string | null;
  program_id: string | null;
  // Supabase nested select 결과는 배열로 반환됨 (FK 1:1 이라도) → ProgramRef[]
  programs?: Array<{ id: string; name: string | null }> | { id: string; name: string | null } | null;
}

function getProgramName(p: PaymentRow): string {
  const pr = p.programs;
  if (!pr) return '-';
  if (Array.isArray(pr)) return pr[0]?.name ?? '-';
  return pr.name ?? '-';
}

interface Props {
  expert: StaffPool | null;
  onClose: () => void;
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  draft:      { label: '대기',   cls: 'bg-slate-100 text-slate-600' },
  submitted:  { label: '대기',   cls: 'bg-slate-100 text-slate-600' },
  received:   { label: '대기',   cls: 'bg-amber-100 text-amber-700' },
  processing: { label: '처리중', cls: 'bg-blue-100 text-blue-700' },
  paid:       { label: '완료',   cls: 'bg-emerald-100 text-emerald-700' },
  cancelled:  { label: '반려',   cls: 'bg-rose-100 text-rose-700' },
  rejected:   { label: '반려',   cls: 'bg-rose-100 text-rose-700' },
};

function fmtDate(s: string | null): string {
  if (!s) return '-';
  const d = new Date(s);
  if (isNaN(d.getTime())) return '-';
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}/${mm}/${dd}`;
}

export default function ExpertPaymentDrawer({ expert, onClose }: Props) {
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!expert) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      // staff_pool_id 매칭 우선, 폴백으로 이름 ILIKE 매칭.
      const { data: byId, error: e1 } = await supabase
        .from('payroll_expenses')
        .select('id, payment_date, created_at, expense_type, payee_name, subtotal, net_amount, payment_status, program_id, programs(id, name)')
        .eq('staff_pool_id', expert.id)
        .order('payment_date', { ascending: false, nullsFirst: false });
      if (e1) console.error('[ExpertPaymentDrawer] staff_pool_id 조회 실패:', e1.message);

      let merged = ((byId ?? []) as unknown) as PaymentRow[];
      // 이름 매칭 폴백 — staff_pool_id 가 NULL 인 옛 행 보강.
      if (expert.name) {
        const { data: byName, error: e2 } = await supabase
          .from('payroll_expenses')
          .select('id, payment_date, created_at, expense_type, payee_name, subtotal, net_amount, payment_status, program_id, programs(id, name)')
          .is('staff_pool_id', null)
          .ilike('payee_name', `%${expert.name}%`)
          .order('payment_date', { ascending: false, nullsFirst: false });
        if (e2) console.warn('[ExpertPaymentDrawer] 이름 폴백 조회 경고:', e2.message);
        const seen = new Set(merged.map((r) => r.id));
        (((byName ?? []) as unknown) as PaymentRow[]).forEach((r) => { if (!seen.has(r.id)) merged.push(r); });
      }
      if (cancelled) return;
      setRows(merged);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [expert]);

  if (!expert) return null;

  const totalGross = rows.reduce((s, r) => s + (Number(r.subtotal) || 0), 0);
  const totalNet   = rows.reduce((s, r) => s + (Number(r.net_amount) || 0), 0);
  const paidCount  = rows.filter((r) => r.payment_status === 'paid').length;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} aria-hidden="true" />
      <div className="relative ml-auto w-full max-w-2xl bg-white h-full overflow-y-auto">
        <header className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-lg font-bold text-[#1E1B4B] inline-flex items-center gap-2">
              <CreditCard size={18} className="text-violet-600" aria-hidden="true" />
              {expert.name} — 지급 내역
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">총 {rows.length}건 · 완료 {paidCount}건</p>
          </div>
          <button type="button" onClick={onClose} aria-label="닫기"
            className="p-1.5 rounded hover:bg-slate-100">
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 size={20} className="animate-spin text-violet-400" aria-hidden="true" />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">
            아직 지급 내역이 없어요.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto p-4">
              <table className="w-full text-xs">
                <thead className="bg-violet-50/40 text-slate-500">
                  <tr>
                    <th className="text-left px-2 py-2 font-semibold whitespace-nowrap">지급일</th>
                    <th className="text-left px-2 py-2 font-semibold">사업명</th>
                    <th className="text-left px-2 py-2 font-semibold">항목</th>
                    <th className="text-right px-2 py-2 font-semibold whitespace-nowrap">총액</th>
                    <th className="text-right px-2 py-2 font-semibold whitespace-nowrap">실수령</th>
                    <th className="text-center px-2 py-2 font-semibold whitespace-nowrap">상태</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r) => {
                    const badge = STATUS_BADGE[r.payment_status ?? 'draft'] ?? STATUS_BADGE.draft;
                    return (
                      <tr key={r.id} className="hover:bg-violet-50/30">
                        <td className="px-2 py-1.5 text-slate-600 tabular-nums whitespace-nowrap">
                          {fmtDate(r.payment_date ?? r.created_at)}
                        </td>
                        <td className="px-2 py-1.5 text-slate-700 truncate max-w-[160px]">
                          {getProgramName(r)}
                        </td>
                        <td className="px-2 py-1.5 text-slate-600 truncate max-w-[120px]">
                          {r.expense_type ?? '-'}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums">
                          {r.subtotal != null ? formatMoney(Number(r.subtotal)) : '-'}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums font-semibold text-[#1E1B4B]">
                          {r.net_amount != null ? formatMoney(Number(r.net_amount)) : '-'}
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <span className={`inline-flex text-[10px] font-bold px-1.5 py-0.5 rounded ${badge.cls}`}>
                            {badge.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <footer className="sticky bottom-0 bg-white border-t border-slate-100 px-6 py-3 flex items-center justify-between text-sm">
              <span className="text-slate-500">합계 (총 {rows.length}건)</span>
              <div className="flex items-center gap-4 tabular-nums">
                <span className="text-slate-500 text-xs">총액 <strong className="text-slate-700">{formatMoney(totalGross)}</strong></span>
                <span className="text-xs">실수령 <strong className="text-violet-700 text-base">{formatMoney(totalNet)}</strong></span>
              </div>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
