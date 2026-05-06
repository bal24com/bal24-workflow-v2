// bal24 v2 — 프로젝트 상세 · 개요 탭
// 기본정보 (상태배지, 기간, 예산, 담당자, 고객사, 설명)

import { Badge, Card, CardContent, CardHeader, CardTitle } from '../../../components/ui';
import { formatDateKo, formatMoney } from '../../../lib/utils';
import type { Project, ProjectStatus } from '../../../types/database';
import { statusToBadgeVariant } from '../projectStatus';

type Props = {
  project: Project & {
    client?: { id: string; name: string } | null;
    pm?: { id: string; name: string } | null;
  };
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <div className="text-xs text-muted">{label}</div>
      <div className="text-sm text-text font-medium">{children}</div>
    </div>
  );
}

export default function OverviewTab({ project }: Props) {
  const status: ProjectStatus = project.status;

  return (
    <div className="space-y-4">
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
            <Field label="담당자">
              {project.pm?.name ?? '미지정'}
            </Field>
            <Field label="고객사">
              {project.client?.name ?? '미지정'}
            </Field>
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
  );
}
