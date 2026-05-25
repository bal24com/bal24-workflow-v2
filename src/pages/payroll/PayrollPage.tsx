// 외주/급여 메인 페이지 — 외주 / 운영·급여 2탭 + 필터 + Excel import
// STEP-ACCOUNTING-ALL P3

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Loader2, Search, Users, Upload, ArrowUp, ArrowDown, ArrowUpDown, Filter } from 'lucide-react';
import { Button } from '../../components/ui';
import { useToast } from '../../contexts/ToastContext';
import { formatDateKo, formatMoney } from '../../lib/utils';
import EmptyState from '../../components/EmptyState';
import { supabase } from '../../lib/supabase';
import type { PayrollPaymentStatus } from '../../types/database';
import {
  fetchPayroll, softDeletePayroll, calcPayrollSummary, maskIdNo,
  isOutsourceType, isOperationType,
  PAYROLL_STATUS_VALUES, PAYROLL_STATUS_STYLE,
  type PayrollRow,
} from './payrollUtils';
import PayrollSummaryBar from './PayrollSummaryBar';
import PayrollExpenseFormModal from './PayrollExpenseFormModal';
import PayrollImportModal from './PayrollImportModal';
import PayrollStatsPanel from './PayrollStatsPanel';

// 박경수님 요청 — 외주/운영 메인 탭 제거, [통계][지출] 2탭으로 재구성
type MainTab = 'stats' | 'list';
type SortKey = 'paid_at' | 'payee_name' | 'project' | 'expense_type' | 'subtotal' | 'tax_amount' | 'net_amount' | 'payment_status' | 'receipt';
type SortDir = 'asc' | 'desc';

interface ProjectOption { id: string; name: string }

export default function PayrollPage() {
  const toast = useToast();
  const [tab, setTab] = useState<MainTab>('stats');
  const [items, setItems] = useState<PayrollRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<ProjectOption[]>([]);

  const [projectFilter, setProjectFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<PayrollPaymentStatus | 'all'>('all');
  const [monthFilter, setMonthFilter] = useState('');
  const [search, setSearch] = useState('');
  // 박경수님 요청 — 항목별 정렬 + 구분(expense_type) 필터
  const [typeFilter, setTypeFilter] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('paid_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(k); setSortDir('asc'); }
  }
  // 박경수님 요청 — 필터 콤보 안 활성 개수
  const activeFilterCount = [projectFilter, statusFilter !== 'all' ? statusFilter : '', monthFilter, typeFilter].filter(Boolean).length;
  function resetFilters() { setProjectFilter(''); setStatusFilter('all'); setMonthFilter(''); setTypeFilter(''); }

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<PayrollRow | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      // 박경수님 요청 — 외주+운영 통합. group='all' 로 모든 row fetch.
      const rows = await fetchPayroll({
        group: 'all',
        projectId: projectFilter || undefined,
        status: statusFilter,
        month: monthFilter || undefined,
      });
      setItems(rows);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      console.error('[PayrollPage] 조회 오류:', msg);
      toast.error(msg || '외주/급여 목록을 불러오는 중 오류가 발생했어요.');
    } finally {
      setLoading(false);
    }
  }, [projectFilter, statusFilter, monthFilter, toast]);

  useEffect(() => { void reload(); }, [reload]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from('projects').select('id, name').is('deleted_at', null)
        .order('created_at', { ascending: false });
      if (cancelled) return;
      if (error) { console.error('[PayrollPage] 프로젝트 옵션 조회 실패:', error.message); return; }
      setProjects((data as ProjectOption[] | null) ?? []);
    })();
    return () => { cancelled = true; };
  }, []);

  // 구분(expense_type) 옵션 — 현재 탭에 등장하는 값들
  const typeOptions = useMemo(
    () => Array.from(new Set(items.map((i) => i.expense_type))).sort(),
    [items],
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    let arr = q
      ? items.filter((i) => [i.payee_name, i.description, i.project?.name, i.bank_name, i.memo]
          .filter(Boolean).join(' ').toLowerCase().includes(q))
      : items;
    if (typeFilter) arr = arr.filter((i) => i.expense_type === typeFilter);
    const dir = sortDir === 'asc' ? 1 : -1;
    const sorted = [...arr].sort((a, b) => {
      switch (sortKey) {
        case 'paid_at':        return ((a.paid_at ?? '') < (b.paid_at ?? '') ? -1 : (a.paid_at ?? '') > (b.paid_at ?? '') ? 1 : 0) * dir;
        case 'payee_name':     return (a.payee_name ?? '').localeCompare(b.payee_name ?? '', 'ko') * dir;
        case 'project':        return (a.project?.name ?? '').localeCompare(b.project?.name ?? '', 'ko') * dir;
        case 'expense_type':   return (a.expense_type ?? '').localeCompare(b.expense_type ?? '', 'ko') * dir;
        case 'subtotal':       return (Number(a.subtotal ?? 0) - Number(b.subtotal ?? 0)) * dir;
        case 'tax_amount':     return (Number(a.tax_amount ?? 0) - Number(b.tax_amount ?? 0)) * dir;
        case 'net_amount':     return (Number(a.net_amount ?? 0) - Number(b.net_amount ?? 0)) * dir;
        case 'payment_status': return (a.payment_status ?? '').localeCompare(b.payment_status ?? '', 'ko') * dir;
        case 'receipt':        return ((a.receipt_urls?.length ?? 0) - (b.receipt_urls?.length ?? 0)) * dir;
        default: return 0;
      }
    });
    return sorted;
  }, [items, search, typeFilter, sortKey, sortDir]);

  const summary = useMemo(() => calcPayrollSummary(visible), [visible]);

  async function handleDelete(row: PayrollRow) {
    if (!window.confirm(`"${row.payee_name}" 항목을 휴지통으로 보낼까요?`)) return;
    const err = await softDeletePayroll(row.id);
    if (err) { toast.error(err); return; }
    toast.success('삭제했어요.');
    void reload();
  }

  return (
    <div className="space-y-5 max-w-[1400px]">
      <h1 className="text-2xl font-bold text-[#1E1B4B] flex items-center gap-2">
        <Users size={22} aria-hidden="true" />
        외주/급여
      </h1>

      {/* 메인 탭 — 박경수님 요청: [통계][지출] 2탭 */}
      <nav role="tablist" aria-label="외주/급여 탭" className="flex items-center gap-1 border-b border-slate-200">
        {([
          { key: 'stats' as MainTab, label: '📊 통계' },
          { key: 'list'  as MainTab, label: `📋 지출 (${items.length})` },
        ]).map((t) => {
          const active = tab === t.key;
          return (
            <button key={t.key} type="button" role="tab" aria-selected={active} onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                active ? 'text-primary border-primary' : 'text-slate-500 border-transparent hover:text-text'
              }`}>{t.label}</button>
          );
        })}
      </nav>

      {/* 필터 콤보 + 신규/일괄 등록 — 박경수님 요청: 필터는 한 콤보 안에 묶음 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <details className="relative">
          <summary className="cursor-pointer list-none inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50">
            <Filter size={12} aria-hidden="true" />
            필터{activeFilterCount > 0 && <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-violet-600 text-white text-[10px]">{activeFilterCount}</span>}
          </summary>
          <div className="absolute z-20 mt-1 left-0 p-3 bg-white border border-slate-200 rounded-xl shadow-lg space-y-2 min-w-[280px]">
            <FilterRow label="프로젝트">
              <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} className="w-full h-8 rounded-md border border-slate-200 px-2 text-xs">
                <option value="">전체</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </FilterRow>
            <FilterRow label="상태">
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as PayrollPaymentStatus | 'all')} className="w-full h-8 rounded-md border border-slate-200 px-2 text-xs">
                <option value="all">전체</option>
                {PAYROLL_STATUS_VALUES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </FilterRow>
            <FilterRow label="지급월">
              <input type="month" value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} className="w-full h-8 rounded-md border border-slate-200 px-2 text-xs" />
            </FilterRow>
            <FilterRow label="구분">
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="w-full h-8 rounded-md border border-slate-200 px-2 text-xs">
                <option value="">전체</option>
                {typeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </FilterRow>
            {activeFilterCount > 0 && (
              <button type="button" onClick={resetFilters} className="w-full text-[11px] text-rose-600 hover:underline pt-1">필터 초기화</button>
            )}
          </div>
        </details>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" leftIcon={<Upload size={14} />} onClick={() => setImportOpen(true)}>일괄 등록</Button>
          <Button variant="primary" leftIcon={<Plus size={16} />} onClick={() => { setEditTarget(null); setFormOpen(true); }}>신규 등록</Button>
        </div>
      </div>

      {/* 검색 */}
      <div className="relative w-full sm:max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="성명·내용·프로젝트로 검색"
          className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {/* 합계 바 — 양 탭 공용 */}
      <PayrollSummaryBar summary={summary} />

      {/* 통계 탭 — 카테고리·프로젝트별 합계 */}
      {tab === 'stats' && !loading && (
        <PayrollStatsPanel rows={visible} />
      )}

      {/* 지출 탭 — 외주+운영 통합 목록 */}
      {tab === 'list' && (loading ? (
        <div className="flex items-center justify-center py-16 text-sm text-muted">
          <Loader2 size={18} className="animate-spin mr-2" />
          불러오는 중...
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          emoji="👷"
          title={search.trim() || activeFilterCount > 0 ? '조건에 맞는 내역이 없어요.' : '아직 등록된 외주/급여 내역이 없어요.'}
          description="신규 등록 또는 일괄 등록(Excel) 으로 추가해 보세요."
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs">
              <tr>
                <SortableTh k="paid_at"        sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="left">지급일</SortableTh>
                <SortableTh k="payee_name"     sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="left">성명/내용</SortableTh>
                <SortableTh k="project"        sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="left">프로젝트</SortableTh>
                <SortableTh k="expense_type"   sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="center">구분</SortableTh>
                <SortableTh k="subtotal"       sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right">단가×회수</SortableTh>
                <SortableTh k="tax_amount"     sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right">세액 (원천/부가)</SortableTh>
                <SortableTh k="net_amount"     sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right">실지급</SortableTh>
                <SortableTh k="payment_status" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="center">상태</SortableTh>
                <SortableTh k="receipt"        sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="center">증빙</SortableTh>
                <th className="text-right px-3 py-2.5 font-semibold whitespace-nowrap">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((r) => {
                const hasReceipt = (r.receipt_urls?.length ?? 0) > 0;
                const needReceipt = !hasReceipt && r.expense_type !== '운영인건비';
                return (
                  <tr key={r.id} className="hover:bg-violet-50/40">
                    <td className="px-3 py-2 text-xs text-muted whitespace-nowrap">{r.paid_at ? formatDateKo(r.paid_at) : '-'}</td>
                    <td className="px-3 py-2">
                      <div className="text-sm font-medium text-text">{r.payee_name}</div>
                      <div className="text-[11px] text-muted truncate max-w-[260px]">{r.description ?? ''}{r.payee_id_no && ` · ${maskIdNo(r.payee_id_no)}`}</div>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted">{r.project?.name ?? '-'}</td>
                    <td className="px-3 py-2 text-center text-xs">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border mr-1 ${
                        isOutsourceType(r.expense_type) ? 'bg-cyan-50 text-cyan-700 border-cyan-200'
                        : isOperationType(r.expense_type) ? 'bg-orange-50 text-orange-700 border-orange-200'
                        : 'bg-slate-50 text-slate-600 border-slate-200'
                      }`}>{isOutsourceType(r.expense_type) ? '인건비' : isOperationType(r.expense_type) ? '운영비' : '기타'}</span>
                      {r.expense_type}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                      <div className="text-xs text-muted">{r.unit_price.toLocaleString()}×{r.quantity}</div>
                      <div className="text-sm font-bold text-text">{formatMoney(r.subtotal)}</div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap text-xs">
                      {r.tax_amount > 0 ? (
                        <>
                          <div className={`font-semibold ${r.tax_rate_type === '10' ? 'text-blue-600' : 'text-rose-600'}`}>
                            {r.tax_rate_type === '10' ? '+' : '-'}{formatMoney(r.tax_amount)}
                          </div>
                          <div className="text-[10px] text-muted">{r.tax_rate_type === '10' ? '부가세 10%' : `원천 ${r.tax_rate_type}`}</div>
                        </>
                      ) : <span className="text-slate-400">없음</span>}
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-violet-700 tabular-nums whitespace-nowrap">{formatMoney(r.net_amount)}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-semibold ${PAYROLL_STATUS_STYLE[r.payment_status]}`}>{r.payment_status}</span>
                    </td>
                    <td className="px-3 py-2 text-center text-[11px]">
                      {hasReceipt
                        ? <span className="text-emerald-600 font-bold">{r.receipt_urls.length}</span>
                        : needReceipt
                          ? <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-600 font-bold">증빙없음</span>
                          : <span className="text-slate-400">-</span>}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <button type="button" onClick={() => { setEditTarget(r); setFormOpen(true); }} className="text-xs text-violet-600 hover:underline mr-2">수정</button>
                      <button type="button" onClick={() => void handleDelete(r)} className="text-xs text-rose-600 hover:underline">삭제</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}

      {/* 모달 — 신규는 강사료 기본, 수정은 기존 expense_type 유지 (모달 내부 로직) */}
      <PayrollExpenseFormModal
        open={formOpen}
        target={editTarget}
        defaultType="강사료"
        onClose={() => { setFormOpen(false); setEditTarget(null); }}
        onSaved={() => { setFormOpen(false); setEditTarget(null); void reload(); }}
      />
      <PayrollImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => { setImportOpen(false); void reload(); }}
      />
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-semibold text-slate-500 w-14 shrink-0">{label}</span>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function SortableTh({ k, sortKey, sortDir, onClick, align, children }: {
  k: SortKey; sortKey: SortKey; sortDir: SortDir; onClick: (k: SortKey) => void;
  align: 'left' | 'center' | 'right'; children: React.ReactNode;
}) {
  const active = sortKey === k;
  const alignClass = align === 'left' ? 'text-left' : align === 'right' ? 'text-right' : 'text-center';
  const justifyClass = align === 'left' ? 'justify-start' : align === 'right' ? 'justify-end' : 'justify-center';
  return (
    <th className={`${alignClass} px-3 py-2.5 font-semibold whitespace-nowrap`}>
      <button type="button" onClick={() => onClick(k)}
        className={`inline-flex items-center gap-1 w-full ${justifyClass} hover:text-violet-700 ${active ? 'text-violet-700' : ''}`}>
        {children}
        {active
          ? (sortDir === 'asc' ? <ArrowUp size={10} aria-hidden="true" /> : <ArrowDown size={10} aria-hidden="true" />)
          : <ArrowUpDown size={10} aria-hidden="true" className="opacity-30" />}
      </button>
    </th>
  );
}
