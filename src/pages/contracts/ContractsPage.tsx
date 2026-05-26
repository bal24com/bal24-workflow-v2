// 수입/계약 목록 페이지 — STEP-ACCOUNTING-ALL P2
// 상태 필터 + 검색 + KPI + 행 클릭 → 우측 상세 패널

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Loader2, Search, FileText } from 'lucide-react';
import { Button } from '../../components/ui';
import { useToast } from '../../contexts/ToastContext';
import { formatDateKo, formatMoney } from '../../lib/utils';
import EmptyState from '../../components/EmptyState';
import type { ContractStatus } from '../../types/database';
import {
  fetchContracts,
  billingProgressLabel,
  calcContractKpis,
  CONTRACT_STATUS_VALUES,
  CONTRACT_STATUS_STYLE,
  CONTRACT_STATUS_LABEL,
  LIFECYCLE_LABEL,
  LIFECYCLE_STYLE,
  type ContractRow,
} from './contractUtils';
import ContractFormModal from './ContractFormModal';
import ContractDetailDrawer from './ContractDetailDrawer';

type Filter = 'all' | ContractStatus;
type LifeFilter = 'all' | 'proposal' | 'contract' | 'operation' | 'closing';

export default function ContractsPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const [items, setItems] = useState<ContractRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [lifeFilter, setLifeFilter] = useState<LifeFilter>('all'); // STEP-CONTRACT-AUTO
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ContractRow | null>(null);
  const [detailTarget, setDetailTarget] = useState<ContractRow | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchContracts();
      setItems(rows);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      console.error('[ContractsPage] 조회 오류:', msg);
      toast.error(msg || '계약 목록을 불러오는 중 오류가 발생했어요.');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { void reload(); }, [reload]);

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: items.length, draft: 0, 진행중: 0, 완료: 0, 취소: 0, 보류: 0 };
    for (const i of items) c[i.status] = (c[i.status] ?? 0) + 1;
    return c;
  }, [items]);

  // STEP-CONTRACT-AUTO — lifecycle 단계별 카운트
  const lifeCounts = useMemo(() => {
    const c: Record<LifeFilter, number> = { all: items.length, proposal: 0, contract: 0, operation: 0, closing: 0 };
    for (const i of items) {
      const s = i.lifecycle_stage ?? 'proposal';
      if (s in c) c[s as LifeFilter] = (c[s as LifeFilter] ?? 0) + 1;
    }
    return c;
  }, [items]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((i) => {
      if (filter !== 'all' && i.status !== filter) return false;
      if (lifeFilter !== 'all' && (i.lifecycle_stage ?? 'proposal') !== lifeFilter) return false;
      if (!q) return true;
      const hay = [i.contract_name, i.client?.name, i.project?.name, i.memo]
        .filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [items, filter, lifeFilter, search]);

  const kpis = useMemo(() => calcContractKpis(items), [items]);

  function handleAdd() {
    setEditTarget(null);
    setFormOpen(true);
  }

  function handleEdit(row: ContractRow) {
    setDetailTarget(null);
    setEditTarget(row);
    setFormOpen(true);
  }

  function handleRowClick(row: ContractRow) {
    setDetailTarget(row);
  }

  return (
    <div className="space-y-5 max-w-[1400px]">
      <h1 className="text-2xl font-bold text-[#1E1B4B] flex items-center gap-2">
        <FileText size={22} aria-hidden="true" />
        수입/계약
      </h1>

      {/* KPI 3종 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-violet-100 bg-white p-4 shadow-[0_4px_16px_rgba(124,58,237,0.06)]">
          <div className="text-xs text-slate-500 font-semibold">진행중 계약 총액</div>
          <div className="mt-1 text-xl font-bold text-violet-700 tabular-nums">{formatMoney(kpis.inProgressTotal)}</div>
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-[0_4px_16px_rgba(16,185,129,0.06)]">
          <div className="text-xs text-slate-500 font-semibold">완료 계약</div>
          <div className="mt-1 text-xl font-bold text-emerald-700 tabular-nums">{kpis.completedCount}건</div>
        </div>
        <div className="rounded-2xl border border-rose-100 bg-white p-4 shadow-[0_4px_16px_rgba(244,63,94,0.06)]">
          <div className="text-xs text-slate-500 font-semibold">미입금</div>
          <div className="mt-1 text-xl font-bold text-rose-700 tabular-nums">{kpis.notDepositedCount}건</div>
        </div>
      </div>

      {/* STEP-CONTRACT-AUTO — lifecycle 5탭 (견적·제안 / 계약 / 운영 / 종료) */}
      <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="라이프사이클 탭">
        {(['all', 'proposal', 'contract', 'operation', 'closing'] as LifeFilter[]).map((s) => {
          const active = lifeFilter === s;
          const label = s === 'all' ? '전체' : LIFECYCLE_LABEL[s];
          return (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setLifeFilter(s)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                active ? 'bg-primary text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {label}
              <span className={`inline-flex items-center justify-center min-w-[1.25rem] px-1 rounded text-[10px] ${
                active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
              }`}>{lifeCounts[s] ?? 0}</span>
            </button>
          );
        })}
      </div>

      {/* 상태 필터 + 신규 등록 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5" role="tablist" aria-label="상태 필터">
          {(['all', ...CONTRACT_STATUS_VALUES] as Filter[]).map((f) => {
            const active = filter === f;
            const label = f === 'all' ? '전체' : CONTRACT_STATUS_LABEL[f as ContractStatus] ?? f;
            return (
              <button
                key={String(f)}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(f)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  active ? 'bg-primary text-white' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {label}
                <span className={`inline-flex items-center justify-center min-w-[1.25rem] px-1 rounded text-[10px] ${
                  active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                }`}>{counts[f] ?? 0}</span>
              </button>
            );
          })}
        </div>
        <Button variant="primary" leftIcon={<Plus size={16} />} onClick={handleAdd}>신규 계약</Button>
      </div>

      {/* 검색 */}
      <div className="relative w-full sm:max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="계약명·주관기관·프로젝트로 검색"
          className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {/* 목록 */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-sm text-muted">
          <Loader2 size={18} className="animate-spin mr-2" />
          불러오는 중...
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          emoji="📄"
          title={search.trim() || filter !== 'all' ? '조건에 맞는 계약이 없어요.' : '등록된 계약이 아직 없어요.'}
          description={!search.trim() && filter === 'all' ? '첫 계약을 등록해 보세요.' : undefined}
          action={
            !search.trim() && filter === 'all' && (
              <Button variant="primary" leftIcon={<Plus size={14} />} onClick={handleAdd}>
                + 계약 등록
              </Button>
            )
          }
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs">
              <tr>
                <th className="text-left px-4 py-2.5 font-semibold">계약명</th>
                <th className="text-center px-4 py-2.5 font-semibold whitespace-nowrap">단계</th>
                <th className="text-left px-4 py-2.5 font-semibold">주관기관</th>
                <th className="text-left px-4 py-2.5 font-semibold">프로젝트</th>
                <th className="text-right px-4 py-2.5 font-semibold whitespace-nowrap">계약금액</th>
                <th className="text-left px-4 py-2.5 font-semibold whitespace-nowrap">청구 진행</th>
                <th className="text-center px-4 py-2.5 font-semibold whitespace-nowrap">상태</th>
                <th className="text-center px-4 py-2.5 font-semibold whitespace-nowrap">입금</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((c) => {
                const life = c.lifecycle_stage ?? 'proposal';
                const docPending = c.doc_request_pending && !c.contract_file_url;
                return (
                <tr
                  key={c.id}
                  className="hover:bg-violet-50 transition-colors cursor-pointer"
                  onClick={() => handleRowClick(c)}
                >
                  <td className="px-4 py-2.5 text-text font-medium">
                    {c.auto_created && <span className="text-[10px] text-slate-400 mr-1 align-middle">[자동]</span>}
                    {c.contract_name}
                    {docPending && (
                      <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-100 text-rose-600 align-middle">
                        계약서류 미업로드
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold whitespace-nowrap ${LIFECYCLE_STYLE[life]}`}>
                      {LIFECYCLE_LABEL[life]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted">{c.client?.name ?? '-'}</td>
                  {/* PART A — 프로젝트 셀 클릭 시 /projects/:id 로 이동. project_id null 이면 - 표시. */}
                  <td className="px-4 py-2.5 text-xs">
                    {c.project_id && c.project?.name ? (
                      <button type="button"
                        onClick={(e) => { e.stopPropagation(); navigate(`/projects/${c.project_id}`); }}
                        className="text-violet-600 hover:underline font-medium">
                        {c.project.name} →
                      </button>
                    ) : <span className="text-muted">-</span>}
                  </td>
                  {/* 박경수님 + SkyClaw STEP-INCOME-CONTRACT-FIX — contract_amount=0 일 때 project.budget fallback */}
                  <td className="px-4 py-2.5 text-right font-bold tabular-nums whitespace-nowrap">
                    {(c.contract_amount ?? 0) > 0
                      ? <span className="text-text">{formatMoney(c.contract_amount)}</span>
                      : (c.project?.budget ?? 0) > 0
                        ? <span className="text-amber-600">{formatMoney(c.project?.budget ?? 0)} <span className="text-[10px] font-normal">(예산기준)</span></span>
                        : <span className="text-slate-400">{formatMoney(0)}</span>}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted whitespace-nowrap">{billingProgressLabel(c.billing_schedule ?? [])}</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-semibold whitespace-nowrap ${CONTRACT_STATUS_STYLE[c.status]}`}>
                      {CONTRACT_STATUS_LABEL[c.status] ?? c.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-center text-xs text-muted whitespace-nowrap">
                    {c.deposited_at ? formatDateKo(c.deposited_at) : '대기'}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 등록·수정 모달 */}
      <ContractFormModal
        open={formOpen}
        target={editTarget}
        onClose={() => { setFormOpen(false); setEditTarget(null); }}
        onSaved={() => { setFormOpen(false); setEditTarget(null); void reload(); }}
      />

      {/* 상세 드로어 */}
      <ContractDetailDrawer
        contract={detailTarget}
        onClose={() => setDetailTarget(null)}
        onEdit={handleEdit}
        onChanged={() => { setDetailTarget(null); void reload(); }}
      />
    </div>
  );
}
