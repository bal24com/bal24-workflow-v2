// bal24 v2 — 프로젝트 목록 페이지
// 리스트/카드 뷰 토글 + 상태 필터 + 신규 등록 모달

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { LayoutGrid, List, Plus, Loader2 } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { formatDateKo, formatMoney } from '../../lib/utils';
import { BADGE_BASE, PROJECT_STATUS_STYLE } from '../../utils/statusStyles';
import { getOurRoleLabel, getOurRoleBadgeTone } from '../../constants/projectRoles';
import EmptyState from '../../components/EmptyState';
import PageHelpBanner from '../../components/PageHelpBanner';
import ConsortiumFilterTabs, {
  type ConsortiumFilter,
  type ConsortiumOption,
} from '../../components/ConsortiumFilterTabs';
import { useToast } from '../../contexts/ToastContext';
import type { Project, ProjectStatus } from '../../types/database';
import { PROJECT_STATUS_VALUES } from './projectStatus';
import ProjectFormModal from './ProjectFormModal';

type ViewMode = 'list' | 'card';
type StatusFilter = ProjectStatus | '전체';

type ProjectRow = Project & {
  client?: { id: string; name: string } | null;
  pm?: { id: string; name: string } | null;
};

// projects → profiles FK가 두 개(pm_id, created_by) 있어 명시적 별칭 필요 (PGRST201 방지).
// consortium join은 projects.consortium_id 컬럼이 미적용된 환경에서 400 유발 → 제거.
// 필터링은 '*' 에 포함되는 consortium_id 컬럼만 사용 (컬럼이 없으면 자동으로 undefined → 전체/자체 사업 분기 정상 작동).
const SELECT_COLUMNS =
  '*, client:clients(id,name), pm:profiles!projects_pm_id_fkey(id,name)';

function StatusFilterTabs({
  value,
  onChange,
  counts,
}: {
  value: StatusFilter;
  onChange: (next: StatusFilter) => void;
  counts: Record<StatusFilter, number>;
}) {
  const all: StatusFilter[] = ['전체', ...PROJECT_STATUS_VALUES];
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {all.map((s) => {
        const active = value === s;
        return (
          <button
            key={s}
            type="button"
            onClick={() => onChange(s)}
            className={[
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
              active
                ? 'bg-primary text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50',
            ].join(' ')}
          >
            {s}
            <span
              className={[
                'inline-flex items-center justify-center min-w-[1.25rem] px-1 rounded text-[10px]',
                active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500',
              ].join(' ')}
            >
              {counts[s] ?? 0}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function ProjectMeta({ p }: { p: ProjectRow }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
      <span>
        담당자{' '}
        <span className="text-slate-700 font-medium">{p.pm?.name ?? '미지정'}</span>
      </span>
      <span aria-hidden="true">·</span>
      <span>
        고객사{' '}
        <span className="text-slate-700 font-medium">{p.client?.name ?? '미지정'}</span>
      </span>
      {(p.start_date || p.end_date) && (
        <>
          <span aria-hidden="true">·</span>
          <span>
            {formatDateKo(p.start_date) || '미정'} ~ {formatDateKo(p.end_date) || '미정'}
          </span>
        </>
      )}
      {p.budget != null && (
        <>
          <span aria-hidden="true">·</span>
          <span>{formatMoney(p.budget)}</span>
        </>
      )}
    </div>
  );
}

function ProjectListItem({ p }: { p: ProjectRow }) {
  return (
    <li>
      <Link
        to={`/projects/${p.id}`}
        className="flex items-start gap-3 p-4 bg-white rounded-xl border border-slate-200 hover:border-primary/30 hover:shadow-sm transition"
      >
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold text-text truncate">{p.name}</h3>
            <span className={`${BADGE_BASE} ${PROJECT_STATUS_STYLE[p.status]}`}>{p.status}</span>
            {p.our_role && (
              <span className={`${BADGE_BASE} ${getOurRoleBadgeTone(p.our_role)}`}>
                {getOurRoleLabel(p.our_role)}
              </span>
            )}
            {p.type?.map((t) => (
              <span key={t} className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                {t}
              </span>
            ))}
          </div>
          <ProjectMeta p={p} />
        </div>
      </Link>
    </li>
  );
}

function ProjectCard({ p }: { p: ProjectRow }) {
  return (
    <Link to={`/projects/${p.id}`} className="block">
      <Card className="hover:border-primary/30 hover:shadow-md transition cursor-pointer h-full">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="truncate">{p.name}</CardTitle>
            <div className="flex items-center gap-1 shrink-0">
              {p.our_role && (
                <span className={`${BADGE_BASE} ${getOurRoleBadgeTone(p.our_role)}`}>
                  {getOurRoleLabel(p.our_role)}
                </span>
              )}
              <span className={`${BADGE_BASE} ${PROJECT_STATUS_STYLE[p.status]}`}>{p.status}</span>
            </div>
          </div>
          <CardDescription>
            {p.type?.join(' · ') ?? '유형 미지정'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <ProjectMeta p={p} />
          {p.description && (
            <p className="text-xs text-muted line-clamp-2">{p.description}</p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

export default function ProjectsPage() {
  const toast = useToast();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>('list');
  const [filter, setFilter] = useState<StatusFilter>('전체');
  const [filterConsortiumId, setFilterConsortiumId] = useState<ConsortiumFilter>(null);
  const [consortiums, setConsortiums] = useState<ConsortiumOption[]>([]);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from('consortiums')
        .select('id, name')
        .in('status', ['구성중', '진행'])
        .order('name', { ascending: true });
      if (cancelled) return;
      if (error) {
        console.error('[projects] 컨소시엄 조회 실패:', error.message);
        return;
      }
      setConsortiums((data as ConsortiumOption[] | null) ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('projects')
        .select(SELECT_COLUMNS)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProjects((data ?? []) as ProjectRow[]);
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[projects] 목록 조회 실패:', raw);
      toast.error('프로젝트 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void fetchProjects();
  }, [fetchProjects]);

  const counts = useMemo<Record<StatusFilter, number>>(() => {
    const acc: Record<StatusFilter, number> = {
      전체: projects.length,
      제안: 0,
      진행: 0,
      정산: 0,
      종료: 0,
    };
    for (const p of projects) {
      acc[p.status] = (acc[p.status] ?? 0) + 1;
    }
    return acc;
  }, [projects]);

  const visible = useMemo(
    () =>
      projects.filter((p) => {
        if (filter !== '전체' && p.status !== filter) return false;
        if (filterConsortiumId === 'none' && p.consortium_id) return false;
        if (filterConsortiumId && filterConsortiumId !== 'none' && p.consortium_id !== filterConsortiumId) return false;
        return true;
      }),
    [projects, filter, filterConsortiumId],
  );

  return (
    <div className="space-y-5 max-w-[1400px]">
      <h1 className="text-2xl font-bold text-[#1E1B4B] flex items-center gap-2">
        <span aria-hidden="true">📁</span>
        프로젝트
      </h1>
      <PageHelpBanner
        lines={[
          '✦ 단독 용역·사업 단위로 관리. 컨소시엄 사업은 좌측 메뉴 \"컨소시엄\"에서 별도 관리해요.',
          '✦ 카드/리스트 뷰 + 상태 탭으로 진행 단계별 빠른 필터링',
          '💡 카드 클릭 → 상세 페이지에서 태스크·프로그램·재무·결과보고서까지 한 번에',
        ]}
      />
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <StatusFilterTabs value={filter} onChange={setFilter} counts={counts} />

          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
              <button
                type="button"
                onClick={() => setView('list')}
                aria-pressed={view === 'list'}
                aria-label="리스트 보기"
                className={[
                  'inline-flex items-center justify-center w-8 h-8 rounded-md transition-colors',
                  view === 'list' ? 'bg-primary text-white' : 'text-slate-500 hover:bg-slate-50',
                ].join(' ')}
              >
                <List size={16} />
              </button>
              <button
                type="button"
                onClick={() => setView('card')}
                aria-pressed={view === 'card'}
                aria-label="카드 보기"
                className={[
                  'inline-flex items-center justify-center w-8 h-8 rounded-md transition-colors',
                  view === 'card' ? 'bg-primary text-white' : 'text-slate-500 hover:bg-slate-50',
                ].join(' ')}
              >
                <LayoutGrid size={16} />
              </button>
            </div>

            <Button
              variant="primary"
              leftIcon={<Plus size={16} />}
              onClick={() => setModalOpen(true)}
            >
              신규 등록
            </Button>
          </div>
        </div>

        <ConsortiumFilterTabs
          consortiums={consortiums}
          value={filterConsortiumId}
          onChange={setFilterConsortiumId}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-sm text-muted">
          <Loader2 size={18} className="animate-spin mr-2" />
          불러오는 중…
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          emoji="📁"
          title={filter === '전체' ? '아직 등록된 프로젝트가 없어요.' : `${filter} 상태인 프로젝트가 없어요.`}
          description={filter === '전체' ? '첫 프로젝트를 만들어 보세요.' : undefined}
          action={
            filter === '전체' && (
              <Button variant="primary" leftIcon={<Plus size={14} />} onClick={() => setModalOpen(true)}>
                + 프로젝트 등록
              </Button>
            )
          }
        />
      ) : view === 'list' ? (
        <ul className="space-y-2">
          {visible.map((p) => (
            <ProjectListItem key={p.id} p={p} />
          ))}
        </ul>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map((p) => (
            <ProjectCard key={p.id} p={p} />
          ))}
        </div>
      )}

      <ProjectFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={() => void fetchProjects()}
      />
    </div>
  );
}
