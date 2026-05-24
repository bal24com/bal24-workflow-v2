// 외주/급여 메인 페이지 — 외주 / 운영·급여 2탭 + 필터 + Excel import
// STEP-ACCOUNTING-ALL P3

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Loader2, Search, Users, Upload } from 'lucide-react';
import { Button } from '../../components/ui';
import { useToast } from '../../contexts/ToastContext';
import { formatDateKo, formatMoney } from '../../lib/utils';
import EmptyState from '../../components/EmptyState';
import { supabase } from '../../lib/supabase';
import type { PayrollPaymentStatus } from '../../types/database';
import {
  fetchPayroll, softDeletePayroll, calcPayrollSummary, maskIdNo,
  PAYROLL_STATUS_VALUES, PAYROLL_STATUS_STYLE,
  type PayrollRow,
} from './payrollUtils';
import PayrollSummaryBar from './PayrollSummaryBar';
import PayrollExpenseFormModal from './PayrollExpenseFormModal';
import PayrollImportModal from './PayrollImportModal';

type MainTab = 'outsource' | 'operation';

interface ProjectOption { id: string; name: string }

export default function PayrollPage() {
  const toast = useToast();
  const [tab, setTab] = useState<MainTab>('outsource');
  const [items, setItems] = useState<PayrollRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<ProjectOption[]>([]);

  const [projectFilter, setProjectFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<PayrollPaymentStatus | 'all'>('all');
  const [monthFilter, setMonthFilter] = useState('');
  const [search, setSearch] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<PayrollRow | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchPayroll({
        group: tab, // 'outsource' | 'operation' — prefix 매칭으로 자유 카테고리도 포함
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
  }, [tab, projectFilter, statusFilter, monthFilter, toast]);

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

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) =>
      [i.payee_name, i.description, i.project?.name, i.bank_name, i.memo]
        .filter(Boolean).join(' ').toLowerCase().includes(q),
    );
  }, [items, search]);

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

      {/* 메인 탭 */}
      <nav role="tablist" aria-label="외주/운영 탭" className="flex items-center gap-1 border-b border-slate-200">
        {([
          { key: 'outsource' as MainTab, label: '외주 (강사료·촬영·기타)' },
          { key: 'operation' as MainTab, label: '운영·급여' },
        ]).map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                active ? 'text-primary border-primary' : 'text-slate-500 border-transparent hover:text-text'
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </nav>

      {/* 필터 + 신규 등록 + 일괄 등록 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center sm:gap-2 flex-wrap">
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="h-9 rounded-lg border border-slate-200 px-2.5 text-xs"
            aria-label="프로젝트 필터"
          >
            <option value="">전체 프로젝트</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as PayrollPaymentStatus | 'all')}
            className="h-9 rounded-lg border border-slate-200 px-2.5 text-xs"
            aria-label="지급상태 필터"
          >
            <option value="all">전체 상태</option>
            {PAYROLL_STATUS_VALUES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <input
            type="month"
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="h-9 rounded-lg border border-slate-200 px-2.5 text-xs"
            aria-label="지급월 필터"
          />
        </div>
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

      {/* 합계 바 */}
      <PayrollSummaryBar summary={summary} />

      {/* 목록 */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-sm text-muted">
          <Loader2 size={18} className="animate-spin mr-2" />
          불러오는 중...
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          emoji="👷"
          title={search.trim() ? '검색 결과가 없어요.' : tab === 'outsource' ? '외주 내역이 아직 없어요.' : '운영·급여 내역이 아직 없어요.'}
          description="신규 등록 또는 일괄 등록(Excel) 으로 추가해 보세요."
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs">
              <tr>
                <th className="text-left px-3 py-2.5 font-semibold whitespace-nowrap">지급일</th>
                <th className="text-left px-3 py-2.5 font-semibold">성명/내용</th>
                <th className="text-left px-3 py-2.5 font-semibold">프로젝트</th>
                <th className="text-center px-3 py-2.5 font-semibold whitespace-nowrap">구분</th>
                <th className="text-right px-3 py-2.5 font-semibold whitespace-nowrap">단가×회수</th>
                <th className="text-right px-3 py-2.5 font-semibold whitespace-nowrap">원천세</th>
                <th className="text-right px-3 py-2.5 font-semibold whitespace-nowrap">실지급</th>
                <th className="text-center px-3 py-2.5 font-semibold whitespace-nowrap">상태</th>
                <th className="text-center px-3 py-2.5 font-semibold whitespace-nowrap">증빙</th>
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
                    <td className="px-3 py-2 text-center text-xs">{r.expense_type}</td>
                    <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                      <div className="text-xs text-muted">{r.unit_price.toLocaleString()}×{r.quantity}</div>
                      <div className="text-sm font-bold text-text">{formatMoney(r.subtotal)}</div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap text-xs">
                      {r.tax_amount > 0 ? (
                        <>
                          <div className="text-rose-600 font-semibold">-{formatMoney(r.tax_amount)}</div>
                          <div className="text-[10px] text-muted">{r.tax_rate_type}</div>
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
      )}

      {/* 모달 */}
      <PayrollExpenseFormModal
        open={formOpen}
        target={editTarget}
        defaultType={tab === 'outsource' ? '강사료' : '운영비'}
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
