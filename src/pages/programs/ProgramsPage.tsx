// bal24 v2 — 프로그램 목록 페이지
// 리스트/카드 뷰 + 상태 필터 + 유형 필터 + 신규 등록 모달

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { LayoutGrid, List, Plus, Loader2, UserPlus, FolderUp, Building2, Users, MapPin, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
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
import ParticipantMiniList from './ParticipantMiniList';

type ViewMode = 'list' | 'card';
type StatusFilter = ProgramStatus | '전체';
type TypeFilter = ProgramType | '전체';

type ProgramRow = Program & {
  project?: { id: string; name: string } | null;
  participants_count?: { count: number }[] | null;
  sessions_count?: { count: number }[] | null;
};

// consortium join은 일부 환경에서 400 유발 → 선제 제거. consortium_id 는 '*' 로 수신되어 필터 로직 그대로 작동.
// STEP-PROGRAM-DASHBOARD — count join 추가 (참여자·차시)
const SELECT_COLUMNS = '*, project:projects(id,name), participants_count:program_participants(count), sessions_count:program_curriculum(count)';

function programCount(arr?: { count: number }[] | null): number {
  return arr?.[0]?.count ?? 0;
}

function ProgramMeta({ p }: { p: ProgramRow }) {
  const orgLine = [p.client_org, p.department].filter(Boolean).join(' · ');
  const targetLine = p.target_audience
    ? `${p.target_audience}${p.max_participants ? ` · 정원 ${p.max_participants}명` : ''}`
    : null;
  return (
    <div className="space-y-1 text-xs text-slate-600">
      {orgLine && (
        <div className="flex items-center gap-1.5"><Building2 size={11} className="text-slate-400 shrink-0" aria-hidden="true" /><span className="truncate">{orgLine}</span></div>
      )}
      {targetLine && (
        <div className="flex items-center gap-1.5"><Users size={11} className="text-slate-400 shrink-0" aria-hidden="true" /><span className="truncate">{targetLine}</span></div>
      )}
      {(p.start_date || p.end_date) && (
        <div className="flex items-center gap-1.5"><Calendar size={11} className="text-slate-400 shrink-0" aria-hidden="true" /><span>{formatDateKo(p.start_date) || '미정'} ~ {formatDateKo(p.end_date) || '미정'}</span></div>
      )}
      {p.venue && (
        <div className="flex items-center gap-1.5"><MapPin size={11} className="text-slate-400 shrink-0" aria-hidden="true" /><span className="truncate">{p.venue}</span></div>
      )}
    </div>
  );
}

function ProgramStats({ p }: { p: ProgramRow }) {
  return (
    <div className="flex gap-3 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
      <span>참여 <strong className="text-slate-700">{programCount(p.participants_count)}</strong>명</span>
      <span>차시 <strong className="text-slate-700">{programCount(p.sessions_count)}</strong>개</span>
      {p.project && <span>· {p.project.name}</span>}
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

function ProgramListItem({
  p, onInvite, expanded, onToggleExpand,
}: {
  p: ProgramRow; onInvite: (p: ProgramRow) => void;
  expanded: boolean; onToggleExpand: () => void;
}) {
  return (
    <li className="bg-white rounded-xl border border-slate-200 hover:border-primary/30 hover:shadow-sm transition">
      <div className="flex items-start gap-3 p-4">
        <Link to={`/programs/${p.id}`} className="flex-1 min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold text-text truncate">{p.name}</h3>
            <span className={`${BADGE_BASE} ${PROGRAM_STATUS_STYLE[p.status]}`}>{p.status}</span>
            <span className={`${BADGE_BASE} ${PROGRAM_TYPE_STYLE[p.type]}`}>{p.type}</span>
          </div>
          <ProgramMeta p={p} />
          <ProgramStats p={p} />
        </Link>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {/* STEP-OVERVIEW-UI-FULL — 교육생 명단 펼치기 토글 */}
          <button type="button" onClick={onToggleExpand} aria-expanded={expanded}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-slate-600 hover:bg-slate-100 transition-colors">
            명단 {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </button>
          <InviteButton onClick={(e) => { e.preventDefault(); e.stopPropagation(); onInvite(p); }} />
        </div>
      </div>
      {expanded && <ParticipantMiniList programId={p.id} />}
    </li>
  );
}

function ProgramCard({
  p, onInvite, expanded, onToggleExpand,
}: {
  p: ProgramRow; onInvite: (p: ProgramRow) => void;
  expanded: boolean; onToggleExpand: () => void;
}) {
  return (
    <Card className="hover:border-primary/30 hover:shadow-md transition h-full">
      <Link to={`/programs/${p.id}`} className="block">
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
            <p className="text-xs text-slate-500 line-clamp-2 pt-2 border-t border-slate-100">{p.description}</p>
          )}
          <ProgramStats p={p} />
        </CardContent>
      </Link>
      <div className="flex items-center justify-end gap-1 px-6 pb-4">
        {/* STEP-OVERVIEW-UI-FULL — 교육생 명단 펼치기 토글 */}
        <button type="button" onClick={onToggleExpand} aria-expanded={expanded}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-slate-600 hover:bg-slate-100 transition-colors">
          명단 {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
        </button>
        <InviteButton onClick={(e) => { e.preventDefault(); e.stopPropagation(); onInvite(p); }} />
      </div>
      {expanded && <ParticipantMiniList programId={p.id} />}
    </Card>
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
  // STEP-OVERVIEW-UI-FULL — 프로그램 행별 교육생 명단 펼침 상태
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const toggleExpand = (id: string) => setExpandedIds((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // STEP-SCHEDULE-DELETED-FIX — 휴지통 컨소시엄 제외 (deleted_at IS NULL)
      const { data, error } = await supabase.from('consortiums').select('id, name').is('deleted_at', null).in('status', ['구성중', '진행']).order('name', { ascending: true });
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
              {([
                { mode: 'list' as ViewMode, Icon: List,        label: '리스트 보기' },
                { mode: 'card' as ViewMode, Icon: LayoutGrid,  label: '카드 보기' },
              ]).map((v) => (
                <button key={v.mode} type="button" onClick={() => setView(v.mode)}
                  aria-pressed={view === v.mode} aria-label={v.label}
                  className={`inline-flex items-center justify-center w-8 h-8 rounded-md transition-colors ${view === v.mode ? 'bg-primary text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
                  <v.Icon size={16} />
                </button>
              ))}
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
            <ProgramListItem key={p.id} p={p} onInvite={setInvitePanel}
              expanded={expandedIds.has(p.id)} onToggleExpand={() => toggleExpand(p.id)} />
          ))}
        </ul>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map((p) => (
            <ProgramCard key={p.id} p={p} onInvite={setInvitePanel}
              expanded={expandedIds.has(p.id)} onToggleExpand={() => toggleExpand(p.id)} />
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
