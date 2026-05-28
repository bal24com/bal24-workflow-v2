// 교육지원청 포털 — 학교별 현황 탭. 프로그램별 강사·교육생·일지 집계.
// 박경수님 2026-05-28 STEP-SCHOOL-PORTAL PART E-2.

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Building2, ChevronDown, ChevronRight } from 'lucide-react';
import { supabase } from '../../../lib/supabase';

interface Props { projectId: string }

interface ProgramRow {
  id: string;
  name: string | null;
  status: string | null;
  school_client_id: string | null;
  school_name: string | null;
  instructor_count: number;
  participant_count: number;
  log_count: number;
}

interface ProgramRaw {
  id: string;
  name: string | null;
  status: string | null;
  school_client_id: string | null;
  school: { name: string } | { name: string }[] | null;
}

function pickOne<T>(v: T | T[] | null): T | null {
  if (!v) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

const STATUS_TONE: Record<string, string> = {
  '준비':  'bg-slate-100 text-slate-700',
  '진행':  'bg-violet-100 text-violet-700',
  '완료':  'bg-emerald-100 text-emerald-700',
  '종료':  'bg-slate-100 text-slate-500',
};

export default function SupervisorSchoolsTab({ projectId }: Props) {
  const [rows, setRows] = useState<ProgramRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('programs')
      .select(`
        id, name, status, school_client_id,
        school:clients!programs_school_client_id_fkey(name)
      `)
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .order('start_date', { ascending: true });

    if (error) {
      console.error('[SupervisorSchoolsTab] 조회 실패:', error.message);
      setLoading(false);
      return;
    }

    const programs = (data ?? []) as ProgramRaw[];
    const enriched: ProgramRow[] = [];
    for (const p of programs) {
      const [instRes, partRes, logRes] = await Promise.all([
        supabase.from('instructor_invitations').select('id', { count: 'exact', head: true })
          .eq('program_id', p.id).eq('status', '수락'),
        supabase.from('program_participants').select('id', { count: 'exact', head: true })
          .eq('program_id', p.id),
        supabase.from('mentoring_logs').select('id', { count: 'exact', head: true })
          .eq('program_id', p.id),
      ]);
      const school = pickOne(p.school);
      enriched.push({
        id: p.id,
        name: p.name,
        status: p.status,
        school_client_id: p.school_client_id,
        school_name: school?.name ?? null,
        instructor_count: instRes.count ?? 0,
        participant_count: partRes.count ?? 0,
        log_count: logRes.count ?? 0,
      });
    }
    setRows(enriched);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const toggle = (id: string) => {
    setExpanded((p) => {
      const next = new Set(p);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-violet-500" size={24} /></div>;
  }

  return (
    <section className="bg-white rounded-2xl shadow-sm p-5">
      <h2 className="text-sm font-bold text-slate-700 mb-3 inline-flex items-center gap-1.5">
        <Building2 size={16} className="text-indigo-600" aria-hidden="true" /> 학교별 프로그램 ({rows.length})
      </h2>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-400 italic text-center py-8">등록된 프로그램이 없어요.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-3 py-2 w-6"></th>
                <th className="text-left px-3 py-2 font-semibold">학교</th>
                <th className="text-left px-3 py-2 font-semibold">프로그램</th>
                <th className="text-center px-3 py-2 font-semibold">상태</th>
                <th className="text-right px-3 py-2 font-semibold">강사</th>
                <th className="text-right px-3 py-2 font-semibold">교육생</th>
                <th className="text-right px-3 py-2 font-semibold">멘토링 일지</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <>
                  <tr key={r.id} className="hover:bg-violet-50/30 cursor-pointer" onClick={() => toggle(r.id)}>
                    <td className="px-3 py-2 text-slate-400">
                      {expanded.has(r.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </td>
                    <td className="px-3 py-2 font-medium">{r.school_name ?? '미지정'}</td>
                    <td className="px-3 py-2">{r.name ?? '제목 없음'}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`inline-flex text-[10px] font-bold px-1.5 py-0.5 rounded ${STATUS_TONE[r.status ?? ''] ?? 'bg-slate-100 text-slate-500'}`}>
                        {r.status ?? '미정'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.instructor_count}명</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.participant_count}명</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.log_count}건</td>
                  </tr>
                  {expanded.has(r.id) && (
                    <tr key={`${r.id}-detail`} className="bg-slate-50">
                      <td colSpan={7} className="px-5 py-3 text-xs text-slate-600">
                        <p>📚 {r.name} · 🏫 {r.school_name ?? '미지정'}</p>
                        <p className="text-slate-500 mt-1">
                          강사 {r.instructor_count}명 · 교육생 {r.participant_count}명 · 일지 {r.log_count}건
                        </p>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
