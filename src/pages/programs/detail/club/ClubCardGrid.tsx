// 박경수님 2026-06-02 CLUB-8 — 동아리 카드형 보기.
// 학교별 그룹 헤더 + 동아리 카드 grid. 링크 복사·열기·삭제·일정 액션.

import { Copy, Trash2, ExternalLink, School, CalendarDays, Users, ClipboardCheck } from 'lucide-react';
import type { ProgramClub } from '../../../../types/database';

interface ClubWithActivity extends ProgramClub {
  activity_count: number;
}

interface Props {
  bySchool: Array<[string, ClubWithActivity[]]>;
  /** 박경수님 2026-06-08 — 설문 응답한 동아리 id 집합 */
  respondedClubIds?: Set<string>;
  onCopyLink: (club: ProgramClub) => void;
  onDelete: (club: ProgramClub) => void;
  onSchedule: (clubId: string) => void;
}

const TYPE_TONE: Record<string, string> = {
  창업: 'bg-violet-100 text-violet-700',
  융합: 'bg-cyan-100 text-cyan-700',
};

export default function ClubCardGrid({ bySchool, respondedClubIds, onCopyLink, onDelete, onSchedule }: Props) {
  return (
    <div className="space-y-4">
      {bySchool.map(([school, clubs]) => (
        <section key={school} className="space-y-2">
          <div className="flex items-center gap-2">
            <School size={14} className="text-violet-600" aria-hidden="true" />
            <span className="text-sm font-bold text-[#1E1B4B]">{school}</span>
            <span className="text-[11px] text-slate-500">· {clubs.length}개</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {clubs.map((c) => (
              <article key={c.id} className="rounded-2xl border border-violet-100 bg-white p-4 shadow-sm space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-sm font-bold text-[#1E1B4B] min-w-0 truncate">{c.club_name}</h4>
                  <div className="flex items-center gap-1 shrink-0">
                    {respondedClubIds?.has(c.id) && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700" title="설문 응답 완료">
                        <ClipboardCheck size={10} aria-hidden="true" /> 응답
                      </span>
                    )}
                    {c.club_type && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${TYPE_TONE[c.club_type] ?? 'bg-slate-100 text-slate-600'}`}>
                        {c.club_type}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-[11px] text-slate-500 space-y-0.5">
                  {c.teacher_name && <p>지도 {c.teacher_name}{c.teacher_phone ? ` · ${c.teacher_phone}` : ''}</p>}
                  {c.mentor_name && <p>멘토 {c.mentor_name}{c.mentor_phone ? ` · ${c.mentor_phone}` : ''}</p>}
                  <p className="flex items-center gap-2 pt-0.5">
                    {c.student_count != null && <span className="inline-flex items-center gap-0.5"><Users size={10} aria-hidden="true" />{c.student_count}명</span>}
                    {c.operating_budget != null && <span>운영비 {c.operating_budget}천원</span>}
                    <span>활동 <strong className="text-violet-700">{c.activity_count}</strong></span>
                  </p>
                </div>
                {c.operating_method && (
                  <p className="text-[11px] text-slate-400 line-clamp-2">{c.operating_method}</p>
                )}
                <div className="flex items-center gap-1 pt-1.5 border-t border-slate-100">
                  <button type="button" onClick={() => onSchedule(c.id)}
                    className="inline-flex items-center gap-1 px-2 h-7 rounded text-[11px] text-violet-700 hover:bg-violet-50 font-semibold">
                    <CalendarDays size={12} aria-hidden="true" /> 일정
                  </button>
                  <button type="button" onClick={() => onCopyLink(c)}
                    title="링크 복사" className="p-1.5 rounded hover:bg-violet-50 text-violet-700 ml-auto">
                    <Copy size={13} aria-hidden="true" />
                  </button>
                  <a href={`${window.location.origin}/share/club/${c.club_token}`} target="_blank" rel="noreferrer"
                    title="페이지 열기" className="p-1.5 rounded hover:bg-violet-50 text-violet-700">
                    <ExternalLink size={13} aria-hidden="true" />
                  </a>
                  <button type="button" onClick={() => onDelete(c)}
                    title="삭제" className="p-1.5 rounded hover:bg-rose-50 text-rose-500">
                    <Trash2 size={13} aria-hidden="true" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
