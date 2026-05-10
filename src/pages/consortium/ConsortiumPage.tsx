// bal24 v2 — 컨소시엄 목록 페이지
// 카드(기본) + 리스트 + 상태 필터 + 검색(이름/주관사)

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { LayoutGrid, List, Plus, Loader2, Search, Users2, Briefcase } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../components/ui';
import { supabase } from '../../lib/supabase';
import EmptyState from '../../components/EmptyState';
import { BADGE_BASE, CONSORTIUM_STATUS_STYLE } from '../../utils/statusStyles';
import { useToast } from '../../contexts/ToastContext';
import type { Consortium, ConsortiumStatus } from '../../types/database';
import { CONSORTIUM_STATUS_VALUES } from './consortiumStatus';
import ConsortiumFormModal from './ConsortiumFormModal';

type ViewMode = 'card' | 'list';
type StatusFilter = ConsortiumStatus | '전체';

type ConsortiumRow = Consortium & {
  lead_client?: { id: string; name: string } | null;
  project?: { id: string; name: string } | null;
  members: { id: string }[];
};

const SELECT_COLUMNS =
  '*, lead_client:clients!consortiums_lead_client_id_fkey(id,name), project:projects!consortiums_project_id_fkey(id,name), members:consortium_members(id)';

function StatusFilterTabs({
  value, onChange, counts,
}: { value: StatusFilter; onChange: (v: StatusFilter) => void; counts: Record<StatusFilter, number> }) {
  const all: StatusFilter[] = ['전체', ...CONSORTIUM_STATUS_VALUES];
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="상태 필터">
      {all.map((s) => {
        const active = value === s;
        return (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(s)}
            className={['inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
              active ? 'bg-primary text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'].join(' ')}
          >
            {s}
            <span className={['inline-flex items-center justify-center min-w-[1.25rem] px-1 rounded text-[10px]',
              active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'].join(' ')}>
              {counts[s] ?? 0}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function ConsortiumGridCard({ c }: { c: ConsortiumRow }) {
  return (
    <Link to={`/consortium/${c.id}`} className="block">
      <Card className="hover:border-primary/30 hover:shadow-md transition cursor-pointer h-full">
        <CardHeader>
          <div className="flex items-start gap-2">
            <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 text-primary shrink-0">
              <Users2 size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="truncate">{c.name}</CardTitle>
                <span className={`${BADGE_BASE} ${CONSORTIUM_STATUS_STYLE[c.status]}`}>{c.status}</span>
              </div>
              <CardDescription>
                {c.lead_client?.name ? `주관 ${c.lead_client.name}` : '주관사 미지정'}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-1.5 text-xs text-muted">
          {c.project?.name && (
            <div className="flex items-center gap-1.5">
              <Briefcase size={12} className="text-slate-400" />
              <span className="truncate">프로젝트 {c.project.name}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <Users2 size={12} className="text-slate-400" />
            <span>참여사 {c.members.length}곳</span>
          </div>
          {c.description && (
            <p className="text-xs text-muted line-clamp-2 pt-1">{c.description}</p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

function ConsortiumListRow({ c }: { c: ConsortiumRow }) {
  return (
    <li>
      <Link to={`/consortium/${c.id}`} className="flex items-center gap-3 p-4 bg-white rounded-xl border border-slate-200 hover:border-primary/30 hover:shadow-sm transition">
        <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 text-primary shrink-0">
          <Users2 size={18} />
        </span>
        <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-3 items-center">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="text-sm font-bold text-text truncate">{c.name}</div>
              <span className={`${BADGE_BASE} ${CONSORTIUM_STATUS_STYLE[c.status]}`}>{c.status}</span>
            </div>
            <div className="text-xs text-muted truncate">
              {c.lead_client?.name ? `주관 ${c.lead_client.name}` : '주관사 미지정'}
            </div>
          </div>
          <div className="min-w-0 text-xs text-muted truncate">
            {c.project?.name ? `프로젝트 · ${c.project.name}` : <span className="text-slate-400">프로젝트 미연결</span>}
          </div>
          <div className="min-w-0 text-xs text-muted">
            참여사 <span className="text-slate-700 font-semibold">{c.members.length}</span>곳
          </div>
        </div>
      </Link>
    </li>
  );
}

export default function ConsortiumPage() {
  const toast = useToast();
  const [items, setItems] = useState<ConsortiumRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>('card');
  const [filter, setFilter] = useState<StatusFilter>('전체');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      // STEP-DELETE-RESUME-FULL — 휴지통(deleted_at IS NOT NULL) 제외
      const { data, error } = await supabase
        .from('consortiums')
        .select(SELECT_COLUMNS)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setItems((data ?? []) as ConsortiumRow[]);
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[consortium] 목록 조회 실패:', raw);
      const m = raw.toLowerCase();
      if (m.includes('column') && m.includes('does not exist')) {
        toast.error('컨소시엄 테이블 컬럼이 아직 적용되지 않았어요. Supabase에서 마이그레이션을 실행해 주세요.');
      } else {
        toast.error('컨소시엄 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
      }
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { void fetchItems(); }, [fetchItems]);

  const counts = useMemo<Record<StatusFilter, number>>(() => {
    const acc: Record<StatusFilter, number> = { 전체: items.length, 구성중: 0, 진행: 0, 완료: 0, 해산: 0 };
    for (const c of items) acc[c.status] = (acc[c.status] ?? 0) + 1;
    return acc;
  }, [items]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((c) => {
      if (filter !== '전체' && c.status !== filter) return false;
      if (!q) return true;
      if (c.name?.toLowerCase().includes(q)) return true;
      if (c.lead_client?.name?.toLowerCase().includes(q)) return true;
      return false;
    });
  }, [items, filter, search]);

  return (
    <div className="space-y-5 max-w-[1400px]">
      <h1 className="text-2xl font-bold text-[#1E1B4B] flex items-center gap-2">
        <span aria-hidden="true">🤝</span>
        컨소시엄
      </h1>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <StatusFilterTabs value={filter} onChange={setFilter} counts={counts} />
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
            <button type="button" onClick={() => setView('card')} aria-pressed={view === 'card'} aria-label="카드 보기"
              className={['inline-flex items-center justify-center w-8 h-8 rounded-md transition-colors',
                view === 'card' ? 'bg-primary text-white' : 'text-slate-500 hover:bg-slate-50'].join(' ')}>
              <LayoutGrid size={16} />
            </button>
            <button type="button" onClick={() => setView('list')} aria-pressed={view === 'list'} aria-label="리스트 보기"
              className={['inline-flex items-center justify-center w-8 h-8 rounded-md transition-colors',
                view === 'list' ? 'bg-primary text-white' : 'text-slate-500 hover:bg-slate-50'].join(' ')}>
              <List size={16} />
            </button>
          </div>
          <Button variant="primary" leftIcon={<Plus size={16} />} onClick={() => setModalOpen(true)}>신규 등록</Button>
        </div>
      </div>

      <div className="relative w-full sm:max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="컨소시엄명 또는 주관사로 검색"
          className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-sm text-muted">
          <Loader2 size={18} className="animate-spin mr-2" />
          불러오는 중…
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          emoji="🤝"
          title={search.trim() || filter !== '전체' ? '조건에 맞는 컨소시엄이 없어요.' : '아직 등록된 컨소시엄이 없어요.'}
          description={!search.trim() && filter === '전체' ? '첫 컨소시엄을 만들어 보세요.' : undefined}
          action={
            !search.trim() && filter === '전체' && (
              <Button variant="primary" leftIcon={<Plus size={14} />} onClick={() => setModalOpen(true)}>
                + 컨소시엄 등록
              </Button>
            )
          }
        />
      ) : view === 'card' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map((c) => (<ConsortiumGridCard key={c.id} c={c} />))}
        </div>
      ) : (
        <ul className="space-y-2">
          {visible.map((c) => (<ConsortiumListRow key={c.id} c={c} />))}
        </ul>
      )}

      <ConsortiumFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={() => void fetchItems()}
      />
    </div>
  );
}
