// 박경수님 2026-05-29 STEP-CLEANUP Phase 2 — 컨소시엄 지분·정산 탭.
// consortium_members 지분율 + income_contracts 계약금액 → 참여사별 수입·지급액 자동 계산.

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Calculator, AlertTriangle } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { formatMoney } from '../../../lib/utils';
import { isReverseConsortium } from '../consortiumMembersUtils';

interface MemberRow {
  id: string;
  client_id: string | null;
  org_name: string | null;
  role: string | null;
  budget_ratio: number | null;
  share_rate: number | null;
  is_self: boolean | null;
  responsibilities: string | null;
  settlement_direction: string | null;
}

interface Props {
  consortiumId: string;
  totalBudget: number | null | undefined;
}

export default function ConEquityTab({ consortiumId, totalBudget }: Props) {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [contractTotal, setContractTotal] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const [mRes, cRes] = await Promise.all([
        supabase.from('consortium_members')
          .select('id, client_id, org_name, role, budget_ratio, share_rate, is_self, responsibilities, settlement_direction')
          .eq('consortium_id', consortiumId)
          .order('is_self', { ascending: false })
          .order('created_at'),
        supabase.from('income_contracts')
          .select('contract_amount')
          .eq('consortium_id', consortiumId),
      ]);
      if (cancelled) return;
      if (mRes.error) console.error('[ConEquityTab] members 조회:', mRes.error.message);
      if (cRes.error) console.warn('[ConEquityTab] contracts 조회 경고:', cRes.error.message);
      setMembers((mRes.data ?? []) as MemberRow[]);
      const sum = ((cRes.data ?? []) as Array<{ contract_amount: number | null }>)
        .reduce((s, r) => s + (Number(r.contract_amount) || 0), 0);
      setContractTotal(sum);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [consortiumId]);

  const reverse = useMemo(
    () => isReverseConsortium(members.map((m) => ({ is_self: m.is_self, role: m.role }))),
    [members],
  );

  // 정산 기준 금액 — income_contracts 합계 우선, 없으면 컨소시엄 total_budget.
  const baseAmount = contractTotal > 0 ? contractTotal : Number(totalBudget ?? 0);
  // 지분율 합계
  const ratioSum = members.reduce((s, m) => s + Number(m.share_rate ?? m.budget_ratio ?? 0), 0);

  function ratioOf(m: MemberRow): number {
    return Number(m.share_rate ?? m.budget_ratio ?? 0);
  }

  function amountOf(m: MemberRow): number {
    if (baseAmount <= 0) return 0;
    return Math.round(baseAmount * ratioOf(m) / 100);
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 size={20} className="animate-spin text-violet-400" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 역방향 안내 */}
      {reverse && (
        <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-800 leading-relaxed">
          <p className="font-bold mb-1 inline-flex items-center gap-1.5">
            <AlertTriangle size={14} aria-hidden="true" /> 역방향 컨소시엄
          </p>
          <p>
            밸런스닷(자사)이 <strong>참여사</strong> 위치예요. 외부 운영사로부터 자사 지분율 만큼 수령하는 구조.
            아래 표의 "정산 금액" 은 자사 행에 한해 <strong>수입 금액</strong>, 그 외 참여사는 외부 운영사 기준 분배 금액.
          </p>
        </div>
      )}

      {/* 정산 요약 */}
      <section className="rounded-2xl border border-violet-100 bg-white p-5 space-y-3">
        <h3 className="text-sm font-bold text-[#1E1B4B] inline-flex items-center gap-1.5">
          <Calculator size={16} className="text-violet-500" aria-hidden="true" />
          정산 요약
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <SummaryTile label="계약 합계 (실제)" value={formatMoney(contractTotal)} note={contractTotal > 0 ? 'income_contracts' : '미등록'} />
          <SummaryTile label="컨소시엄 예산 (가설)" value={formatMoney(Number(totalBudget ?? 0))} note="총사업비" />
          <SummaryTile label="지분율 합계" value={`${ratioSum.toFixed(1)}%`}
            note={Math.abs(ratioSum - 100) < 0.1 ? '100% ✅' : '합계 ≠ 100% ⚠️'}
            warn={Math.abs(ratioSum - 100) >= 0.1} />
        </div>
        <p className="text-[11px] text-slate-400">
          정산 금액은 <strong>계약 합계</strong> 기준 계산. 미등록 시 컨소시엄 예산 기준 가설치 표시.
        </p>
      </section>

      {/* 참여사 표 */}
      <section className="rounded-2xl border border-violet-100 bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-violet-50/40 text-slate-500 text-xs">
            <tr>
              <th className="text-left px-3 py-2 font-semibold">참여사</th>
              <th className="text-left px-3 py-2 font-semibold">역할</th>
              <th className="text-right px-3 py-2 font-semibold whitespace-nowrap">지분율</th>
              <th className="text-right px-3 py-2 font-semibold whitespace-nowrap">정산 금액</th>
              <th className="text-left px-3 py-2 font-semibold">담당 업무</th>
              <th className="text-center px-3 py-2 font-semibold whitespace-nowrap">방향</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {members.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-400 italic">등록된 참여사가 없어요.</td></tr>
            ) : members.map((m) => (
              <tr key={m.id} className={m.is_self ? 'bg-blue-50/40' : 'hover:bg-violet-50/30'}>
                <td className="px-3 py-2">
                  <span className="font-bold text-[#1E1B4B] inline-flex items-center gap-1.5">
                    {m.is_self && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 border border-blue-200">자사</span>
                    )}
                    {m.org_name ?? '미지정'}
                  </span>
                </td>
                <td className="px-3 py-2 text-slate-600">{m.role ?? '-'}</td>
                <td className="px-3 py-2 text-right tabular-nums font-semibold">
                  {ratioOf(m).toFixed(1)}%
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-violet-700 font-bold">
                  {formatMoney(amountOf(m))}
                </td>
                <td className="px-3 py-2 text-slate-500 truncate max-w-[200px]">{m.responsibilities ?? '-'}</td>
                <td className="px-3 py-2 text-center">
                  {m.settlement_direction === 'inbound' ? (
                    <span className="text-[10px] font-bold text-emerald-700">수령</span>
                  ) : m.settlement_direction === 'outbound' ? (
                    <span className="text-[10px] font-bold text-orange-700">지급</span>
                  ) : (
                    <span className="text-[10px] text-slate-400">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function SummaryTile({ label, value, note, warn }: { label: string; value: string; note?: string; warn?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${warn ? 'border-amber-200 bg-amber-50/40' : 'border-violet-100 bg-violet-50/30'}`}>
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</p>
      <p className={`text-lg font-bold tabular-nums mt-1 ${warn ? 'text-amber-700' : 'text-[#1E1B4B]'}`}>{value}</p>
      {note && <p className={`text-[10px] mt-0.5 ${warn ? 'text-amber-600' : 'text-slate-400'}`}>{note}</p>}
    </div>
  );
}
