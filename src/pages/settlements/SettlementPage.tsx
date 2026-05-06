// bal24 v2 — 전체 프로젝트 정산 목록
// 단계별 필터 탭 + 카드 그리드 (클릭 시 보고서 페이지로 이동)

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Search, CreditCard, ArrowRight } from 'lucide-react';
import { Badge, Button, Card, CardContent } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { formatKoreanDate } from '../reports/reportUtils';
import type { ProjectSettlementRow, SettlementStep } from '../../types/database';

type Filter = 'all' | 1 | 2 | 3 | 4 | 5 | 'done';

type SettlementRow = ProjectSettlementRow & {
  project: { id: string; name: string; client?: { name: string } | null } | null;
};

// project_settlements → projects 단일 FK + projects → clients 단일 FK
const SELECT_COLUMNS =
  '*, project:projects(id, name, client:clients(name))';

const STEP_LABEL: Record<SettlementStep, string> = {
  1: '제출대기', 2: '승인대기', 3: '세금계산서', 4: '입금확인', 5: '출금처리',
};

const STEP_COLORS: Record<SettlementStep, string> = {
  1: 'bg-slate-100 text-slate-600',
  2: 'bg-secondary/10 text-secondary',
  3: 'bg-accent/10 text-accent',
  4: 'bg-blue-100 text-blue-700',
  5: 'bg-primary/10 text-primary',
};

function isDone(s: ProjectSettlementRow): boolean {
  return s.current_step === 5 && Boolean(s.paid_out_at);
}

function lastUpdated(s: ProjectSettlementRow): string | null {
  return s.paid_out_at ?? s.received_at ?? s.invoice_at ?? s.approved_at ?? s.created_at ?? null;
}

const TABS: { key: Filter; label: string }[] = [
  { key: 'all',  label: '전체' },
  { key: 1,      label: '1.제출대기' },
  { key: 2,      label: '2.승인대기' },
  { key: 3,      label: '3.세금계산서' },
  { key: 4,      label: '4.입금확인' },
  { key: 5,      label: '5.출금처리' },
  { key: 'done', label: '완료' },
];

export default function SettlementPage() {
  const [items, setItems] = useState<SettlementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
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
      setErrorMsg('정산 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchItems(); }, [fetchItems]);

  const counts = useMemo<Record<Filter, number>>(() => {
    const acc: Record<Filter, number> = {
      all: items.length, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, done: 0,
    };
    for (const s of items) {
      if (isDone(s)) acc.done += 1;
      else acc[s.current_step] = (acc[s.current_step] ?? 0) + 1;
    }
    return acc;
  }, [items]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((s) => {
      if (filter === 'done') {
        if (!isDone(s)) return false;
      } else if (filter !== 'all') {
        if (isDone(s)) return false;
        if (s.current_step !== filter) return false;
      }
      if (!q) return true;
      const hay = [s.project?.name, s.project?.client?.name].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [items, filter, search]);

  return (
    <div className="space-y-5 max-w-[1400px]">
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
          <CreditCard size={28} className="text-slate-300 mb-2" />
          <p className="text-sm text-muted mb-3">
            {search.trim() ? '검색 결과가 없어요.' : '정산 진행 중인 프로젝트가 없어요.'}
          </p>
          <p className="text-xs text-muted">
            결과보고서를 <strong>제출</strong>하면 자동으로 정산이 시작돼요.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map((s) => {
            const done = isDone(s);
            const stamp = lastUpdated(s);
            return (
              <Card key={s.id} className="hover:border-primary/30 hover:shadow-md transition h-full">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-text truncate">{s.project?.name ?? '프로젝트 미연결'}</h3>
                      <div className="text-xs text-muted truncate mt-0.5">
                        {s.project?.client?.name ? `고객사 ${s.project.client.name}` : '고객사 미지정'}
                      </div>
                    </div>
                    {done ? (
                      <Badge variant="success">완료</Badge>
                    ) : (
                      <span className={['inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold whitespace-nowrap',
                        STEP_COLORS[s.current_step]].join(' ')}>
                        {s.current_step}.{STEP_LABEL[s.current_step]}
                      </span>
                    )}
                  </div>
                  {stamp && (
                    <div className="text-[11px] text-muted">최근 업데이트 {formatKoreanDate(stamp)}</div>
                  )}
                  {s.note && (
                    <p className="text-xs text-muted line-clamp-2 bg-slate-50/60 rounded-lg p-2">{s.note}</p>
                  )}
                  {s.project?.id && (
                    <Link to={`/projects/${s.project.id}/report`} className="inline-flex items-center justify-end w-full">
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
    </div>
  );
}
