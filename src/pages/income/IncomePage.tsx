// bal24 v2 — 수입 목록 페이지
// ledger_type 자체(own) / 컨소시엄(consortium) 탭 분리

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Loader2, Search, TrendingUp } from 'lucide-react';
import { Button } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { formatDateKo, formatMoney } from '../../lib/utils';
import { findIncomeCode } from '../../utils/accounting';
import { BADGE_BASE, INCOME_STATUS_STYLE } from '../../utils/statusStyles';
import type { Income, LedgerType } from '../../types/database';
import IncomeFormModal from './IncomeFormModal';

type IncomeRow = Income & {
  client?: { id: string; name: string } | null;
  project?: { id: string; name: string } | null;
  consortium?: { id: string; name: string } | null;
};

const SELECT_COLUMNS =
  '*, client:clients(id,name), project:projects(id,name), consortium:consortiums(id,name)';


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

export default function IncomePage() {
  const [items, setItems] = useState<IncomeRow[]>([]);
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
        .from('income')
        .select(SELECT_COLUMNS)
        .is('deleted_at', null)
        .order('income_date', { ascending: false });
      if (error) throw error;
      setItems((data ?? []) as IncomeRow[]);
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[income] 조회 실패:', raw);
      setErrorMsg('수입 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
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
      const hay = [i.description, i.client?.name, i.project?.name, i.consortium?.name]
        .filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [items, ledger, search]);

  const total = useMemo(() => visible.reduce((s, i) => s + Number(i.amount || 0), 0), [visible]);

  return (
    <div className="space-y-5 max-w-[1400px]">
      <h1 className="text-2xl font-bold text-[#1E1B4B] flex items-center gap-2">
        <span aria-hidden="true">💰</span>
        수입
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
            placeholder="적요·고객사·프로젝트로 검색"
            className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted">합계</span>
          <span className="font-bold text-text">{formatMoney(total)}</span>
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
          <TrendingUp size={28} className="text-slate-300 mb-2" />
          <p className="text-sm text-muted mb-3">
            {search.trim() ? '검색 결과가 없어요.' : `${ledger === 'own' ? '자체' : '컨소시엄'} 수입이 아직 없어요.`}
          </p>
          {!search.trim() && (
            <Button variant="outline" size="sm" leftIcon={<Plus size={14} />} onClick={() => setModalOpen(true)}>
              첫 수입 등록하기
            </Button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs">
              <tr>
                <th className="text-left px-4 py-2.5 font-semibold">날짜</th>
                <th className="text-left px-4 py-2.5 font-semibold">계정과목</th>
                <th className="text-left px-4 py-2.5 font-semibold">적요</th>
                <th className="text-left px-4 py-2.5 font-semibold">고객사 / 프로젝트</th>
                <th className="text-right px-4 py-2.5 font-semibold">금액</th>
                <th className="text-center px-4 py-2.5 font-semibold">상태</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((i) => (
                <tr key={i.id} className="hover:bg-violet-50 transition-colors">
                  <td className="px-4 py-2.5 text-xs text-muted whitespace-nowrap">{formatDateKo(i.income_date)}</td>
                  <td className="px-4 py-2.5 text-xs">
                    <span className="text-slate-700 font-medium">
                      {findIncomeCode(i.account_code)?.label ?? i.account_code}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-text">{i.description}</td>
                  <td className="px-4 py-2.5 text-xs text-muted">
                    {[i.client?.name, ledger === 'own' ? i.project?.name : i.consortium?.name].filter(Boolean).join(' · ') || '–'}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold text-text whitespace-nowrap tabular-nums">{formatMoney(i.amount)}</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`${BADGE_BASE} ${INCOME_STATUS_STYLE[i.status]}`}>{i.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <IncomeFormModal
        open={modalOpen}
        ledgerType={ledger}
        onClose={() => setModalOpen(false)}
        onCreated={() => void fetchItems()}
      />
    </div>
  );
}
