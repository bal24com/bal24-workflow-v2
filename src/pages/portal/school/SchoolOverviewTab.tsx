// 학교 담당자 포털 — 개요 탭. 카드 3개 + 강사 배정 현황.
// 박경수님 2026-05-28 STEP-SCHOOL-PORTAL.

import { useEffect, useState } from 'react';
import { Users, GraduationCap, Calendar, Loader2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import type { SchoolPortalContext } from '../../../types/schoolPortal';

interface Props { context: SchoolPortalContext }

interface InstructorRow {
  id: string;
  status: string | null;
  role: string | null;
  staff: { name: string | null } | null;
  log_count: number;
}

interface Stats {
  participantCount: number;
  instructorCount: number;
  nextSessionDate: string | null;
}

interface InstructorRaw {
  id: string;
  status: string | null;
  role: string | null;
  staff_pool: { name: string } | { name: string }[] | null;
}

function pickOne<T>(v: T | T[] | null): T | null {
  if (!v) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

export default function SchoolOverviewTab({ context }: Props) {
  const [stats, setStats] = useState<Stats>({ participantCount: 0, instructorCount: 0, nextSessionDate: null });
  const [instructors, setInstructors] = useState<InstructorRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const [partRes, instRes, sessRes] = await Promise.all([
          supabase
            .from('program_participants')
            .select('id', { count: 'exact', head: true })
            .eq('program_id', context.programId),
          supabase
            .from('instructor_invitations')
            .select('id, status, role, staff_pool:staff_pool_id(name)')
            .eq('program_id', context.programId),
          supabase
            .from('attendance_sessions')
            .select('session_date')
            .eq('program_id', context.programId)
            .gte('session_date', today)
            .order('session_date', { ascending: true })
            .limit(1)
            .maybeSingle(),
        ]);
        if (cancelled) return;

        const instData = (instRes.data ?? []) as InstructorRaw[];
        const rows: InstructorRow[] = instData.map((r) => {
          const staff = pickOne(r.staff_pool);
          return {
            id: r.id,
            status: r.status,
            role: r.role,
            staff: staff ? { name: staff.name } : null,
            log_count: 0,
          };
        });

        // 멘토링 일지 수 — 별도 카운트
        for (const row of rows) {
          const { count } = await supabase
            .from('mentoring_logs')
            .select('id', { count: 'exact', head: true })
            .eq('program_id', context.programId)
            .eq('staff_pool_id', row.id);
          row.log_count = count ?? 0;
        }

        if (cancelled) return;
        setInstructors(rows);
        setStats({
          participantCount: partRes.count ?? 0,
          instructorCount: rows.length,
          nextSessionDate: (sessRes.data as { session_date?: string } | null)?.session_date ?? null,
        });
      } catch (err) {
        const raw = err instanceof Error ? err.message : '';
        console.error('[SchoolOverviewTab] 로드 실패:', raw);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [context.programId]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="animate-spin text-violet-500" size={24} aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* 카드 3개 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard Icon={Users} label="교육생" value={`${stats.participantCount}명`} tone="violet" />
        <KpiCard Icon={GraduationCap} label="강사" value={`${stats.instructorCount}명`} tone="cyan" />
        <KpiCard Icon={Calendar} label="다음 일정"
          value={stats.nextSessionDate ?? '예정 없음'} tone={stats.nextSessionDate ? 'emerald' : 'slate'} />
      </div>

      {/* 강사 배정 현황 */}
      <section className="bg-white rounded-2xl shadow-sm p-5">
        <h2 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-1.5">
          <GraduationCap size={16} className="text-violet-500" aria-hidden="true" /> 강사 배정 현황
        </h2>
        {instructors.length === 0 ? (
          <p className="text-sm text-slate-400 italic text-center py-6">배정된 강사가 없어요.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold">강사명</th>
                  <th className="text-left px-3 py-2 font-semibold">역할</th>
                  <th className="text-center px-3 py-2 font-semibold">상태</th>
                  <th className="text-right px-3 py-2 font-semibold">멘토링 일지</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {instructors.map((r) => (
                  <tr key={r.id} className="hover:bg-violet-50/30">
                    <td className="px-3 py-2 font-medium">{r.staff?.name ?? '미정'}</td>
                    <td className="px-3 py-2 text-slate-500">{r.role ?? '-'}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`inline-flex text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        r.status === '수락' ? 'bg-emerald-100 text-emerald-700'
                          : r.status === '대기' ? 'bg-amber-100 text-amber-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}>{r.status ?? '미정'}</span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.log_count}건</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

const TONE: Record<string, string> = {
  violet:  'bg-violet-50 text-violet-700 border-violet-200',
  cyan:    'bg-cyan-50 text-cyan-700 border-cyan-200',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  slate:   'bg-slate-50 text-slate-500 border-slate-200',
};

function KpiCard({ Icon, label, value, tone }: { Icon: typeof Users; label: string; value: string; tone: string }) {
  return (
    <div className={`rounded-2xl border p-4 flex items-center gap-3 ${TONE[tone] ?? TONE.violet}`}>
      <Icon size={28} aria-hidden="true" />
      <div>
        <div className="text-[11px] font-semibold opacity-80">{label}</div>
        <div className="text-xl font-bold">{value}</div>
      </div>
    </div>
  );
}
