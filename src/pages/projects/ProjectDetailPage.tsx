// bal24 v2 — 프로젝트 상세 페이지
// 탭: 개요 / 태스크 / 참여인력 / 파일

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ClipboardList, Info, Loader2, Users, Link2, Wallet, BookOpen, FolderArchive, Trash2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Badge, Button } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import type { Project } from '../../types/database';
import { statusToBadgeVariant } from './projectStatus';
import { softDelete } from '../../lib/softDeleteUtils';
import { useToast } from '../../contexts/ToastContext';
import { useUserProfile } from '../../hooks/useUserProfile';
import OverviewTab from './detail/OverviewTab';
import TasksTab from './detail/TasksTab';
import MembersTab from './detail/MembersTab';
import PortalTab from './detail/PortalTab';
import GrantLedgerTab from './detail/GrantLedgerTab';
import ProjectProgramsTab from './detail/ProjectProgramsTab';
import ProjectDocsTab from './detail/ProjectDocsTab';
import StageProgressBar from './detail/StageProgressBar';

type DetailProject = Project & {
  client?: { id: string; name: string } | null;
  pm?: { id: string; name: string } | null;
};

type TabKey = 'overview' | 'programs' | 'tasks' | 'grant' | 'docs' | 'members' | 'portal';

const TABS: { key: TabKey; label: string; Icon: LucideIcon }[] = [
  { key: 'overview', label: '개요',     Icon: Info },
  { key: 'programs', label: '프로그램', Icon: BookOpen },
  { key: 'tasks',    label: '태스크',   Icon: ClipboardList },
  { key: 'grant',    label: '지원금',   Icon: Wallet },
  { key: 'docs',     label: '문서',     Icon: FolderArchive },
  { key: 'members',  label: '참여인력', Icon: Users },
  { key: 'portal',   label: '포털',     Icon: Link2 },
];

// projects → profiles FK가 두 개(pm_id, created_by) 있어 명시적 별칭 필요 (PGRST201 방지)
const SELECT_COLUMNS = '*, client:clients(id,name), pm:profiles!projects_pm_id_fkey(id,name)';

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 text-xl mb-2">
        🔍
      </div>
      <p className="text-sm text-muted mb-3">프로젝트를 찾을 수 없어요.</p>
      <Link
        to="/projects"
        className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
      >
        <ArrowLeft size={14} />
        프로젝트 목록으로
      </Link>
    </div>
  );
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const { isAdmin, isPM } = useUserProfile();
  const [project, setProject] = useState<DetailProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>('overview');
  const [deleting, setDeleting] = useState(false);

  // STEP-DELETE-RESUME-FULL — soft-delete (휴지통 30일 보관, admin/PM만)
  async function handleDeleteProject() {
    if (!project) return;
    if (!window.confirm(`"${project.name}" 프로젝트를 삭제할까요?\n연관된 프로그램·태스크는 유지되며 30일 후 완전 삭제됩니다.`)) return;
    setDeleting(true);
    const err = await softDelete('projects', project.id);
    setDeleting(false);
    if (err) { toast.error(err); return; }
    toast.success('프로젝트를 휴지통으로 이동했어요.');
    navigate('/projects');
  }

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setErrorMsg(null);

    // STEP-TRASH-FILTER-AUDIT — 휴지통 프로젝트 URL 직접 접근 차단
    supabase
      .from('projects')
      .select(SELECT_COLUMNS)
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error('[project-detail] 조회 실패:', error.message);
          setErrorMsg('프로젝트 정보를 불러오지 못했어요.');
        } else {
          setProject((data ?? null) as DetailProject | null);
        }
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  const projectId = useMemo(() => id ?? '', [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-muted">
        <Loader2 size={18} className="animate-spin mr-2" />
        불러오는 중…
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="space-y-3">
        <div role="alert" className="rounded-xl bg-danger/10 border border-danger/20 px-4 py-3 text-sm text-danger">
          {errorMsg}
        </div>
        <Link to="/projects" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
          <ArrowLeft size={14} />
          프로젝트 목록으로
        </Link>
      </div>
    );
  }

  if (!project) return <NotFound />;

  return (
    <div className="space-y-5 max-w-[1400px]">
      <div className="space-y-2">
        <Link
          to="/projects"
          className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-primary"
        >
          <ArrowLeft size={12} />
          프로젝트 목록
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold text-text">{project.name}</h1>
              <Badge variant={statusToBadgeVariant(project.status)}>{project.status}</Badge>
            </div>
            <div className="text-xs text-muted">
              {project.type?.length ? project.type.join(' · ') : '유형 미지정'}
              {project.client?.name && ` · 고객사 ${project.client.name}`}
              {project.pm?.name && ` · 담당자 ${project.pm.name}`}
            </div>
          </div>
          {/* STEP-DELETE-RESUME-FULL — 삭제 버튼 (admin/PM 전용) */}
          {(isAdmin || isPM) && (
            <Button variant="outline" leftIcon={<Trash2 size={14} />}
              onClick={() => void handleDeleteProject()} disabled={deleting}
              className="!border-rose-300 !text-rose-600 hover:!bg-rose-50">
              {deleting ? '삭제 중…' : '삭제'}
            </Button>
          )}
        </div>
      </div>

      <StageProgressBar status={project.status} />

      <nav
        role="tablist"
        aria-label="프로젝트 상세 탭"
        className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto"
      >
        {TABS.map(({ key, label, Icon }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(key)}
              className={[
                'inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors',
                active
                  ? 'text-primary border-primary'
                  : 'text-slate-500 border-transparent hover:text-text',
              ].join(' ')}
            >
              <Icon size={15} />
              {label}
            </button>
          );
        })}
      </nav>

      <div role="tabpanel">
        {tab === 'overview' && (
          <OverviewTab
            project={project}
            onOpenTab={(t) => setTab(t)}
          />
        )}
        {tab === 'tasks' && <TasksTab projectId={projectId} />}
        {tab === 'members' && <MembersTab projectId={projectId} />}
        {tab === 'grant' && <GrantLedgerTab projectId={projectId} />}
        {tab === 'portal' && <PortalTab projectId={projectId} clientId={project.client_id ?? null} />}
        {tab === 'programs' && <ProjectProgramsTab projectId={projectId} />}
        {tab === 'docs'     && <ProjectDocsTab    projectId={projectId} />}
      </div>
    </div>
  );
}
