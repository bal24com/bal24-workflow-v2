// bal24 v2 — 전체 프로젝트 정산 목록
// 단계별 필터 탭 + 카드 그리드 (클릭 시 보고서 페이지로 이동)

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Search, ArrowRight } from 'lucide-react';
import { Button, Card, CardContent } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import EmptyState from '../../components/EmptyState';
import { useToast } from '../../contexts/ToastContext';
import { formatKoreanDate } from '../reports/reportUtils';
import { formatMoney } from '../../lib/utils';
import { isOutsourceType, isOperationType } from '../payroll/payrollUtils';
import {
  getStepLabel, getStepColor, isSettlementDone, lastUpdatedAt,
} from './settlementUtils';
import SettlementActionModal from './SettlementActionModal';
import type { ProjectSettlementRow } from '../../types/database';

type Filter = 'all' | 1 | 2 | 3 | 4 | 5 | 'done';

type SettlementRow = ProjectSettlementRow & {
  project: {
    id: string;
    name: string;
    deleted_at: string | null;
    client?: { name: string; deleted_at: string | null } | null;
  } | null;
};

// STEP-TRASH-FILTER-AUDIT — projects/clients deleted_at 까지 가져와서 휴지통 정산 차단
// project_settlements → projects 단일 FK + projects → clients 단일 FK
const SELECT_COLUMNS =
  '*, project:projects(id, name, deleted_at, client:clients(name, deleted_at))';

const TABS: { key: Filter; label: string }[] = [
  { key: 'all',  label: '전체' },
  { key: 1,      label: '1. 보고서 대기' },
  { key: 2,      label: '2. 승인 대기' },
  { key: 3,      label: '3. 세금계산서' },
  { key: 4,      label: '4. 입금 확인' },
  { key: 5,      label: '5. 출금 처리' },
  { key: 'done', label: '완료' },
];

interface ProjectFin { proposal: number; exec: number; outsource: number; operation: number }

export default function SettlementPage() {
  const toast = useToast();
  const [items, setItems] = useState<SettlementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<SettlementRow | null>(null);
  // 박경수님 요청 — 각 정산 카드에 미니 재무 요약 (제안 견적 / 인건비 / 운영비)
  const [finMap, setFinMap] = useState<Map<string, ProjectFin>>(new Map());

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('project_settlements')
        .select(SELECT_COLUMNS)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      setItems((data ?? []) as SettlementRow[]);
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[settlement] 조회 실패:', raw);
      toast.error('정산 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { void fetchItems(); }, [fetchItems]);

  // 박경수님 요청 — 정산 목록 fetch 후 각 프로젝트의 견적·실집행 일괄 fetch (N+1 회피)
  useEffect(() => {
    const projectIds = Array.from(new Set(items.map((s) => s.project?.id).filter(Boolean) as string[]));
    if (projectIds.length === 0) { setFinMap(new Map()); return; }
    let cancelled = false;
    void Promise.all([
      supabase.from('project_estimates').select('project_id, total_amount').in('project_id', projectIds).is('deleted_at', null),
      supabase.from('payroll_expenses').select('project_id, subtotal, expense_type, payment_status').in('project_id', projectIds).is('deleted_at', null),
    ]).then(([estRes, payRes]) => {
      if (cancelled) return;
      const m = new Map<string, ProjectFin>();
      for (const id of projectIds) m.set(id, { proposal: 0, exec: 0, outsource: 0, operation: 0 });
      for (const r of ((estRes.data ?? []) as Array<{ project_id: string; total_amount: number | string | null }>)) {
        const f = m.get(r.project_id); if (f) f.proposal += Number(r.total_amount ?? 0);
      }
      for (const r of ((payRes.data ?? []) as Array<{ project_id: string; subtotal: number | string | null; expense_type: string; payment_status: string }>)) {
        if (r.payment_status === 'cancelled') continue;
        const f = m.get(r.project_id); if (!f) continue;
        const amt = Number(r.subtotal ?? 0);
        f.exec += amt;
        if (isOutsourceType(r.expense_type)) f.outsource += amt;
        else if (isOperationType(r.expense_type)) f.operation += amt;
      }
      setFinMap(m);
    });
    return () => { cancelled = true; };
  }, [items]);

  // STEP-TRASH-FILTER-AUDIT — 휴지통 프로젝트·고객사에 연결된 정산 row 는 숨김
  const isLive = useCallback((s: SettlementRow) =>
    !s.project?.deleted_at && !s.project?.client?.deleted_at,
  []);

  const counts = useMemo<Record<Filter, number>>(() => {
    const live = items.filter(isLive);
    const acc: Record<Filter, number> = {
      all: live.length, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, done: 0,
    };
    for (const s of live) {
      if (isSettlementDone(s)) acc.done += 1;
      else acc[s.current_step] = (acc[s.current_step] ?? 0) + 1;
    }
    return acc;
  }, [items, isLive]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((s) => {
      if (!isLive(s)) return false;
      if (filter === 'done') {
        if (!isSettlementDone(s)) return false;
      } else if (filter !== 'all') {
        if (isSettlementDone(s)) return false;
        if (s.current_step !== filter) return false;
      }
      if (!q) return true;
      const hay = [s.project?.name, s.project?.client?.name].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [items, filter, search, isLive]);

  return (
    <div className="space-y-5 max-w-[1400px]">
      <h1 className="text-2xl font-bold text-[#1E1B4B] flex items-center gap-2">
        <span aria-hidden="true">📊</span>
        정산
      </h1>
      <nav role="tablist" aria-label="단계 필터" className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto">
        {TABS.map((t) => {
          const active = filter === t.key;
          return (
            <button
              key={String(t.key)}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(t.key)}
              className={['inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap',
                active ? 'text-primary border-primary' : 'text-slate-500 border-transparent hover:text-text'].join(' ')}
            >
              {t.label}
              <span className={['inline-flex items-center justify-center min-w-[1.25rem] px-1 rounded text-[10px]',
                active ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-500'].join(' ')}>
                {counts[t.key]}
              </span>
            </button>
          );
        })}
      </nav>

      <div className="relative w-full sm:max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="프로젝트·고객사 검색"
          className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-sm text-muted">
          <Loader2 size={18} className="animate-spin mr-2" />
          불러오는 중…
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          emoji="📊"
          title={search.trim() ? '검색 결과가 없어요.' : '정산 진행 중인 프로젝트가 없어요.'}
          description="결과보고서를 제출하면 자동으로 정산이 시작돼요."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map((s) => {
            const stamp = lastUpdatedAt(s);
            const isDoneState = isSettlementDone(s);
            const cardClickable = !isDoneState; // 완료 정산은 모달 안 열림 (변경할 게 없음)
            return (
              <Card
                key={s.id}
                onClick={cardClickable ? () => setSelected(s) : undefined}
                className={[
                  'hover:border-primary/30 hover:shadow-md transition h-full',
                  cardClickable ? 'cursor-pointer' : '',
                ].join(' ')}
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-text truncate">{s.project?.name ?? '프로젝트 미연결'}</h3>
                      <div className="text-xs text-muted truncate mt-0.5">
                        {s.project?.client?.name ? `고객사 ${s.project.client.name}` : '고객사 미지정'}
                      </div>
                    </div>
                    <span className={[
                      'inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-semibold whitespace-nowrap',
                      getStepColor(s),
                    ].join(' ')}>
                      {getStepLabel(s)}
                    </span>
                  </div>
                  {stamp && (
                    <div className="text-[11px] text-muted">최근 업데이트 {formatKoreanDate(stamp)}</div>
                  )}
                  {/* 박경수님 요청 — 미니 재무 요약 */}
                  {s.project?.id && finMap.get(s.project.id) && (() => {
                    const f = finMap.get(s.project.id)!;
                    const remain = f.proposal - f.exec;
                    return (
                      <div className="rounded-lg border border-violet-100 bg-violet-50/40 px-2.5 py-1.5 text-[11px] space-y-0.5">
                        <div className="flex justify-between text-slate-600"><span>제안 견적</span><span className="tabular-nums font-semibold text-violet-700">{formatMoney(f.proposal)}</span></div>
                        <div className="flex justify-between text-slate-600"><span>실집행 (인건 {formatMoney(f.outsource)} / 운영 {formatMoney(f.operation)})</span><span className="tabular-nums font-semibold text-emerald-700">{formatMoney(f.exec)}</span></div>
                        {f.proposal > 0 && (
                          <div className={`flex justify-between font-bold ${remain >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                            <span>{remain >= 0 ? '잔여' : '⚠ 초과'}</span><span className="tabular-nums">{formatMoney(Math.abs(remain))}</span>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  {s.note && (
                    <p className="text-xs text-muted line-clamp-2 bg-slate-50/60 rounded-lg p-2">{s.note}</p>
                  )}
                  {s.invoice_number && (
                    <p className="text-[11px] text-slate-500">세금계산서 #{s.invoice_number}</p>
                  )}
                  {s.project?.id && (
                    <Link
                      to={`/projects/${s.project.id}/report`}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center justify-end w-full"
                    >
                      <Button variant="outline" size="sm" rightIcon={<ArrowRight size={12} />}>
                        보고서 열기
                      </Button>
                    </Link>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {selected && selected.project?.id && (
        <SettlementActionModal
          open={Boolean(selected)}
          settlement={selected}
          projectId={selected.project.id}
          projectName={selected.project.name ?? '프로젝트'}
          onClose={() => setSelected(null)}
          onSaved={() => {
            setSelected(null);
            void fetchItems();
          }}
        />
      )}
    </div>
  );
}
