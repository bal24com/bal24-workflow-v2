// bal24 v2 — 프로젝트 상세 페이지
// 탭: 개요 / 태스크 / 참여인력 / 파일

import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ClipboardList, FileText, Info, Loader2, Users, FileBarChart, Link2, Wallet } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Badge, Button } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import type { Project } from '../../types/database';
import { useAuth } from '../../contexts/AuthContext';
import { statusToBadgeVariant } from './projectStatus';
import OverviewTab from './detail/OverviewTab';
import TasksTab from './detail/TasksTab';
import MembersTab from './detail/MembersTab';
import FilesTab from './detail/FilesTab';
import PortalTab from './detail/PortalTab';
import GrantLedgerTab from './detail/GrantLedgerTab';
import StageProgressBar from './detail/StageProgressBar';

type DetailProject = Project & {
  client?: { id: string; name: string } | null;
  pm?: { id: string; name: string } | null;
};

type TabKey = 'overview' | 'tasks' | 'members' | 'files' | 'portal' | 'grant';

const TABS: { key: TabKey; label: string; Icon: LucideIcon }[] = [
  { key: 'overview', label: '개요',     Icon: Info },
  { key: 'tasks',    label: '태스크',   Icon: ClipboardList },
  { key: 'members',  label: '참여인력', Icon: Users },
  { key: 'files',    label: '파일',     Icon: FileText },
  { key: 'grant',    label: '지원금',   Icon: Wallet },
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
  const { user } = useAuth();
  const [project, setProject] = useState<DetailProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>('overview');

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setErrorMsg(null);

    supabase
      .from('projects')
      .select(SELECT_COLUMNS)
      .eq('id', id)
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
          <Link to={`/projects/${project.id}/report`} className="shrink-0">
            <Button variant="primary" size="sm" leftIcon={<FileBarChart size={14} />}>
              결과보고서 작성
            </Button>
          </Link>
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
        {tab === 'files' && <FilesTab projectId={projectId} uploaderId={user?.id} />}
        {tab === 'grant' && <GrantLedgerTab projectId={projectId} />}
        {tab === 'portal' && <PortalTab projectId={projectId} clientId={project.client_id ?? null} />}
      </div>
    </div>
  );
}
