// bal24 v2 — 통합 일지 목록 (5탭 + 프로그램·기간 필터)

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Plus, Loader2, Calendar, MapPin, Users, Edit3, Trash2, FileIcon, Send,
} from 'lucide-react';
import { Badge, Button, Card, CardContent } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { formatDateKo } from '../../lib/utils';
import { copyToClipboard } from '../../lib/clipboard';
import { useToast } from '../../contexts/ToastContext';
import EmptyState from '../../components/EmptyState';
import { LOG_TYPE_LABELS, LOG_TYPE_VALUES } from './activityLogTypes';
import type {
  ActivityLog,
  ActivityLogType,
  Program,
  Project,
  StaffPool,
} from '../../types/database';
import ActivityLogFormModal from './ActivityLogFormModal';
import ActivityLogDetailModal from './ActivityLogDetailModal';

type LogRow = ActivityLog & {
  program?: { id: string; name: string } | null;
  project?: { id: string; name: string } | null;
  expert?: { id: string; name: string } | null;
};

// activity_logs.expert_id는 ALTER TABLE로 추가되면서 staff_pool FK가 누락된 상태.
// program/project만 join으로 가져오고, expert는 별도로 fetch한 staff_pool 목록과 메모리에서 매핑.
const SELECT_COLUMNS =
  '*, program:programs(id,name), project:projects(id,name)';

export default function ActivityLogsPage() {
  const toast = useToast();
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [programs, setPrograms] = useState<Pick<Program, 'id' | 'name'>[]>([]);
  const [projects, setProjects] = useState<Pick<Project, 'id' | 'name'>[]>([]);
  const [experts, setExperts] = useState<Pick<StaffPool, 'id' | 'name'>[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleCopyLogLink = async (logId: string) => {
    // log_token 컬럼이 ALTER 추가됐다고 가정 — 없으면 toast 안내
    const { data, error } = await supabase
      .from('activity_logs')
      .select('log_token')
      .eq('id', logId)
      .maybeSingle();
    if (error || !data) {
      console.error('[activity-logs] log_token 조회 실패:', error?.message);
      toast.error('외부 작성 링크를 가져오지 못했어요. log_token 컬럼을 확인해 주세요.');
      return;
    }
    const tokenValue = (data as { log_token?: string | null }).log_token;
    if (!tokenValue) {
      toast.warning('외부 작성 토큰이 발급되지 않았어요.');
      return;
    }
    const url = `${window.location.origin}/log/${tokenValue}`;
    const ok = await copyToClipboard(url);
    if (ok) toast.success('외부 작성 링크를 복사했어요.');
    else toast.error('복사에 실패했어요. 직접 선택해서 복사해 주세요.');
  };

  const [tab, setTab] = useState<ActivityLogType>('mentoring');
  const [programFilter, setProgramFilter] = useState<string>('전체');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  const [formOpen, setFormOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<LogRow | null>(null);
  const [detailLog, setDetailLog] = useState<LogRow | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [logsR, pR, prjR, expR] = await Promise.all([
        supabase.from('activity_logs')
          .select(SELECT_COLUMNS)
          .is('deleted_at', null)
          .order('activity_date', { ascending: false }),
        supabase.from('programs').select('id, name').order('created_at', { ascending: false }),
        supabase.from('projects').select('id, name').order('created_at', { ascending: false }),
        supabase.from('staff_pool').select('id, name').order('name'),
      ]);
      if (logsR.error) throw logsR.error;
      if (pR.error) console.error('[activity-logs] programs 조회 실패:', pR.error.message);
      if (prjR.error) console.error('[activity-logs] projects 조회 실패:', prjR.error.message);
      if (expR.error) console.error('[activity-logs] experts 조회 실패:', expR.error.message);
      const expertList = (expR.data ?? []) as Pick<StaffPool, 'id' | 'name'>[];
      const expertMap = new Map(expertList.map((e) => [e.id, e]));
      const rawLogs = (logsR.data ?? []) as LogRow[];
      // expert FK가 DB에 없어 join이 안 되므로, 메모리에서 매핑
      const enrichedLogs = rawLogs.map((l) => ({
        ...l,
        expert: l.expert_id ? expertMap.get(l.expert_id) ?? null : null,
      }));
      setLogs(enrichedLogs);
      setPrograms(pR.data ?? []);
      setProjects(prjR.data ?? []);
      setExperts(expertList);
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[activity-logs] 조회 실패:', raw);
      setErrorMsg('일지를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const counts = useMemo<Record<ActivityLogType, number>>(() => {
    const acc: Record<ActivityLogType, number> = {
      mentoring: 0, lecture: 0, business_trip: 0, ta: 0, operation: 0, dispatch: 0,
    };
    for (const l of logs) acc[l.log_type] = (acc[l.log_type] ?? 0) + 1;
    return acc;
  }, [logs]);

  const visible = useMemo(() => {
    return logs.filter((l) => {
      if (l.log_type !== tab) return false;
      if (programFilter !== '전체' && l.program_id !== programFilter) return false;
      if (dateFrom && l.activity_date < dateFrom) return false;
      if (dateTo && l.activity_date > dateTo) return false;
      return true;
    });
  }, [logs, tab, programFilter, dateFrom, dateTo]);

  const handleEdit = (log: LogRow) => {
    setEditingLog(log);
    setDetailLog(null);
    setFormOpen(true);
  };

  const handleDelete = async (log: LogRow) => {
    if (!confirm(`"${log.title}" 일지를 삭제할까요? (휴지통 보관)`)) return;
    try {
      const { error } = await supabase
        .from('activity_logs')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', log.id);
      if (error) throw error;
      await fetchData();
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[activity-logs] 삭제 실패:', raw);
      setErrorMsg('삭제 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.');
    }
  };

  return (
    <div className="space-y-5 max-w-[1400px]">
      <h1 className="text-2xl font-bold text-[#1E1B4B] flex items-center gap-2">
        <span aria-hidden="true">📓</span>
        일지
      </h1>
      <nav role="tablist" aria-label="일지 유형" className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto">
        {LOG_TYPE_VALUES.map((t) => {
          const active = tab === t;
          return (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t)}
              className={['inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap',
                active ? 'text-primary border-primary' : 'text-slate-500 border-transparent hover:text-text'].join(' ')}
            >
              {LOG_TYPE_LABELS[t]}
              <span className={['inline-flex items-center justify-center min-w-[1.25rem] px-1 rounded text-[10px]',
                active ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-500'].join(' ')}>
                {counts[t]}
              </span>
            </button>
          );
        })}
      </nav>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500">프로그램</label>
            <select
              value={programFilter}
              onChange={(e) => setProgramFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 min-w-[12rem]"
            >
              <option value="전체">전체 프로그램</option>
              {programs.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500">시작일</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500">종료일</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
          </div>
          {(dateFrom || dateTo || programFilter !== '전체') && (
            <button type="button" onClick={() => { setDateFrom(''); setDateTo(''); setProgramFilter('전체'); }}
              className="text-xs text-muted hover:text-primary underline">필터 초기화</button>
          )}
        </div>
        <Button variant="primary" leftIcon={<Plus size={16} />} onClick={() => { setEditingLog(null); setFormOpen(true); }}>
          일지 추가
        </Button>
      </div>

      {errorMsg && (
        <div role="alert" className="rounded-xl bg-danger/10 border border-danger/20 px-4 py-3 text-sm text-danger">{errorMsg}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-sm text-muted">
          <Loader2 size={18} className="animate-spin mr-2" />
          불러오는 중…
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          emoji="📓"
          title={(dateFrom || dateTo || programFilter !== '전체') ? '조건에 맞는 일지가 없어요.' : `아직 ${LOG_TYPE_LABELS[tab]} 일지가 없어요.`}
          description="첫 일지를 작성해 보세요."
          action={
            <Button variant="primary" leftIcon={<Plus size={14} />} onClick={() => { setEditingLog(null); setFormOpen(true); }}>
              + 일지 작성
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map((l) => (
            <Card key={l.id} className="hover:border-primary/30 hover:shadow-md transition h-full">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setDetailLog(l)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <h3 className="text-sm font-bold text-text truncate hover:text-primary transition-colors">{l.title}</h3>
                    <div className="text-xs text-muted truncate mt-0.5">{l.program?.name ?? '프로그램 미연결'}</div>
                  </button>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button type="button" onClick={() => void handleCopyLogLink(l.id)}
                      className="p-1.5 rounded text-slate-400 hover:text-violet-600 hover:bg-violet-50"
                      aria-label="외부 작성 링크 복사">
                      <Send size={14} />
                    </button>
                    <button type="button" onClick={() => handleEdit(l)}
                      className="p-1.5 rounded text-slate-400 hover:text-primary hover:bg-primary/5"
                      aria-label="수정">
                      <Edit3 size={14} />
                    </button>
                    <button type="button" onClick={() => void handleDelete(l)}
                      className="p-1.5 rounded text-slate-400 hover:text-danger hover:bg-danger/5"
                      aria-label="삭제">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                  <span className="inline-flex items-center gap-1">
                    <Calendar size={11} />{formatDateKo(l.activity_date)}
                  </span>
                  {l.duration_hours != null && <span>· {l.duration_hours}h</span>}
                  {l.expert?.name && <span>· 전문가 {l.expert.name}</span>}
                </div>
                {(l.location || l.attendee_count != null) && (
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                    {l.location && (<span className="inline-flex items-center gap-1"><MapPin size={11} />{l.location}</span>)}
                    {l.attendee_count != null && (<span className="inline-flex items-center gap-1"><Users size={11} />{l.attendee_count}명</span>)}
                  </div>
                )}
                {l.content && <p className="text-xs text-muted line-clamp-2 pt-1">{l.content}</p>}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  <Badge variant="primary">{LOG_TYPE_LABELS[l.log_type]}</Badge>
                  {l.file_urls && l.file_urls.length > 0 && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                      <FileIcon size={10} />{l.file_urls.length}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ActivityLogFormModal
        open={formOpen}
        programs={programs}
        projects={projects}
        experts={experts}
        defaultLogType={tab}
        defaultProgramId={programFilter !== '전체' ? programFilter : undefined}
        log={editingLog}
        onClose={() => { setFormOpen(false); setEditingLog(null); }}
        onSaved={() => void fetchData()}
      />

      <ActivityLogDetailModal
        open={Boolean(detailLog)}
        log={detailLog}
        onClose={() => setDetailLog(null)}
        onEdit={handleEdit}
      />
    </div>
  );
}
