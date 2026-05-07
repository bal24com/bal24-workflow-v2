// bal24 v2 — 지출 목록 페이지
// ledger_type 자체(own) / 컨소시엄(consortium) 탭 분리, 원천징수 컬럼 표기

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Loader2, Search, TrendingDown } from 'lucide-react';
import { Button } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { formatDateKo, formatMoney } from '../../lib/utils';
import {
  findExpenseCode,
  findWithholdingOption,
} from '../../utils/accounting';
import { BADGE_BASE, EXPENSE_STATUS_STYLE } from '../../utils/statusStyles';
import type { Expense, LedgerType } from '../../types/database';
import ExpenseFormModal from './ExpenseFormModal';

type ExpenseRow = Expense & {
  payee?: { id: string; name: string } | null;
  project?: { id: string; name: string } | null;
  consortium?: { id: string; name: string } | null;
};

// expenses → profiles FK 두 개(created_by, paid_by)라 명시 필요한 자리는 없지만,
// payee:clients는 단일 FK라 단축형 안전.
const SELECT_COLUMNS =
  '*, payee:clients(id,name), project:projects(id,name), consortium:consortiums(id,name)';

function LedgerTabs({ value, onChange, counts }: {
  value: LedgerType;
  onChange: (v: LedgerType) => void;
  counts: { own: number; consortium: number };
}) {
  const tabs: { key: LedgerType; label: string }[] = [
    { key: 'own', label: '자체' },
    { key: 'consortium', label: '컨소시엄' },
  ];
  return (
    <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5" role="tablist" aria-label="정산 탭">
      {tabs.map((t) => {
        const active = value === t.key;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.key)}
            className={['inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-semibold transition-colors',
              active ? 'bg-primary text-white' : 'text-slate-600 hover:bg-slate-50'].join(' ')}
          >
            {t.label}
            <span className={['inline-flex items-center justify-center min-w-[1.25rem] px-1 rounded text-[10px]',
              active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'].join(' ')}>
              {counts[t.key]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default function ExpensesPage() {
  const [items, setItems] = useState<ExpenseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [ledger, setLedger] = useState<LedgerType>('own');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select(SELECT_COLUMNS)
        .is('deleted_at', null)
        .order('expense_date', { ascending: false });
      if (error) throw error;
      setItems((data ?? []) as ExpenseRow[]);
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[expenses] 조회 실패:', raw);
      setErrorMsg('지출 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchItems(); }, [fetchItems]);

  const counts = useMemo(() => ({
    own: items.filter((i) => i.ledger_type === 'own').length,
    consortium: items.filter((i) => i.ledger_type === 'consortium').length,
  }), [items]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((i) => {
      if (i.ledger_type !== ledger) return false;
      if (!q) return true;
      const hay = [i.description, i.payee?.name, i.project?.name, i.consortium?.name]
        .filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [items, ledger, search]);

  const totals = useMemo(() => {
    const gross = visible.reduce((s, i) => s + Number(i.gross_amount || 0), 0);
    const net = visible.reduce((s, i) => s + Number(i.net_amount || 0), 0);
    const withholding = visible.reduce((s, i) => s + Number(i.withholding_amount || 0), 0);
    return { gross, net, withholding };
  }, [visible]);

  return (
    <div className="space-y-5 max-w-[1400px]">
      <h1 className="text-2xl font-bold text-[#1E1B4B] flex items-center gap-2">
        <span aria-hidden="true">💸</span>
        지출
      </h1>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <LedgerTabs value={ledger} onChange={setLedger} counts={counts} />
        <Button variant="primary" leftIcon={<Plus size={16} />} onClick={() => setModalOpen(true)}>신규 등록</Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="적요·지급처·프로젝트로 검색"
            className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div className="flex items-center gap-3 text-xs text-muted">
          <span>지급액 <span className="text-text font-bold">{formatMoney(totals.gross)}</span></span>
          <span>· 원천징수 <span className="text-danger font-bold">{formatMoney(totals.withholding)}</span></span>
          <span>· 실지급 <span className="text-primary font-bold">{formatMoney(totals.net)}</span></span>
        </div>
      </div>

      {errorMsg && (
        <div role="alert" className="rounded-xl bg-danger/10 border border-danger/20 px-4 py-3 text-sm text-danger">{errorMsg}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-sm text-muted">
          <Loader2 size={18} className="animate-spin mr-2" />
          불러오는 중…
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-white rounded-xl border border-dashed border-slate-200">
          <TrendingDown size={28} className="text-slate-300 mb-2" />
          <p className="text-sm text-muted mb-3">
            {search.trim() ? '검색 결과가 없어요.' : `${ledger === 'own' ? '자체' : '컨소시엄'} 지출이 아직 없어요.`}
          </p>
          {!search.trim() && (
            <Button variant="outline" size="sm" leftIcon={<Plus size={14} />} onClick={() => setModalOpen(true)}>
              첫 지출 등록하기
            </Button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs">
              <tr>
                <th className="text-left px-4 py-2.5 font-semibold whitespace-nowrap">날짜</th>
                <th className="text-left px-4 py-2.5 font-semibold">계정과목</th>
                <th className="text-left px-4 py-2.5 font-semibold">적요</th>
                <th className="text-left px-4 py-2.5 font-semibold">지급처</th>
                <th className="text-right px-4 py-2.5 font-semibold whitespace-nowrap">지급액</th>
                <th className="text-right px-4 py-2.5 font-semibold whitespace-nowrap">원천징수</th>
                <th className="text-right px-4 py-2.5 font-semibold whitespace-nowrap">실지급</th>
                <th className="text-center px-4 py-2.5 font-semibold">상태</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((i) => {
                const wh = findWithholdingOption(i.withholding_type);
                return (
                  <tr key={i.id} className="hover:bg-violet-50 transition-colors">
                    <td className="px-4 py-2.5 text-xs text-muted whitespace-nowrap">{formatDateKo(i.expense_date)}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-700 font-medium">{findExpenseCode(i.account_code)?.label ?? i.account_code}</td>
                    <td className="px-4 py-2.5 text-text">{i.description}</td>
                    <td className="px-4 py-2.5 text-xs text-muted">
                      {[i.payee?.name, ledger === 'own' ? i.project?.name : i.consortium?.name].filter(Boolean).join(' · ') || '–'}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold text-text whitespace-nowrap tabular-nums">{formatMoney(i.gross_amount)}</td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      {Number(i.withholding_amount) > 0 ? (
                        <div className="text-xs">
                          <div className="text-danger font-semibold tabular-nums">- {formatMoney(i.withholding_amount)}</div>
                          <div className="text-[10px] text-muted">{wh.label}</div>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">없음</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right font-bold text-primary whitespace-nowrap tabular-nums">{formatMoney(i.net_amount)}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`${BADGE_BASE} ${EXPENSE_STATUS_STYLE[i.status]}`}>{i.status}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ExpenseFormModal
        open={modalOpen}
        ledgerType={ledger}
        onClose={() => setModalOpen(false)}
        onCreated={() => void fetchItems()}
      />
    </div>
  );
}
