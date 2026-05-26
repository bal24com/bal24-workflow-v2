// bal24 v2 — 컨소시엄 독립 홈 (STEP-CON 7탭 허브)
// 헤더 + 진행 바 + 사이드 요약 카드 + 탭 네비게이션 + 탭 컨텐츠

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft, Loader2, Building2, Briefcase, GraduationCap, ListChecks,
  Wallet, Users, Share2, ShieldCheck, Pencil, Check, FolderOpen,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';
import { Button } from '../../components/ui';
import { Trash2, Receipt } from 'lucide-react';
import { softDelete } from '../../lib/softDeleteUtils';
import { useUserProfile } from '../../hooks/useUserProfile';
import { useNavigate } from 'react-router-dom';
import {
  CONSORTIUM_STATUS,
  MEMBER_TYPE_LABEL,
  MEMBER_TYPE_STYLE,
  type ConsortiumMember,
  type ConsortiumStatus,
  type MemberType,
} from './consortiumTypes';
import {
  formatConDate,
  formatKRW,
  getStageIndex,
  getStatusBadgeClass,
} from './consortiumUtils';
import ConOverviewTab from './detail/ConOverviewTab';
import ConMembersTab from './detail/ConMembersTab';
import ConProgramsTab from './detail/ConProgramsTab';
import ConEstimateTab from './detail/ConEstimateTab'; // STEP-CONSORTIUM-UPGRADE-FULL PART B (2026-05-28)
import ConTasksTab from './detail/ConTasksTab';
import ConFinanceTab from './detail/ConFinanceTab';
import ConStaffTab from './detail/ConStaffTab';
import ConLinksTab from './detail/ConLinksTab';
import ConPortalTab from './detail/ConPortalTab';
import ConsortiumFilesTab from './ConsortiumFilesTab';
import ConsortiumFormModal from './ConsortiumFormModal';

interface ConsortiumDetail {
  id: string;
  name: string;
  status: ConsortiumStatus;
  start_date: string | null;
  end_date: string | null;
  total_budget: number | null;
  description: string | null;
  lead_client_id: string | null;
  project_id: string | null;
  lead_client: { id: string; name: string } | null;
  project: { id: string; name: string } | null;
}

type TabKey = 'overview' | 'members' | 'programs' | 'tasks' | 'estimate' | 'finance' | 'staff' | 'links' | 'portal' | 'files';

// STEP-CONSORTIUM-REDESIGN (박경수님 2026-05-27) — [참여사] 탭 신규 (개요 다음).
const TAB_LIST: Array<{ key: TabKey; label: string; Icon: typeof Briefcase }> = [
  { key: 'overview', label: '개요', Icon: Building2 },
  { key: 'members', label: '참여사', Icon: Users },
  { key: 'programs', label: '프로그램', Icon: GraduationCap },
  { key: 'tasks', label: '태스크', Icon: ListChecks },
  { key: 'estimate', label: '견적', Icon: Receipt },
  { key: 'finance', label: '재무', Icon: Wallet },
  { key: 'staff', label: '인력·자원', Icon: Users },
  { key: 'links', label: '외부공유', Icon: Share2 },
  { key: 'portal', label: '포털', Icon: ShieldCheck },
  { key: 'files', label: '파일', Icon: FolderOpen },
];

// 0515 마이그레이션이 일부 적용 안 됐을 가능성 — internal_manager_id·currency·해당 FK 제거하여 안전한 핵심 컬럼만 사용
const SELECT_COLUMNS = `
  id, name, status, start_date, end_date, total_budget, description,
  lead_client_id, project_id,
  lead_client:clients!consortiums_lead_client_id_fkey(id, name),
  project:projects!consortiums_project_id_fkey(id, name)
`.replace(/\s+/g, ' ');

interface CountSummary {
  programs: number;
  tasks: number;
}

export default function ConsortiumDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const { isAdmin } = useUserProfile();
  const [consortium, setConsortium] = useState<ConsortiumDetail | null>(null);
  const [members, setMembers] = useState<ConsortiumMember[]>([]);
  const [counts, setCounts] = useState<CountSummary>({ programs: 0, tasks: 0 });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>('overview');
  const [editOpen, setEditOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // STEP-DELETE-RESUME-FULL — soft-delete (admin 전용)
  async function handleDeleteConsortium() {
    if (!consortium) return;
    if (!window.confirm(`"${consortium.name}" 컨소시엄을 삭제할까요? 30일 후 자동으로 완전 삭제됩니다.`)) return;
    setDeleting(true);
    const err = await softDelete('consortiums', consortium.id);
    setDeleting(false);
    if (err) { toast.error(err); return; }
    toast.success('컨소시엄을 휴지통으로 이동했어요.');
    navigate('/consortium');
  }

  const loadConsortium = useCallback(async () => {
    if (!id) return;
    try {
      const [{ data: c, error: cErr }, { data: m, error: mErr }, { count: pCount }, { count: tCount }] = await Promise.all([
        // STEP-TRASH-FILTER-AUDIT — 휴지통 컨소시엄 URL 직접 접근 차단
        supabase.from('consortiums').select(SELECT_COLUMNS).eq('id', id).is('deleted_at', null).maybeSingle(),
        supabase
          .from('consortium_members')
          .select('*, clients!consortium_members_client_id_fkey(id, name, business_name)')
          .eq('consortium_id', id),
        supabase.from('programs').select('id', { count: 'exact', head: true }).eq('consortium_id', id).is('deleted_at', null),
        supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('consortium_id', id).is('deleted_at', null),
      ]);
      if (cErr) console.error('[consortium-detail] 컨소시엄 조회 실패:', cErr.message);
      if (mErr) console.error('[consortium-detail] 참여사 조회 실패:', mErr.message);
      setConsortium((c as ConsortiumDetail | null) ?? null);
      setMembers((m as ConsortiumMember[] | null) ?? []);
      setCounts({ programs: pCount ?? 0, tasks: tCount ?? 0 });
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[consortium-detail] 데이터 로드 실패:', raw);
      toast.error('컨소시엄 정보를 불러오지 못했어요.');
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      await loadConsortium();
      if (cancelled) return;
    })();
    return () => { cancelled = true; };
  }, [loadConsortium]);

  const stageIdx = useMemo(
    () => (consortium ? getStageIndex(consortium.status) : 0),
    [consortium],
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="animate-spin text-violet-400" size={28} aria-hidden="true" />
      </div>
    );
  }

  if (!consortium || !id) {
    return (
      <div className="rounded-2xl border border-rose-100 bg-white p-12 text-center">
        <p className="text-lg font-bold text-[#1E1B4B] mb-2">컨소시엄을 찾을 수 없어요</p>
        <Link to="/consortium" className="text-sm text-violet-600 hover:underline">목록으로 돌아가기</Link>
      </div>
    );
  }

  const TabContent: Record<TabKey, ReactNode> = {
    overview: <ConOverviewTab consortiumId={id} totalBudget={Number(consortium.total_budget ?? 0)} members={members} description={consortium.description} />,
    members:  <ConMembersTab  consortiumId={id} totalBudget={Number(consortium.total_budget ?? 0)} />,
    programs: <ConProgramsTab consortiumId={id} members={members} />,
    // STEP-CONSORTIUM-UPGRADE-FULL PART B (2026-05-28) — 견적 탭
    estimate: <ConEstimateTab consortiumId={id} projectId={consortium.project_id ?? null} totalBudget={Number(consortium.total_budget ?? 0)} members={members} />,
    tasks: <ConTasksTab consortiumId={id} members={members} />,
    finance: <ConFinanceTab consortiumId={id} totalBudget={Number(consortium.total_budget ?? 0)} members={members} />,
    staff: <ConStaffTab consortiumId={id} />,
    links: <ConLinksTab consortiumId={id} />,
    portal: <ConPortalTab consortiumId={id} status={consortium.status} members={members} />,
    files: <ConsortiumFilesTab consortiumId={id} />,
  };

  return (
    <div className="space-y-5 max-w-[1400px]">
      {/* 헤더 */}
      <div className="space-y-3">
        <Link to="/consortium" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-violet-600">
          <ArrowLeft size={14} aria-hidden="true" />
          컨소시엄 목록
        </Link>

        <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-[#1E1B4B] flex items-center gap-2">
                <span aria-hidden="true">🤝</span>
                {consortium.name}
              </h1>
              <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-md border ${getStatusBadgeClass(consortium.status)}`}>
                {consortium.status}
              </span>
            </div>
            {/* 박경수님 2026-05-27 A안 — 의뢰기관(주관기관) 라벨 강조 */}
            {consortium.lead_client && (
              <div className="inline-flex items-center gap-1.5 text-sm">
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-violet-100 text-violet-700 border border-violet-200">
                  의뢰기관
                </span>
                <span className="font-semibold text-[#1E1B4B]">{consortium.lead_client.name}</span>
                <span className="text-[10px] text-slate-400">(주관기관)</span>
              </div>
            )}
            <div className="text-xs text-slate-500">
              {formatConDate(consortium.start_date)} ~ {formatConDate(consortium.end_date)}
              {consortium.project && (
                <span className="ml-2">· 연결 프로젝트 <Link to={`/projects/${consortium.project.id}`} className="text-violet-600 hover:underline">{consortium.project.name}</Link></span>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {members.map((m) => (
                <span
                  key={m.id}
                  className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md border ${MEMBER_TYPE_STYLE[m.member_type as MemberType] ?? MEMBER_TYPE_STYLE.observer}`}
                  title={`${MEMBER_TYPE_LABEL[m.member_type as MemberType]} · 지분율 ${m.task_share_pct}%`}
                >
                  <span className="opacity-70">{MEMBER_TYPE_LABEL[m.member_type as MemberType]}</span>
                  <span className="font-bold">{m.clients?.name ?? '미지정'}</span>
                </span>
              ))}
              {members.length === 0 && (
                <span className="text-xs text-slate-400 italic">참여사 미등록</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil size={14} className="mr-1" aria-hidden="true" />
              수정
            </Button>
            {/* STEP-DELETE-RESUME-FULL — 컨소시엄 삭제 (admin 전용) */}
            {isAdmin && (
              <Button variant="outline" size="sm" onClick={() => void handleDeleteConsortium()} disabled={deleting}
                className="!border-rose-300 !text-rose-600 hover:!bg-rose-50">
                <Trash2 size={14} className="mr-1" aria-hidden="true" />
                {deleting ? '삭제 중…' : '삭제'}
              </Button>
            )}
          </div>
        </header>

        {/* 진행 바 */}
        <div className="rounded-2xl border border-violet-100 bg-white p-3 shadow-[0_4px_16px_rgba(124,58,237,0.06)]">
          <div className="flex items-center justify-between gap-2">
            {CONSORTIUM_STATUS.map((s, idx) => {
              const reached = idx <= stageIdx;
              const isCurrent = idx === stageIdx;
              return (
                <div key={s} className="flex-1 flex items-center gap-2">
                  <div
                    className={`flex items-center justify-center w-7 h-7 rounded-full text-[11px] font-bold shrink-0 ${
                      isCurrent
                        ? 'bg-violet-600 text-white'
                        : reached
                          ? 'bg-violet-100 text-violet-700'
                          : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {reached && !isCurrent ? <Check size={14} aria-hidden="true" /> : idx + 1}
                  </div>
                  <span className={`text-xs font-semibold whitespace-nowrap ${isCurrent ? 'text-violet-700' : reached ? 'text-violet-500' : 'text-slate-400'}`}>{s}</span>
                  {idx < CONSORTIUM_STATUS.length - 1 && (
                    <div className={`flex-1 h-0.5 ${reached ? 'bg-violet-200' : 'bg-slate-200'}`} aria-hidden="true" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2단 레이아웃 */}
      <div className="flex flex-col lg:flex-row gap-5">
        {/* 사이드 요약 */}
        <aside className="lg:w-64 shrink-0 space-y-3">
          <div className="rounded-2xl border border-violet-100 bg-white p-4 shadow-[0_4px_16px_rgba(124,58,237,0.06)] space-y-2">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wide">요약</div>
            {/* 박경수님 2026-05-27 A안 — 사이드 요약에도 의뢰기관 강조 */}
            <SummaryRow label="의뢰기관" value={consortium.lead_client?.name ?? '미지정'} />
            <SummaryRow label="총사업비" value={formatKRW(Number(consortium.total_budget ?? 0))} />
            <SummaryRow label="기간" value={`${formatConDate(consortium.start_date)} ~ ${formatConDate(consortium.end_date)}`} />
            <SummaryRow label="참여사" value={`${members.length}곳`} />
            <SummaryRow label="프로그램" value={`${counts.programs}건`} />
            <SummaryRow label="태스크" value={`${counts.tasks}건`} />
          </div>

          {members.length > 0 && (
            <div className="rounded-2xl border border-violet-100 bg-white p-4 shadow-[0_4px_16px_rgba(124,58,237,0.06)]">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">참여사 목록</div>
              <ul className="space-y-1.5">
                {members.map((m) => (
                  <li key={m.id} className="flex items-center gap-1.5 text-xs">
                    <span className={`inline-flex text-[10px] font-semibold px-1.5 py-0.5 rounded ${MEMBER_TYPE_STYLE[m.member_type as MemberType] ?? MEMBER_TYPE_STYLE.observer}`}>
                      {MEMBER_TYPE_LABEL[m.member_type as MemberType]}
                    </span>
                    <span className="text-slate-700 truncate flex-1">{m.clients?.name ?? '미지정'}</span>
                    <span className="text-slate-400 tabular-nums shrink-0">{m.task_share_pct}%</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>

        {/* 탭 영역 */}
        <section className="flex-1 min-w-0 space-y-4">
          <nav role="tablist" className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto" aria-label="컨소시엄 탭">
            {TAB_LIST.map((t) => {
              const Icon = t.Icon;
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(t.key)}
                  className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                    active ? 'text-violet-700 border-violet-600' : 'text-slate-500 border-transparent hover:text-slate-700'
                  }`}
                >
                  <Icon size={14} aria-hidden="true" />
                  {t.label}
                </button>
              );
            })}
          </nav>

          <div>{TabContent[tab]}</div>
        </section>
      </div>

      <ConsortiumFormModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onCreated={() => {
          setEditOpen(false);
          void loadConsortium();
        }}
        initialData={{
          id: consortium.id,
          name: consortium.name,
          description: consortium.description ?? '',
          lead_client_id: consortium.lead_client_id ?? null,
          project_id: consortium.project_id ?? null,
          status: consortium.status,
          start_date: consortium.start_date ?? '',
          end_date: consortium.end_date ?? '',
          total_budget: consortium.total_budget ?? null,
        }}
      />
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-[#1E1B4B] truncate">{value}</span>
    </div>
  );
}
