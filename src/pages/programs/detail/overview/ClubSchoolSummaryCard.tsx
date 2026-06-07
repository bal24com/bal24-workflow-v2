// 박경수님 2026-06-08 CLUB-B — 기본정보 탭 수혜기관(참여학교) 요약 카드
// program_clubs 에서 학교별 팀수·학생수를 집계해 표시

import { useCallback, useEffect, useMemo, useState } from 'react';
import { School, Loader2, Users } from 'lucide-react';
import { supabase } from '../../../../lib/supabase';

interface Props {
  programId: string;
}

interface SchoolRow {
  school_name: string;
  teamCount: number;
  studentCount: number;
}

export default function ClubSchoolSummaryCard({ programId }: Props) {
  const [rows, setRows] = useState<{ school_name: string; student_count: number | null }[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('program_clubs')
      .select('school_name, student_count')
      .eq('program_id', programId);
    if (!error) setRows((data ?? []) as { school_name: string; student_count: number | null }[]);
    setLoading(false);
  }, [programId]);

  useEffect(() => { void load(); }, [load]);

  const schools = useMemo<SchoolRow[]>(() => {
    const map = new Map<string, SchoolRow>();
    rows.forEach((r) => {
      const prev = map.get(r.school_name) ?? { school_name: r.school_name, teamCount: 0, studentCount: 0 };
      map.set(r.school_name, {
        school_name: r.school_name,
        teamCount: prev.teamCount + 1,
        studentCount: prev.studentCount + (r.student_count ?? 0),
      });
    });
    return Array.from(map.values()).sort((a, b) => a.school_name.localeCompare(b.school_name));
  }, [rows]);

  const totalTeams = rows.length;
  const totalStudents = rows.reduce((s, r) => s + (r.student_count ?? 0), 0);

  if (loading) {
    return (
      <div className="rounded-2xl border border-violet-100 bg-white p-4 flex justify-center py-8">
        <Loader2 size={16} className="animate-spin text-violet-400" aria-hidden="true" />
      </div>
    );
  }

  if (schools.length === 0) return null;

  return (
    <div className="rounded-2xl border border-violet-100 bg-white shadow-[0_4px_16px_rgba(124,58,237,0.05)] p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-[#1E1B4B] inline-flex items-center gap-1.5">
          <School size={15} className="text-violet-600" aria-hidden="true" />
          참여 학교 ({schools.length}개교)
        </h3>
        <span className="text-[11px] text-slate-500">
          {totalTeams}팀 · <Users size={10} className="inline" aria-hidden="true" /> {totalStudents}명
        </span>
      </div>

      <ul className="space-y-1.5">
        {schools.map((s) => (
          <li key={s.school_name} className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 bg-violet-50/40 hover:bg-violet-50 transition-colors">
            <span className="text-xs font-bold text-[#1E1B4B] flex-1 min-w-0 truncate">{s.school_name}</span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 shrink-0">
              {s.teamCount}팀
            </span>
            <span className="text-[11px] text-slate-500 shrink-0">
              학생 {s.studentCount}명
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
