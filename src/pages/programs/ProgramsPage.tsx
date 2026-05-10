// bal24 v2 — 프로그램 목록 페이지
// 리스트/카드 뷰 + 상태 필터 + 유형 필터 + 신규 등록 모달

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { LayoutGrid, List, Plus, Loader2, UserPlus, FolderUp } from 'lucide-react';
import {
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
} from './programStatus';
import { PROGRAM_TYPE_STYLE, PROGRAM_STATUS_STYLE, BADGE_BASE } from '../../utils/statusStyles';
import EmptyState from '../../components/EmptyState';
import PageHelpBanner from '../../components/PageHelpBanner';
import ConsortiumFilterTabs, {
  type ConsortiumFilter,
  type ConsortiumOption,
} from '../../components/ConsortiumFilterTabs';
import { useToast } from '../../contexts/ToastContext';
import { useUserProfile } from '../../hooks/useUserProfile';
import ProgramFormModal from './ProgramFormModal';
import BulkProgramModal from './BulkProgramModal';
import ProgramsFilterTabs from './ProgramsFilterTabs';
import InvitationManagePanel from './InvitationManagePanel';
import { useMemberProgramIds } from './useMemberProgramIds';

type ViewMode = 'list' | 'card';
type StatusFilter = ProgramStatus | '전체';
type TypeFilter = ProgramType | '전체';

type ProgramRow = Program & {
  project?: { id: string; name: string } | null;
};

// consortium join은 일부 환경에서 400 유발 → 선제 제거. consortium_id 는 '*' 로 수신되어 필터 로직 그대로 작동.
const SELECT_COLUMNS = '*, project:projects(id,name)';

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
    <li className="bg-white rounded-xl border border-slate-200 hover:border-primary/30 hover:shadow-sm transition">
      <Link to={`/programs/${p.id}`} className="flex items-start gap-3 p-4">
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold text-text truncate">{p.name}</h3>
            <span className={`${BADGE_BASE} ${PROGRAM_STATUS_STYLE[p.status]}`}>{p.status}</span>
            <span className={`${BADGE_BASE} ${PROGRAM_TYPE_STYLE[p.type]}`}>{p.type}</span>
          </div>
          <ProgramMeta p={p} />
        </div>
        <InviteButton onClick={(e) => { e.preventDefault(); e.stopPropagation(); onInvite(p); }} />
      </Link>
    </li>
  );
}

function ProgramCard({ p, onInvite }: { p: ProgramRow; onInvite: (p: ProgramRow) => void }) {
  return (
    <Link to={`/programs/${p.id}`} className="block h-full">
      <Card className="hover:border-primary/30 hover:shadow-md transition h-full">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="truncate">{p.name}</CardTitle>
            <span className={`${BADGE_BASE} ${PROGRAM_STATUS_STYLE[p.status]}`}>{p.status}</span>
          </div>
          <CardDescription>
            <span className={`${BADGE_BASE} ${PROGRAM_TYPE_STYLE[p.type]}`}>{p.type}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <ProgramMeta p={p} />
          {p.description && (
            <p className="text-xs text-muted line-clamp-2">{p.description}</p>
          )}
          <div className="pt-2 border-t border-slate-100 flex justify-end">
            <InviteButton onClick={(e) => { e.preventDefault(); e.stopPropagation(); onInvite(p); }} />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function ProgramsPage() {
  const toast = useToast();
  // STEP-ROLE-NORMALIZE — 컨소시엄 참여기관 필터링에는 hasConsortiumMembership 사용
  const { profile, hasConsortiumMembership, isPM } = useUserProfile();
  const { programIds: myProgramIds } = useMemberProgramIds(
    hasConsortiumMembership ? profile?.consortium_member_id ?? null : null,
  );
  const [programs, setPrograms] = useState<ProgramRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>('list');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('전체');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('전체');
  const [filterConsortiumId, setFilterConsortiumId] = useState<ConsortiumFilter>(null);
  const [consortiums, setConsortiums] = useState<ConsortiumOption[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [invitePanel, setInvitePanel] = useState<ProgramRow | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase.from('consortiums').select('id, name').in('status', ['구성중', '진행']).order('name', { ascending: true });
      if (cancelled) return;
      if (error) { console.error('[programs] 컨소시엄 조회 실패:', error.message); return; }
      setConsortiums((data as ConsortiumOption[] | null) ?? []);
    })();
    return () => { cancelled = true; };
  }, []);

  const fetchPrograms = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('programs').select(SELECT_COLUMNS).order('created_at', { ascending: false });
      if (error) throw error;
      setPrograms((data ?? []) as ProgramRow[]);
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[programs] 목록 조회 실패:', raw);
      const m = raw.toLowerCase();
      const missing = m.includes("could not find the table 'public.programs'") || m.includes('pgrst205');
      toast.error(missing
        ? '프로그램 테이블이 아직 적용되지 않았어요. Supabase에서 마이그레이션을 실행해 주세요.'
        : '프로그램 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  }, [toast]);

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
    return programs.filter((p) => {
      // Q3-A: 컨소시엄 참여기관 사용자는 본인 배정만 표시. PM/ADMIN 은 전체.
      if (hasConsortiumMembership && !isPM && !myProgramIds.includes(p.id)) return false;
      if (statusFilter !== '전체' && p.status !== statusFilter) return false;
      if (typeFilter !== '전체' && p.type !== typeFilter) return false;
      if (filterConsortiumId === 'none' && p.consortium_id) return false;
      if (filterConsortiumId && filterConsortiumId !== 'none' && p.consortium_id !== filterConsortiumId) return false;
      return true;
    });
  }, [programs, statusFilter, typeFilter, filterConsortiumId, hasConsortiumMembership, isPM, myProgramIds]);

  return (
    <div className="space-y-5 max-w-[1400px]">
      <h1 className="text-2xl font-bold text-[#1E1B4B] flex items-center gap-2">
        <span aria-hidden="true">🎓</span>
        프로그램
      </h1>
      <PageHelpBanner
        lines={[
          '✦ 교육·캠프·행사·세미나·이벤트·워크숍 등 13종 유형 지원',
          '✦ 유형별 표시 모듈을 골라 상세 탭 구성을 자동으로 맞춤화',
          '💡 카드 클릭 → 상세에서 커리큘럼·강사·교육생·출석·멘토링·강사료·결과보고서까지 일괄 관리',
        ]}
      />
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1.5">
            <div className="text-xs font-semibold text-slate-500">상태</div>
            <ProgramsFilterTabs<StatusFilter>
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
              variant="outline"
              leftIcon={<FolderUp size={16} />}
              onClick={() => setBulkOpen(true)}
            >
              일괄 등록
            </Button>

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
          <ProgramsFilterTabs<TypeFilter>
            values={['전체', ...PROGRAM_TYPE_VALUES]}
            value={typeFilter}
            onChange={setTypeFilter}
            counts={typeCounts}
            ariaLabel="유형 필터"
          />
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
          emoji="🎓"
          title={statusFilter === '전체' && typeFilter === '전체' ? '아직 등록된 프로그램이 없어요.' : '조건에 맞는 프로그램이 없어요.'}
          description={statusFilter === '전체' && typeFilter === '전체' ? '첫 프로그램을 만들어 보세요.' : undefined}
          action={
            statusFilter === '전체' && typeFilter === '전체' && (
              <Button variant="primary" leftIcon={<Plus size={14} />} onClick={() => setModalOpen(true)}>
                + 프로그램 등록
              </Button>
            )
          }
        />
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

      <BulkProgramModal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        onSuccess={() => void fetchPrograms()}
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
