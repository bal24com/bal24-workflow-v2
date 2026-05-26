// bal24 v2 — 컨소시엄 탭1: 개요 (재무 격리·예산 집행·태스크 요약·타임라인)
// STEP-CONSORTIUM-REDESIGN A안 (박경수님 2026-05-27) — 참여사 새 필드(지분율·정산방향·자사) 동기화 섹션 추가.

import { useEffect, useMemo, useState } from 'react';
import { Loader2, AlertTriangle, Wallet, ListChecks, Activity, BookOpen, Users2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../contexts/ToastContext';
import {
  MEMBER_TYPE_LABEL,
  MEMBER_TYPE_STYLE,
  type ConsortiumMember,
  type MemberType,
} from '../consortiumTypes';
import { buildMemberBudgets, formatKRW, formatConDate } from '../consortiumUtils';
import {
  getDirectionBadge, getRoleBadge, calcTotalShareRate,
  formatShareRate, formatBudget,
} from '../consortiumMemberUtils';

interface Props {
  consortiumId: string;
  totalBudget: number;
  members: ConsortiumMember[];
  description?: string | null;       // 박경수님 요청 — 사업 개요·세부내용 노출
}

interface TaskSummary {
  total: number;
  completed: number;
  inProgress: number;
  delayed: number;
}

interface ActivityItem {
  id: string;
  type: string;
  label: string;
  at: string;
}

export default function ConOverviewTab({ consortiumId, totalBudget, members, description }: Props) {
  const toast = useToast();
  const [income, setIncome] = useState<number>(0);
  const [expense, setExpense] = useState<number>(0);
  const [tasks, setTasks] = useState<TaskSummary>({ total: 0, completed: 0, inProgress: 0, delayed: 0 });
  const [timeline, setTimeline] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const [incRes, expRes, taskAll, taskDone, taskProg, taskDelay, links, memberHist] = await Promise.all([
          supabase
            .from('income')
            .select('amount')
            .eq('ledger_type', 'consortium')
            .eq('consortium_id', consortiumId)
            .is('deleted_at', null),
          supabase
            .from('expenses')
            .select('gross_amount')
            .eq('ledger_type', 'consortium')
            .eq('consortium_id', consortiumId)
            .is('deleted_at', null),
          supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('consortium_id', consortiumId).is('deleted_at', null),
          supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('consortium_id', consortiumId).eq('status', '완료').is('deleted_at', null),
          supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('consortium_id', consortiumId).in('status', ['실행', '검토']).is('deleted_at', null),
          supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('consortium_id', consortiumId).neq('status', '완료').lt('due_date', today).is('deleted_at', null),
          supabase
            .from('consortium_links')
            .select('id, link_type, label, created_at')
            .eq('consortium_id', consortiumId)
            .order('created_at', { ascending: false })
            .limit(5),
          supabase
            .from('consortium_members')
            .select('id, created_at, clients!consortium_members_client_id_fkey(name)')
            .eq('consortium_id', consortiumId)
            .order('created_at', { ascending: false })
            .limit(5),
        ]);
        if (cancelled) return;

        if (incRes.error) console.error('[con-overview] 수입 조회 실패:', incRes.error.message);
        if (expRes.error) console.error('[con-overview] 지출 조회 실패:', expRes.error.message);

        const incTotal = (incRes.data ?? []).reduce((s, r) => s + Number((r as { amount: number | string | null }).amount ?? 0), 0);
        const expTotal = (expRes.data ?? []).reduce((s, r) => s + Number((r as { gross_amount: number | string | null }).gross_amount ?? 0), 0);
        setIncome(incTotal);
        setExpense(expTotal);
        setTasks({
          total: taskAll.count ?? 0,
          completed: taskDone.count ?? 0,
          inProgress: taskProg.count ?? 0,
          delayed: taskDelay.count ?? 0,
        });

        const timelineItems: ActivityItem[] = [];
        for (const l of (links.data ?? []) as Array<{ id: string; link_type: string; label: string | null; created_at: string }>) {
          timelineItems.push({
            id: `link-${l.id}`,
            type: '링크',
            label: `${l.link_type} 링크 생성 — ${l.label ?? '라벨 없음'}`,
            at: l.created_at,
          });
        }
        type MemberHist = { id: string; created_at: string; clients: { name: string } | { name: string }[] | null };
        for (const m of (memberHist.data ?? []) as MemberHist[]) {
          const c = Array.isArray(m.clients) ? m.clients[0] : m.clients;
          timelineItems.push({
            id: `member-${m.id}`,
            type: '참여사',
            label: `참여사 추가 — ${c?.name ?? '미지정'}`,
            at: m.created_at,
          });
        }
        timelineItems.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
        setTimeline(timelineItems.slice(0, 10));
      } catch (err) {
        if (cancelled) return;
        const raw = err instanceof Error ? err.message : '';
        console.error('[con-overview] 데이터 로드 실패:', raw);
        toast.error('개요 데이터를 불러오지 못했어요.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [consortiumId, toast]);

  const budgets = useMemo(() => buildMemberBudgets(members), [members]);
  // 박경수님 2026-05-27 A안 — 새 필드(share_rate/settlement_direction/is_self) 동기화
  const newShareTotal = useMemo(() => calcTotalShareRate(members), [members]);
  const remaining = totalBudget - expense;
  const execRate = totalBudget > 0 ? Math.round((expense / totalBudget) * 100) : 0;

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="animate-spin text-violet-400" size={24} aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* 사업 개요 — 박경수님 요청 (모달 description 노출) */}
      {description?.trim() && (
        <section className="rounded-2xl border border-violet-100 bg-white p-5 shadow-[0_4px_16px_rgba(124,58,237,0.06)] space-y-2">
          <div className="flex items-center gap-1.5">
            <BookOpen size={16} className="text-violet-500" aria-hidden="true" />
            <h2 className="text-sm font-bold text-[#1E1B4B]">사업 개요</h2>
          </div>
          <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{description}</p>
        </section>
      )}

      {/* 재무 요약 4개 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="총사업비" value={formatKRW(totalBudget)} tone="violet" />
        <KpiCard label="집행액" value={formatKRW(expense)} tone="orange" sub={`수입 ${formatKRW(income)}`} />
        <KpiCard label="잔여" value={formatKRW(remaining)} tone={remaining < 0 ? 'rose' : 'emerald'} />
        <KpiCard label="집행률" value={`${execRate}%`} tone={execRate > 90 ? 'rose' : 'cyan'} sub={execRate > 90 ? '⚠ 집행률 과다' : undefined} />
      </div>

      {/* 박경수님 2026-05-27 A안 — 참여사 요약 (새 필드: 지분율·정산방향·자사) */}
      <section className="rounded-2xl border border-violet-100 bg-white p-5 shadow-[0_4px_16px_rgba(124,58,237,0.06)]">
        <div className="flex items-center justify-between gap-1.5 mb-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Users2 size={16} className="text-violet-500" aria-hidden="true" />
            <h2 className="text-sm font-bold text-[#1E1B4B]">참여사 요약</h2>
          </div>
          {members.length > 0 && (
            <span className={`text-[11px] font-semibold tabular-nums px-2 py-0.5 rounded border ${
              Math.abs(newShareTotal - 100) < 0.01
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}>
              지분율 합계 {formatShareRate(newShareTotal)}
              {Math.abs(newShareTotal - 100) >= 0.01 && ' (100% 미달)'}
            </span>
          )}
        </div>
        {members.length === 0 ? (
          <p className="text-sm text-slate-400 italic text-center py-6">아직 등록된 참여사가 없어요.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-violet-50/40 text-slate-500 text-xs">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold">참여사명</th>
                  <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">역할</th>
                  <th className="text-right px-3 py-2 font-semibold whitespace-nowrap">지분율</th>
                  <th className="text-right px-3 py-2 font-semibold whitespace-nowrap">예산 배정액</th>
                  <th className="text-center px-3 py-2 font-semibold whitespace-nowrap">정산 방향</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {members.map((m) => (
                  <tr key={`new-${m.id}`} className={m.is_self ? 'bg-violet-50/40' : 'hover:bg-violet-50/30'}>
                    <td className="px-3 py-2 text-sm font-medium text-slate-800">
                      <div className="inline-flex items-center gap-1.5">
                        {m.is_self && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 bg-teal-100 text-teal-700 rounded">자사</span>
                        )}
                        <span>{m.org_name || m.clients?.name || '미지정'}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2">{getRoleBadge(m.role ?? null, m.is_self)}</td>
                    <td className="px-3 py-2 text-right text-sm font-semibold text-violet-700 tabular-nums">
                      {formatShareRate(m.share_rate)}
                    </td>
                    <td className="px-3 py-2 text-right text-xs text-slate-700 tabular-nums">
                      {formatBudget(m.budget_amount)}
                    </td>
                    <td className="px-3 py-2 text-center">{getDirectionBadge(m.settlement_direction)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 참여사 예산 집행 표 — STEP-CONSORTIUM-UPGRADE-FULL PART A: 합계 100% 검증 */}
      <section className="rounded-2xl border border-violet-100 bg-white p-5 shadow-[0_4px_16px_rgba(124,58,237,0.06)]">
        <div className="flex items-center justify-between gap-1.5 mb-3">
          <div className="flex items-center gap-1.5">
            <Wallet size={16} className="text-violet-500" aria-hidden="true" />
            <h2 className="text-sm font-bold text-[#1E1B4B]">참여사 예산 집행 (수행과업 지분율)</h2>
          </div>
          {budgets.length > 0 && (() => {
            const total = budgets.reduce((s, b) => s + Number(b.taskSharePct ?? 0), 0);
            const valid = Math.abs(total - 100) < 0.01;
            return (
              <span className={`text-[11px] font-semibold tabular-nums px-2 py-0.5 rounded border ${valid ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                합계 {total.toFixed(1)}% {valid ? '✓' : '⚠️'}
              </span>
            );
          })()}
        </div>
        {budgets.length === 0 ? (
          <p className="text-sm text-slate-400 italic text-center py-6">참여사가 등록되지 않았어요.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-violet-50/40 text-slate-500 text-xs">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold">참여사</th>
                  <th className="text-left px-3 py-2 font-semibold">유형</th>
                  <th className="text-right px-3 py-2 font-semibold">수행과업 지분율(%)</th>
                  <th className="text-right px-3 py-2 font-semibold">배분예산</th>
                  <th className="text-right px-3 py-2 font-semibold">집행액</th>
                  <th className="text-right px-3 py-2 font-semibold">잔여</th>
                  <th className="text-right px-3 py-2 font-semibold">집행률</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {budgets.map((b) => {
                  const warn = b.executionRate > 90;
                  return (
                    <tr key={b.clientId} className="hover:bg-violet-50/40">
                      <td className="px-3 py-2 font-semibold text-[#1E1B4B]">{b.clientName}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex text-[10px] font-semibold px-1.5 py-0.5 rounded border ${MEMBER_TYPE_STYLE[b.memberType as MemberType] ?? MEMBER_TYPE_STYLE.observer}`}>
                          {MEMBER_TYPE_LABEL[b.memberType as MemberType]}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{b.taskSharePct}%</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatKRW(b.allocatedBudget)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatKRW(b.spentAmount)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatKRW(b.remainingBudget)}</td>
                      <td className={`px-3 py-2 text-right font-bold tabular-nums ${warn ? 'text-rose-600' : 'text-slate-700'}`}>
                        {warn && <AlertTriangle size={11} className="inline mr-0.5" aria-hidden="true" />}
                        {b.executionRate}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 태스크 요약 + 활동 타임라인 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="rounded-2xl border border-violet-100 bg-white p-5 shadow-[0_4px_16px_rgba(124,58,237,0.06)] space-y-3">
          <div className="flex items-center gap-1.5">
            <ListChecks size={16} className="text-violet-500" aria-hidden="true" />
            <h2 className="text-sm font-bold text-[#1E1B4B]">태스크 요약</h2>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <MiniStat label="전체" value={tasks.total} tone="text-[#1E1B4B]" />
            <MiniStat label="완료" value={tasks.completed} tone="text-emerald-600" />
            <MiniStat label="진행" value={tasks.inProgress} tone="text-violet-600" />
            <MiniStat label="지연" value={tasks.delayed} tone={tasks.delayed > 0 ? 'text-rose-600' : 'text-slate-500'} />
          </div>
        </section>

        <section className="rounded-2xl border border-violet-100 bg-white p-5 shadow-[0_4px_16px_rgba(124,58,237,0.06)] space-y-2">
          <div className="flex items-center gap-1.5">
            <Activity size={16} className="text-violet-500" aria-hidden="true" />
            <h2 className="text-sm font-bold text-[#1E1B4B]">활동 타임라인 (최근 10건)</h2>
          </div>
          {timeline.length === 0 ? (
            <p className="text-sm text-slate-400 italic text-center py-4">최근 활동이 없어요.</p>
          ) : (
            <ul className="space-y-1.5">
              {timeline.map((t) => (
                <li key={t.id} className="flex items-center gap-2 text-xs">
                  <span className="rounded-md bg-violet-50 text-violet-700 border border-violet-200 px-1.5 py-0.5 text-[10px] font-semibold shrink-0">
                    {t.type}
                  </span>
                  <span className="flex-1 text-slate-700 truncate">{t.label}</span>
                  <span className="shrink-0 text-slate-400">{formatConDate(t.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function KpiCard({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone: 'violet' | 'orange' | 'emerald' | 'cyan' | 'rose' }) {
  const colorMap = {
    violet: 'text-violet-700 bg-violet-50/40 border-violet-100',
    orange: 'text-orange-700 bg-orange-50/40 border-orange-100',
    emerald: 'text-emerald-700 bg-emerald-50/40 border-emerald-100',
    cyan: 'text-cyan-700 bg-cyan-50/40 border-cyan-100',
    rose: 'text-rose-700 bg-rose-50/40 border-rose-100',
  };
  return (
    <div className={`rounded-2xl border p-3 ${colorMap[tone]}`}>
      <div className="text-[11px] font-semibold text-slate-500 mb-0.5">{label}</div>
      <div className="text-xl font-bold tabular-nums">{value}</div>
      {sub && <div className="text-[10px] text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl border border-violet-100 bg-violet-50/30 p-3">
      <div className="text-[11px] font-semibold text-slate-500 mb-0.5">{label}</div>
      <div className={`text-2xl font-bold ${tone}`}>{value}</div>
    </div>
  );
}
