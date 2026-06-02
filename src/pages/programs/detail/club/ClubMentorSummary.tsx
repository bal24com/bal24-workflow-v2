// 박경수님 2026-06-02 CLUB-9 — 멘토별 담당 동아리 요약 뷰.
// 신규 DB 없이 program_clubs 를 멘토 기준으로 묶어 보여줌 (멘토링 계획 = 동아리 탭 통합).

import { useMemo } from 'react';
import { UserCog, School, Users, CalendarClock } from 'lucide-react';
import type { ProgramClub } from '../../../../types/database';

interface ClubWithActivity extends ProgramClub {
  activity_count: number;
}

interface Props {
  clubs: ClubWithActivity[];
  onSchedule: (clubId: string) => void;
}

const TYPE_TONE: Record<string, string> = {
  창업: 'bg-violet-100 text-violet-700',
  융합: 'bg-cyan-100 text-cyan-700',
};

export default function ClubMentorSummary({ clubs, onSchedule }: Props) {
  // 멘토 기준 그룹핑 (멘토 미지정은 '미지정' 묶음)
  const byMentor = useMemo(() => {
    const map = new Map<string, { phone: string | null; clubs: ClubWithActivity[] }>();
    clubs.forEach((c) => {
      const key = c.mentor_name?.trim() || '멘토 미지정';
      const entry = map.get(key) ?? { phone: c.mentor_phone ?? null, clubs: [] };
      entry.clubs.push(c);
      if (!entry.phone && c.mentor_phone) entry.phone = c.mentor_phone;
      map.set(key, entry);
    });
    return Array.from(map.entries()).sort((a, b) => b[1].clubs.length - a[1].clubs.length);
  }, [clubs]);

  return (
    <div className="space-y-3">
      {byMentor.map(([mentor, info]) => {
        const totalStudents = info.clubs.reduce((s, c) => s + (c.student_count ?? 0), 0);
        const schools = new Set(info.clubs.map((c) => c.school_name));
        return (
          <section key={mentor} className="rounded-2xl border border-violet-100 bg-white overflow-hidden">
            <div className="px-4 py-2.5 bg-violet-50/50 border-b border-violet-100 flex items-center gap-2 flex-wrap">
              <UserCog size={15} className="text-violet-600" aria-hidden="true" />
              <span className="text-sm font-bold text-[#1E1B4B]">{mentor}</span>
              {info.phone && <span className="text-[11px] text-slate-500">{info.phone}</span>}
              <span className="text-[11px] text-slate-500 ml-auto flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-0.5"><School size={10} aria-hidden="true" /> {schools.size}개교</span>
                <span>담당 {info.clubs.length}개 동아리</span>
                <span className="inline-flex items-center gap-0.5"><Users size={10} aria-hidden="true" /> {totalStudents}명</span>
              </span>
            </div>
            <ul className="divide-y divide-slate-100">
              {info.clubs.map((c) => (
                <li key={c.id} className="px-4 py-2.5 flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-[#1E1B4B]">{c.club_name}</span>
                  {c.club_type && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${TYPE_TONE[c.club_type] ?? 'bg-slate-100 text-slate-600'}`}>{c.club_type}</span>
                  )}
                  <span className="text-[11px] text-slate-500">{c.school_name}</span>
                  {c.teacher_name && <span className="text-[11px] text-slate-400">지도 {c.teacher_name}</span>}
                  <span className="text-[10px] text-slate-500 ml-auto">활동 <strong className="text-violet-700">{c.activity_count}</strong>건</span>
                  <button type="button" onClick={() => onSchedule(c.id)}
                    className="inline-flex items-center gap-1 px-2 h-7 rounded text-[11px] text-violet-700 hover:bg-violet-50 font-semibold">
                    <CalendarClock size={12} aria-hidden="true" /> 일정
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
