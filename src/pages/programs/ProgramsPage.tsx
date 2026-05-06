// bal24 v2 — 프로그램 목록 페이지
// 리스트/카드 뷰 + 상태 필터 + 유형 필터 + 신규 등록 모달

import { useCallback, useEffect, useMemo, useState } from 'react';
import { LayoutGrid, List, Plus, Loader2, UserPlus } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { formatDateKo } from '../../lib/utils';
import type { Program, ProgramStatus, ProgramType } from '../../types/database';
import {
  PROGRAM_STATUS_VALUES,
  PROGRAM_TYPE_VALUES,
  programStatusToBadgeVariant,
} from './programStatus';
import ProgramFormModal from './ProgramFormModal';
import InvitationManagePanel from './InvitationManagePanel';

type ViewMode = 'list' | 'card';
type StatusFilter = ProgramStatus | '전체';
type TypeFilter = ProgramType | '전체';

type ProgramRow = Program & {
  project?: { id: string; name: string } | null;
};

// programs.project_id → projects(id) FK 하나뿐이라 단축형 안전
const SELECT_COLUMNS = '*, project:projects(id,name)';

function FilterTabs<T extends string>({
  values,
  value,
  onChange,
  counts,
  ariaLabel,
}: {
  values: T[];
  value: T;
  onChange: (next: T) => void;
  counts?: Record<string, number>;
  ariaLabel: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label={ariaLabel}>
      {values.map((s) => {
        const active = value === s;
        return (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(s)}
            className={[
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
              active
                ? 'bg-primary text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50',
            ].join(' ')}
          >
            {s}
            {counts && (
              <span
                className={[
                  'inline-flex items-center justify-center min-w-[1.25rem] px-1 rounded text-[10px]',
                  active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500',
                ].join(' ')}
              >
                {counts[s] ?? 0}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function ProgramMeta({ p }: { p: ProgramRow }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
      <span>
        프로젝트{' '}
        <span className="text-slate-700 font-medium">{p.project?.name ?? '미연결'}</span>
      </span>
      {(p.start_date || p.end_date) && (
        <>
          <span aria-hidden="true">·</span>
          <span>
            {formatDateKo(p.start_date) || '미정'} ~ {formatDateKo(p.end_date) || '미정'}
          </span>
        </>
      )}
      {p.venue && (
        <>
          <span aria-hidden="true">·</span>
          <span>{p.venue}</span>
        </>
      )}
      {p.capacity != null && (
        <>
          <span aria-hidden="true">·</span>
          <span>정원 {p.capacity}명</span>
        </>
      )}
    </div>
  );
}

function InviteButton({ onClick, size = 'sm' }: { onClick: (e: React.MouseEvent) => void; size?: 'sm' | 'xs' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'inline-flex items-center gap-1 rounded-lg font-semibold text-primary hover:bg-primary/5 transition-colors',
        size === 'xs' ? 'px-2 py-0.5 text-[10px]' : 'px-2 py-1 text-xs',
      ].join(' ')}
      aria-label="초대 관리"
    >
      <UserPlus size={size === 'xs' ? 10 : 12} />
      초대 관리
    </button>
  );
}

function ProgramListItem({ p, onInvite }: { p: ProgramRow; onInvite: (p: ProgramRow) => void }) {
  return (
    <li className="flex items-start gap-3 p-4 bg-white rounded-xl border border-slate-200 hover:border-primary/30 hover:shadow-sm transition">
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-bold text-text truncate">{p.name}</h3>
          <Badge variant={programStatusToBadgeVariant(p.status)}>{p.status}</Badge>
          <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
            {p.type}
          </span>
        </div>
        <ProgramMeta p={p} />
      </div>
      <InviteButton onClick={(e) => { e.stopPropagation(); onInvite(p); }} />
    </li>
  );
}

function ProgramCard({ p, onInvite }: { p: ProgramRow; onInvite: (p: ProgramRow) => void }) {
  return (
    <Card className="hover:border-primary/30 hover:shadow-md transition h-full">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="truncate">{p.name}</CardTitle>
          <Badge variant={programStatusToBadgeVariant(p.status)}>{p.status}</Badge>
        </div>
        <CardDescription>{p.type}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <ProgramMeta p={p} />
        {p.description && (
          <p className="text-xs text-muted line-clamp-2">{p.description}</p>
        )}
        <div className="pt-2 border-t border-slate-100 flex justify-end">
          <InviteButton onClick={(e) => { e.stopPropagation(); onInvite(p); }} />
        </div>
      </CardContent>
    </Card>
  );
}

export default function ProgramsPage() {
  const [programs, setPrograms] = useState<ProgramRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>('list');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('전체');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('전체');
  const [modalOpen, setModalOpen] = useState(false);
  const [invitePanel, setInvitePanel] = useState<ProgramRow | null>(null);

  const fetchPrograms = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const { data, error } = await supabase
        .from('programs')
        .select(SELECT_COLUMNS)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPrograms((data ?? []) as ProgramRow[]);
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[programs] 목록 조회 실패:', raw);
      const m = raw.toLowerCase();
      if (m.includes("could not find the table 'public.programs'") || m.includes('pgrst205')) {
        setErrorMsg('프로그램 테이블이 아직 적용되지 않았어요. Supabase에서 마이그레이션을 실행해 주세요.');
      } else {
        setErrorMsg('프로그램 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPrograms();
  }, [fetchPrograms]);

  const statusCounts = useMemo<Record<StatusFilter, number>>(() => {
    const acc: Record<StatusFilter, number> = {
      전체: programs.length, 준비: 0, 진행: 0, 완료: 0, 취소: 0,
    };
    for (const p of programs) acc[p.status] = (acc[p.status] ?? 0) + 1;
    return acc;
  }, [programs]);

  const typeCounts = useMemo<Record<TypeFilter, number>>(() => {
    const acc: Record<TypeFilter, number> = {
      전체: programs.length, 교육: 0, 캠프: 0, 행사: 0, 기타: 0,
    };
    for (const p of programs) acc[p.type] = (acc[p.type] ?? 0) + 1;
    return acc;
  }, [programs]);

  const visible = useMemo(() => {
    return programs.filter(
      (p) =>
        (statusFilter === '전체' || p.status === statusFilter) &&
        (typeFilter === '전체' || p.type === typeFilter),
    );
  }, [programs, statusFilter, typeFilter]);

  return (
    <div className="space-y-5 max-w-[1400px]">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1.5">
            <div className="text-xs font-semibold text-slate-500">상태</div>
            <FilterTabs<StatusFilter>
              values={['전체', ...PROGRAM_STATUS_VALUES]}
              value={statusFilter}
              onChange={setStatusFilter}
              counts={statusCounts}
              ariaLabel="상태 필터"
            />
          </div>

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

        <div className="space-y-1.5">
          <div className="text-xs font-semibold text-slate-500">유형</div>
          <FilterTabs<TypeFilter>
            values={['전체', ...PROGRAM_TYPE_VALUES]}
            value={typeFilter}
            onChange={setTypeFilter}
            counts={typeCounts}
            ariaLabel="유형 필터"
          />
        </div>
      </div>

      {errorMsg && (
        <div role="alert" className="rounded-xl bg-danger/10 border border-danger/20 px-4 py-3 text-sm text-danger">
          {errorMsg}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-sm text-muted">
          <Loader2 size={18} className="animate-spin mr-2" />
          불러오는 중…
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-white rounded-xl border border-dashed border-slate-200">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 text-xl mb-2">
            🎓
          </div>
          <p className="text-sm text-muted mb-3">
            {statusFilter === '전체' && typeFilter === '전체'
              ? '아직 등록된 프로그램이 없어요.'
              : '조건에 맞는 프로그램이 없어요.'}
          </p>
          {statusFilter === '전체' && typeFilter === '전체' && (
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Plus size={14} />}
              onClick={() => setModalOpen(true)}
            >
              첫 프로그램 만들기
            </Button>
          )}
        </div>
      ) : view === 'list' ? (
        <ul className="space-y-2">
          {visible.map((p) => (
            <ProgramListItem key={p.id} p={p} onInvite={setInvitePanel} />
          ))}
        </ul>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map((p) => (
            <ProgramCard key={p.id} p={p} onInvite={setInvitePanel} />
          ))}
        </div>
      )}

      <ProgramFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={() => void fetchPrograms()}
      />

      <InvitationManagePanel
        open={Boolean(invitePanel)}
        programId={invitePanel?.id ?? ''}
        programName={invitePanel?.name ?? ''}
        onClose={() => setInvitePanel(null)}
      />
    </div>
  );
}
