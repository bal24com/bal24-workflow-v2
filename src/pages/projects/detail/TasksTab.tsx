// bal24 v2 — 프로젝트 상세 · 태스크 탭
// 목록 + 상태(인식/실행/검토/완료) + D-day 표시

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '../../../components/ui';
import { supabase } from '../../../lib/supabase';
import { formatDateKo } from '../../../lib/utils';
import type { Task } from '../../../types/database';
import { taskStatusToBadgeVariant } from './taskStatus';
import { computeDDay } from './dDay';

type TaskRow = Task & {
  assignee?: { id: string; name: string } | null;
};

type Props = {
  projectId: string;
};

const SELECT_COLUMNS = '*, assignee:profiles(id,name)';

function DDayBadge({ dueDate }: { dueDate?: string | null }) {
  const dday = computeDDay(dueDate);
  if (!dday) return <span className="text-xs text-slate-400">기한 미정</span>;
  const tone = dday.diffDays > 0
    ? 'bg-danger/10 text-danger'
    : dday.diffDays === 0
    ? 'bg-warning/10 text-warning'
    : 'bg-slate-100 text-slate-600';
  return (
    <span className={['inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold', tone].join(' ')}>
      {dday.label}
    </span>
  );
}

export default function TasksTab({ projectId }: Props) {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErrorMsg(null);

    supabase
      .from('tasks')
      .select(SELECT_COLUMNS)
      .eq('project_id', projectId)
      .order('seq_num', { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error('[tasks] 조회 실패:', error.message);
          setErrorMsg('태스크 목록을 불러오지 못했어요.');
        } else {
          setTasks((data ?? []) as TaskRow[]);
        }
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted">
        <Loader2 size={16} className="animate-spin mr-2" />
        불러오는 중…
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div role="alert" className="rounded-xl bg-danger/10 border border-danger/20 px-4 py-3 text-sm text-danger">
        {errorMsg}
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-400 text-xl mb-2">
            📋
          </div>
          <p className="text-sm text-muted">아직 등록된 태스크가 없어요.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>태스크 ({tasks.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-slate-100 -mx-1">
          {tasks.map((t) => (
            <li key={t.id} className="flex items-start gap-3 py-3 px-1">
              <span className="inline-flex items-center justify-center min-w-[2rem] h-6 text-[10px] font-bold text-slate-400 bg-slate-50 rounded">
                #{t.seq_num}
              </span>
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-text truncate">{t.title}</h3>
                  <Badge variant={taskStatusToBadgeVariant(t.status)}>{t.status}</Badge>
                  <DDayBadge dueDate={t.due_date} />
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                  <span>
                    담당{' '}
                    <span className="text-slate-700 font-medium">
                      {t.assignee?.name ?? '미지정'}
                    </span>
                  </span>
                  {t.due_date && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>마감 {formatDateKo(t.due_date)}</span>
                    </>
                  )}
                  <span aria-hidden="true">·</span>
                  <span>우선순위 {t.priority}</span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
