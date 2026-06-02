// bal24 v2 — 외부공유 항목 · 강사정보
// ⚠️ 보안 룰 — 이름·약력·사진만. 연락처·계좌·주민번호 절대 노출 X.
// 박경수님 2026-06-02 CLUB-15 — 동아리 멘토(program_clubs.mentor_name)도 함께 표기.

import { useEffect, useState } from 'react';
import { Mic2, Loader2, User, Sparkles } from 'lucide-react';
import {
  fetchPublicInstructors, fetchPublicMentors,
  type PublicInstructor, type PublicMentor,
} from '../sharePortalUtils';
import ItemCard from './ItemCard';

interface Props {
  programId: string;
}

export default function InstructorsItem({ programId }: Props) {
  const [list, setList] = useState<PublicInstructor[]>([]);
  const [mentors, setMentors] = useState<PublicMentor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!programId) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const [insts, ments] = await Promise.all([
        fetchPublicInstructors(programId),
        fetchPublicMentors(programId),
      ]);
      if (cancelled) return;
      setList(insts);
      setMentors(ments);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [programId]);

  const isEmpty = list.length === 0 && mentors.length === 0;

  return (
    <ItemCard
      icon={<Mic2 size={18} aria-hidden="true" />}
      title="강사·멘토"
      hint="강사·멘토 정보 — 연락처는 담당자에게 별도 문의해 주세요"
    >
      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="animate-spin text-violet-400" size={18} aria-hidden="true" />
        </div>
      ) : isEmpty ? (
        <p className="text-sm text-slate-400 italic text-center py-2">아직 강사·멘토가 매칭되지 않았어요.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {/* 강사 */}
          {list.map((inst) => (
            <li
              key={inst.id}
              className="rounded-xl border border-violet-100 bg-violet-50/30 px-3 py-3 flex items-start gap-3"
            >
              {inst.profile_image_url ? (
                <img
                  src={inst.profile_image_url}
                  alt={inst.name}
                  className="shrink-0 w-12 h-12 rounded-full object-cover bg-white border border-violet-100"
                />
              ) : (
                <span className="shrink-0 inline-flex items-center justify-center w-12 h-12 rounded-full bg-violet-100 text-violet-500">
                  <User size={20} aria-hidden="true" />
                </span>
              )}
              <div className="flex-1 min-w-0 flex flex-col gap-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-100 text-violet-700">강사</span>
                  <p className="text-sm font-bold text-[#1E1B4B]">{inst.name}</p>
                  <span className="text-[10px] text-slate-400">
                    ({inst.source === 'external' ? '외부 강사' : '내부 직원'})
                  </span>
                  {inst.session_nos.length > 0 && (
                    <span className="ml-auto text-[10px] text-violet-600 font-semibold tabular-nums">
                      {inst.session_nos.join(', ')}차시
                    </span>
                  )}
                </div>
                {inst.career_summary && (
                  <p className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed">
                    {inst.career_summary}
                  </p>
                )}
              </div>
            </li>
          ))}

          {/* 멘토 (동아리) */}
          {mentors.map((m) => (
            <li
              key={`mentor-${m.name}`}
              className="rounded-xl border border-cyan-100 bg-cyan-50/30 px-3 py-3 flex items-start gap-3"
            >
              <span className="shrink-0 inline-flex items-center justify-center w-12 h-12 rounded-full bg-cyan-100 text-cyan-600">
                <Sparkles size={20} aria-hidden="true" />
              </span>
              <div className="flex-1 min-w-0 flex flex-col gap-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cyan-100 text-cyan-700">멘토</span>
                  <p className="text-sm font-bold text-[#1E1B4B]">{m.name}</p>
                </div>
                {m.clubs.length > 0 && (
                  <p className="text-xs text-slate-600 leading-relaxed">
                    담당 동아리 · {m.clubs.join(', ')}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </ItemCard>
  );
}
