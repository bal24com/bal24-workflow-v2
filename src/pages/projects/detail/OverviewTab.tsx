// bal24 v2 — 프로젝트 상세 · 개요 탭 (V7 → V2 이식)
// 3열 그리드: 좌(재무·참여자·이벤트) / 중앙(기존 기본정보·설명) / 우(활동·다음행동·빠른액션)

import { Badge, Card, CardContent, CardHeader, CardTitle } from '../../../components/ui';
import { formatDateKo, formatMoney } from '../../../lib/utils';
import type { Project, ProjectStatus } from '../../../types/database';
import { statusToBadgeVariant } from '../projectStatus';
import FinanceSummaryCard from './overview/FinanceSummaryCard';
import MembersPreviewCard from './overview/MembersPreviewCard';
import EventsTimelineCard from './overview/EventsTimelineCard';
import ActivityTimelineCard from './overview/ActivityTimelineCard';
import NextActionCard from './overview/NextActionCard';
import QuickActionsCard from './overview/QuickActionsCard';

type DetailProject = Project & {
  client?: { id: string; name: string } | null;
  pm?: { id: string; name: string } | null;
};

type Props = {
  project: DetailProject;
  onOpenTab?: (tab: 'tasks' | 'members') => void;
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <div className="text-xs text-muted">{label}</div>
      <div className="text-sm text-text font-medium">{children}</div>
    </div>
  );
}

export default function OverviewTab({ project, onOpenTab }: Props) {
  const status: ProjectStatus = project.status;
  const projectId = project.id;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)] gap-4">
      {/* 좌 컬럼 */}
      <div className="flex flex-col gap-4 min-w-0">
        <FinanceSummaryCard projectId={projectId} />
        <MembersPreviewCard
          projectId={projectId}
          pmName={project.pm?.name ?? null}
          clientName={project.client?.name ?? null}
          onOpenMembersTab={onOpenTab ? () => onOpenTab('members') : undefined}
        />
        <EventsTimelineCard projectId={projectId} />
      </div>

      {/* 중앙 컬럼 — 기존 기본정보·설명 유지 */}
      <div className="flex flex-col gap-4 min-w-0">
        <Card>
          <CardHeader>
            <CardTitle>기본 정보</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
              <Field label="상태">
                <Badge variant={statusToBadgeVariant(status)}>{status}</Badge>
              </Field>
              <Field label="유형">
                {project.type?.length ? project.type.join(' · ') : '미지정'}
              </Field>
              <Field label="기간">
                {(project.start_date || project.end_date)
                  ? `${formatDateKo(project.start_date) || '미정'} ~ ${formatDateKo(project.end_date) || '미정'}`
                  : '미정'}
              </Field>
              <Field label="예산">
                {project.budget != null ? formatMoney(project.budget) : '미정'}
              </Field>
              <Field label="담당자">{project.pm?.name ?? '미지정'}</Field>
              <Field label="고객사">{project.client?.name ?? '미지정'}</Field>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>설명</CardTitle>
          </CardHeader>
          <CardContent>
            {project.description ? (
              <p className="text-sm text-text whitespace-pre-wrap leading-relaxed">
                {project.description}
              </p>
            ) : (
              <p className="text-sm text-muted">아직 설명이 없어요.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 우 컬럼 */}
      <div className="flex flex-col gap-4 min-w-0">
        <ActivityTimelineCard projectId={projectId} />
        <NextActionCard status={status} />
        <QuickActionsCard
          projectId={projectId}
          consortiumId={project.consortium_id ?? null}
          onOpenTasksTab={onOpenTab ? () => onOpenTab('tasks') : undefined}
        />
      </div>
    </div>
  );
}
