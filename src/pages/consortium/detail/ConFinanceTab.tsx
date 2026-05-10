// bal24 v2 — 컨소시엄 탭4: 재무 (격리 — ledger_type='consortium' + consortium_id 이중 필터)
// 내부 탭 3개: 수입 | 지출 | 증빙

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, TrendingUp, TrendingDown, Receipt as ReceiptIcon, ExternalLink } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../contexts/ToastContext';
import { BADGE_BASE } from '../../../utils/statusStyles';
import { findIncomeCode, findExpenseCode } from '../../../utils/accounting';
import { buildMemberBudgets, formatKRW, formatConDate } from '../consortiumUtils';
import { MEMBER_TYPE_LABEL, MEMBER_TYPE_STYLE, type ConsortiumMember, type MemberType } from '../consortiumTypes';

interface Props {
  consortiumId: string;
  totalBudget: number;
  members: ConsortiumMember[];
}

type InnerTab = 'income' | 'expense' | 'receipt';

interface IncomeRow {
  id: string;
  income_date: string | null;
  account_code: string;
  amount: number | string;
  description: string | null;
  client: { id: string; name: string } | null;
}

interface ExpenseRow {
  id: string;
  expense_date: string;
  account_code: string;
  description: string | null;
  gross_amount: number | string;
  withholding_amount: number | string | null;
  net_amount: number | string | null;
  payee: { id: string; name: string } | null;
}

interface ReceiptRow {
  id: string;
  receipt_type: string;
  file_url: string | null;
  file_name: string | null;
  expense_id: string | null;
  created_at: string;
}

const INCOME_SELECT = '*, client:clients(id, name)';
const EXPENSE_SELECT = '*, payee:clients(id, name)';

export default function ConFinanceTab({ consortiumId, totalBudget, members }: Props) {
  const toast = useToast();
  const [tab, setTab] = useState<InnerTab>('income');
  const [income, setIncome] = useState<IncomeRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [incRes, expRes] = await Promise.all([
        supabase
          .from('income')
          .select(INCOME_SELECT)
          .eq('ledger_type', 'consortium')
          .eq('consortium_id', consortiumId)
          .is('deleted_at', null)
          .order('income_date', { ascending: false, nullsFirst: false }),
        supabase
          .from('expenses')
          .select(EXPENSE_SELECT)
          .eq('ledger_type', 'consortium')
          .eq('consortium_id', consortiumId)
          .is('deleted_at', null)
          .order('expense_date', { ascending: false }),
      ]);
      if (incRes.error) console.error('[con-finance] 수입 조회 실패:', incRes.error.message);
      if (expRes.error) console.error('[con-finance] 지출 조회 실패:', expRes.error.message);
      setIncome((incRes.data as unknown as IncomeRow[] | null) ?? []);
      const expList = (expRes.data as unknown as ExpenseRow[] | null) ?? [];
      setExpenses(expList);

      // receipts: 컨소시엄 지출에 연결된 것만
      const expIds = expList.map((e) => e.id);
      if (expIds.length > 0) {
        const { data: rcp, error: rcpErr } = await supabase
          .from('receipts')
          .select('*')
          .in('expense_id', expIds)
          .is('deleted_at', null)
          .order('created_at', { ascending: false });
        if (rcpErr) console.error('[con-finance] 증빙 조회 실패:', rcpErr.message);
        setReceipts((rcp as ReceiptRow[] | null) ?? []);
      } else {
        setReceipts([]);
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[con-finance] 데이터 로드 실패:', raw);
      toast.error('재무 데이터를 불러오지 못했어요.');
    } finally {
      setLoading(false);
    }
  }, [consortiumId, toast]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await fetchAll();
      if (cancelled) return;
    })();
    return () => { cancelled = true; };
  }, [fetchAll]);

  const budgets = useMemo(() => buildMemberBudgets(members), [members]);
  const totalExpense = useMemo(
    () => expenses.reduce((s, e) => s + Number(e.gross_amount ?? 0), 0),
    [expenses],
  );
  const totalIncome = useMemo(
    () => income.reduce((s, e) => s + Number(e.amount ?? 0), 0),
    [income],
  );

  return (
    <div className="space-y-4">
      {/* 참여사 예산 집행 요약 (상단 고정) */}
      {budgets.length > 0 && (
        <section className="rounded-2xl border border-violet-100 bg-violet-50/30 p-3 shadow-[0_4px_16px_rgba(124,58,237,0.06)]">
          <div className="text-xs font-bold text-slate-500 mb-2">참여사 예산 집행 (수행과업 지분율) — 총사업비 {formatKRW(totalBudget)}</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {budgets.map((b) => {
              const warn = b.executionRate > 90;
              return (
                <div key={b.clientId} className="rounded-xl border border-violet-100 bg-white p-2 text-xs">
                  <div className="flex items-center gap-1 mb-0.5">
                    <span className={`text-[10px] font-semibold px-1 py-0.5 rounded ${MEMBER_TYPE_STYLE[b.memberType as MemberType]}`}>
                      {MEMBER_TYPE_LABEL[b.memberType as MemberType]}
                    </span>
                    <span className="font-bold text-[#1E1B4B] truncate">{b.clientName}</span>
                  </div>
                  <div className="text-slate-500">배분 {formatKRW(b.allocatedBudget)}</div>
                  <div className={`font-bold ${warn ? 'text-rose-600' : 'text-violet-700'}`}>
                    집행 {formatKRW(b.spentAmount)} ({b.executionRate}%)
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 내부 탭 */}
      <nav role="tablist" className="flex items-center gap-1 border-b border-slate-200" aria-label="재무 탭">
        {[
          { key: 'income' as InnerTab, label: '수입', Icon: TrendingUp, count: income.length },
          { key: 'expense' as InnerTab, label: '지출', Icon: TrendingDown, count: expenses.length },
          { key: 'receipt' as InnerTab, label: '증빙', Icon: ReceiptIcon, count: receipts.length },
        ].map((t) => {
          const Icon = t.Icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
                active ? 'text-violet-700 border-violet-600' : 'text-slate-500 border-transparent hover:text-slate-700'
              }`}
            >
              <Icon size={14} aria-hidden="true" />
              {t.label}
              <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">{t.count}</span>
            </button>
          );
        })}
      </nav>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-violet-400" size={24} aria-hidden="true" />
        </div>
      ) : tab === 'income' ? (
        <div className="bg-white rounded-2xl border border-violet-100 overflow-x-auto">
          <div className="px-4 py-2 text-xs text-slate-500 bg-violet-50/40 border-b border-slate-100">
            합계: <span className="font-bold text-violet-700">{formatKRW(totalIncome)}</span>
          </div>
          {income.length === 0 ? (
            <p className="text-sm text-slate-400 italic text-center py-8">등록된 수입이 없어요.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50/40 text-slate-500 text-xs">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold">날짜</th>
                  <th className="text-left px-3 py-2 font-semibold">계정과목</th>
                  <th className="text-left px-3 py-2 font-semibold">주관기관</th>
                  <th className="text-right px-3 py-2 font-semibold">금액</th>
                  <th className="text-left px-3 py-2 font-semibold">비고</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {income.map((i) => (
                  <tr key={i.id} className="hover:bg-violet-50/40">
                    <td className="px-3 py-2 text-xs text-muted whitespace-nowrap">{formatConDate(i.income_date)}</td>
                    <td className="px-3 py-2 text-xs">{findIncomeCode(i.account_code)?.label ?? i.account_code}</td>
                    <td className="px-3 py-2 text-xs">{i.client?.name ?? '-'}</td>
                    <td className="px-3 py-2 text-right font-bold tabular-nums text-violet-700">{formatKRW(Number(i.amount))}</td>
                    <td className="px-3 py-2 text-xs text-slate-600 truncate max-w-[260px]">{i.description ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : tab === 'expense' ? (
        <div className="bg-white rounded-2xl border border-violet-100 overflow-x-auto">
          <div className="px-4 py-2 text-xs text-slate-500 bg-violet-50/40 border-b border-slate-100">
            합계: <span className="font-bold text-orange-700">{formatKRW(totalExpense)}</span>
          </div>
          {expenses.length === 0 ? (
            <p className="text-sm text-slate-400 italic text-center py-8">등록된 지출이 없어요.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50/40 text-slate-500 text-xs">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold">날짜</th>
                  <th className="text-left px-3 py-2 font-semibold">계정과목</th>
                  <th className="text-left px-3 py-2 font-semibold">참여사</th>
                  <th className="text-right px-3 py-2 font-semibold">금액</th>
                  <th className="text-right px-3 py-2 font-semibold">원천세</th>
                  <th className="text-right px-3 py-2 font-semibold">실수령액</th>
                  <th className="text-left px-3 py-2 font-semibold">비고</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {expenses.map((e) => (
                  <tr key={e.id} className="hover:bg-violet-50/40">
                    <td className="px-3 py-2 text-xs text-muted whitespace-nowrap">{formatConDate(e.expense_date)}</td>
                    <td className="px-3 py-2 text-xs">{findExpenseCode(e.account_code)?.label ?? e.account_code}</td>
                    <td className="px-3 py-2 text-xs">{e.payee?.name ?? '-'}</td>
                    <td className="px-3 py-2 text-right font-bold tabular-nums text-orange-700">{formatKRW(Number(e.gross_amount))}</td>
                    <td className="px-3 py-2 text-right text-xs tabular-nums text-rose-600">
                      {Number(e.withholding_amount ?? 0) > 0 ? `-${formatKRW(Number(e.withholding_amount))}` : '-'}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-violet-700">{formatKRW(Number(e.net_amount ?? e.gross_amount))}</td>
                    <td className="px-3 py-2 text-xs text-slate-600 truncate max-w-[200px]">{e.description ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-violet-100 overflow-hidden">
          <div className="px-4 py-2 text-xs text-slate-500 bg-violet-50/40 border-b border-slate-100">
            컨소시엄 지출 연결 증빙 (총 {receipts.length}건) — 신규 등록은 지출 페이지에서
          </div>
          {receipts.length === 0 ? (
            <p className="text-sm text-slate-400 italic text-center py-8">등록된 증빙이 없어요.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {receipts.map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className={`${BADGE_BASE} bg-violet-50 text-violet-700 border-violet-200 shrink-0`}>{r.receipt_type}</span>
                  <span className="flex-1 text-sm text-slate-700 truncate">{r.file_name ?? '파일 없음'}</span>
                  <span className="text-xs text-slate-400">{formatConDate(r.created_at)}</span>
                  {r.file_url && (
                    <a href={r.file_url} target="_blank" rel="noopener noreferrer" className="text-violet-600 hover:underline inline-flex items-center gap-1 text-xs">
                      <ExternalLink size={12} aria-hidden="true" />
                      열기
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
