// bal24 v2 — 컨소시엄 탭3: 태스크 (다중 회사 + assigned_client_id + 수행과업 지분율)

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, Calendar, AlertTriangle, User } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../contexts/ToastContext';
import { Button } from '../../../components/ui';
import { BADGE_BASE, TASK_STATUS_STYLE } from '../../../utils/statusStyles';
import EmptyState from '../../../components/EmptyState';
import { formatConDate } from '../consortiumUtils';
import { MEMBER_TYPE_LABEL, MEMBER_TYPE_STYLE, type ConsortiumMember, type MemberType } from '../consortiumTypes';
import type { TaskStatus } from '../../../types/database';

interface Props {
  consortiumId: string;
  members: ConsortiumMember[];
}

interface TaskRow {
  id: string;
  title: string;
  status: TaskStatus;
  due_date: string | null;
  start_date: string | null;
  assigned_client_id: string | null;
  share_pct: number | null;
  assigned_client: { id: string; name: string } | null;
  assignee: { id: string; name: string } | null;
}

const TASK_SELECT = `
  id, title, status, due_date, start_date, assigned_client_id, share_pct,
  assigned_client:clients!tasks_assigned_client_id_fkey(id, name),
  assignee:profiles!tasks_assignee_id_fkey(id, name)
`.replace(/\s+/g, ' ');

export default function ConTasksTab({ consortiumId, members }: Props) {
  const toast = useToast();
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterClientId, setFilterClientId] = useState<string | 'ALL'>('ALL');

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('tasks')
        .select(TASK_SELECT)
        .eq('consortium_id', consortiumId)
        .is('deleted_at', null)
        .order('due_date', { ascending: true, nullsFirst: false });
      if (filterClientId !== 'ALL') query = query.eq('assigned_client_id', filterClientId);
      const { data, error } = await query;
      if (error) throw error;
      setTasks((data as unknown as TaskRow[] | null) ?? []);
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[con-tasks] 조회 실패:', raw);
      toast.error('태스크 목록을 불러오지 못했어요.');
    } finally {
      setLoading(false);
    }
  }, [consortiumId, filterClientId, toast]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await fetchTasks();
      if (cancelled) return;
    })();
    return () => { cancelled = true; };
  }, [fetchTasks]);

  // 참여사별 태스크 수·완료 수 집계
  const memberStats = useMemo(() => {
    const map = new Map<string, { name: string; type: MemberType; total: number; done: number; sharePct: number }>();
    for (const m of members) {
      map.set(m.client_id ?? m.id, {
        name: m.clients?.name ?? '미지정',
        type: m.member_type as MemberType,
        total: 0,
        done: 0,
        sharePct: m.task_share_pct,
      });
    }
    for (const t of tasks) {
      if (!t.assigned_client_id) continue;
      const stat = map.get(t.assigned_client_id);
      if (!stat) continue;
      stat.total += 1;
      if (t.status === '완료') stat.done += 1;
    }
    return Array.from(map.entries()).map(([clientId, s]) => ({ clientId, ...s }));
  }, [members, tasks]);

  const handleAdd = () => {
    toast.info('프로젝트 페이지의 태스크 탭에서 등록 시 컨소시엄·담당 참여사를 선택해 주세요. (모달 통합은 STEP-CON 후속)');
  };

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  return (
    <div className="space-y-4">
      {/* 참여사 필터 탭 */}
      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex flex-wrap gap-1.5 rounded-xl border border-violet-100 bg-white p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setFilterClientId('ALL')}
            className={`px-3 py-1.5 text-sm font-semibold rounded-lg transition ${
              filterClientId === 'ALL' ? 'bg-violet-600 text-white' : 'text-slate-600 hover:bg-violet-50'
            }`}
          >
            전체
          </button>
          {members.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setFilterClientId(m.client_id ?? '')}
              className={`px-3 py-1.5 text-sm font-semibold rounded-lg transition ${
                filterClientId === (m.client_id ?? '') ? 'bg-violet-600 text-white' : 'text-slate-600 hover:bg-violet-50'
              }`}
            >
              {m.clients?.name ?? '미지정'}
            </button>
          ))}
        </div>
        <Button variant="primary" size="sm" leftIcon={<Plus size={14} />} onClick={handleAdd}>
          + 태스크 추가
        </Button>
      </div>

      {/* 수행과업 지분율 요약 바 */}
      {members.length > 0 && (
        <section className="rounded-2xl border border-violet-100 bg-white p-4 shadow-[0_4px_16px_rgba(124,58,237,0.06)]">
          <h3 className="text-sm font-bold text-[#1E1B4B] mb-2">참여사별 태스크 진행 (수행과업 지분율)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-violet-50/40 text-slate-500 text-xs">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold">참여사</th>
                  <th className="text-left px-3 py-2 font-semibold">유형</th>
                  <th className="text-right px-3 py-2 font-semibold">수행과업 지분율(%)</th>
                  <th className="text-right px-3 py-2 font-semibold">태스크 수</th>
                  <th className="text-right px-3 py-2 font-semibold">완료 수</th>
                  <th className="text-right px-3 py-2 font-semibold">완료율</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {memberStats.map((s) => {
                  const rate = s.total > 0 ? Math.round((s.done / s.total) * 100) : 0;
                  return (
                    <tr key={s.clientId} className="hover:bg-violet-50/40">
                      <td className="px-3 py-2 font-semibold text-[#1E1B4B]">{s.name}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex text-[10px] font-semibold px-1.5 py-0.5 rounded border ${MEMBER_TYPE_STYLE[s.type]}`}>
                          {MEMBER_TYPE_LABEL[s.type]}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{s.sharePct}%</td>
                      <td className="px-3 py-2 text-right tabular-nums">{s.total}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{s.done}</td>
                      <td className="px-3 py-2 text-right font-bold tabular-nums text-violet-700">{rate}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* 태스크 카드 목록 */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-violet-400" size={24} aria-hidden="true" />
        </div>
      ) : tasks.length === 0 ? (
        <EmptyState
          emoji="📋"
          title={filterClientId !== 'ALL' ? '선택한 참여사의 태스크가 없어요.' : '아직 등록된 태스크가 없어요.'}
          description="태스크를 추가해 컨소시엄 진행 상황을 관리해 주세요."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {tasks.map((t) => {
            const isDelayed = t.due_date && t.due_date < today && t.status !== '완료';
            const memberMatch = members.find((m) => m.client_id === t.assigned_client_id);
            return (
              <article
                key={t.id}
                className={`rounded-2xl border bg-white p-4 shadow-[0_4px_16px_rgba(124,58,237,0.06)] space-y-2 hover:shadow-md transition ${
                  isDelayed ? 'border-rose-300' : 'border-violet-100 hover:border-violet-200'
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className={`${BADGE_BASE} ${TASK_STATUS_STYLE[t.status] ?? TASK_STATUS_STYLE.인식} shrink-0`}>
                    {t.status}
                  </span>
                  <h4 className="text-sm font-bold text-[#1E1B4B] flex-1 min-w-0 truncate">{t.title}</h4>
                  {isDelayed && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 shrink-0">
                      <AlertTriangle size={11} aria-hidden="true" />
                      지연
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 flex-wrap text-xs">
                  {memberMatch && t.assigned_client && (
                    <span className={`inline-flex text-[10px] font-semibold px-1.5 py-0.5 rounded border ${MEMBER_TYPE_STYLE[memberMatch.member_type as MemberType]}`}>
                      {MEMBER_TYPE_LABEL[memberMatch.member_type as MemberType]} {t.assigned_client.name}
                    </span>
                  )}
                  {!memberMatch && t.assigned_client && (
                    <span className="inline-flex text-[10px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                      {t.assigned_client.name}
                    </span>
                  )}
                  {t.share_pct != null && Number(t.share_pct) > 0 && (
                    <span className="text-[10px] text-violet-600 font-semibold">
                      수행과업 지분율 {t.share_pct}%
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-500">
                  {t.assignee && (
                    <span className="inline-flex items-center gap-1">
                      <User size={11} aria-hidden="true" />
                      {t.assignee.name}
                    </span>
                  )}
                  {t.due_date && (
                    <span className={`inline-flex items-center gap-1 ${isDelayed ? 'text-rose-600 font-semibold' : ''}`}>
                      <Calendar size={11} aria-hidden="true" />
                      {formatConDate(t.due_date)}
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
