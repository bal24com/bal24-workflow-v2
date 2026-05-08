// bal24 v2 — /apply/:programId 홍보 영역 (강사진·커리큘럼·공지·목표)
// share-portal sharePortalUtils의 fetch 함수 재사용.

import { useEffect, useState } from 'react';
import {
  Loader2, Mic2, BookOpen, Megaphone, Target, User, Clock, MapPin,
} from 'lucide-react';
import {
  fetchPublicCurriculum, fetchPublicInstructors, type PublicInstructor,
} from '../share-portal/sharePortalUtils';
import { trimTime } from '../programs/detail/curriculum/curriculumTabUtils';
import { formatDateKo } from '../../lib/utils';
import type { Program, ProgramCurriculum } from '../../types/database';

interface Props {
  program: Program;
}

export default function PromoSection({ program }: Props) {
  const [curriculum, setCurriculum] = useState<ProgramCurriculum[]>([]);
  const [instructors, setInstructors] = useState<PublicInstructor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const [c, i] = await Promise.all([
        fetchPublicCurriculum(program.id),
        fetchPublicInstructors(program.id),
      ]);
      if (cancelled) return;
      setCurriculum(c);
      setInstructors(i);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [program.id]);

  return (
    <div className="flex flex-col gap-3">
      {/* 공지사항 */}
      {program.notice && (
        <Card title="공지사항" icon={<Megaphone size={16} className="text-orange-500" aria-hidden="true" />}>
          <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{program.notice}</p>
        </Card>
      )}

      {/* 성과 목표 */}
      {program.goal_text && (
        <Card title="성과 목표" icon={<Target size={16} className="text-violet-500" aria-hidden="true" />}>
          <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{program.goal_text}</p>
        </Card>
      )}

      {/* 강사진 */}
      <Card
        title={`강사진 (${instructors.length})`}
        icon={<Mic2 size={16} className="text-violet-500" aria-hidden="true" />}
      >
        {loading ? (
          <Loading />
        ) : instructors.length === 0 ? (
          <p className="text-sm text-slate-400 italic text-center py-2">등록된 강사 정보가 없어요.</p>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {instructors.map((inst) => (
              <li
                key={inst.id}
                className="flex items-start gap-2 rounded-xl border border-violet-100 bg-violet-50/30 p-3"
              >
                {inst.profile_image_url ? (
                  <img
                    src={inst.profile_image_url}
                    alt={inst.name}
                    className="shrink-0 w-10 h-10 rounded-full object-cover bg-white border border-violet-100"
                  />
                ) : (
                  <span className="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-full bg-violet-100 text-violet-500">
                    <User size={16} aria-hidden="true" />
                  </span>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[#1E1B4B] truncate">{inst.name}</p>
                  {inst.career_summary && (
                    <p className="mt-0.5 text-[11px] text-slate-600 line-clamp-2 whitespace-pre-wrap">
                      {inst.career_summary}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* 커리큘럼 */}
      <Card
        title={`커리큘럼 (${curriculum.length}차시)`}
        icon={<BookOpen size={16} className="text-cyan-500" aria-hidden="true" />}
      >
        {loading ? (
          <Loading />
        ) : curriculum.length === 0 ? (
          <p className="text-sm text-slate-400 italic text-center py-2">등록된 차시가 없어요.</p>
        ) : (
          <ol className="flex flex-col gap-1.5">
            {curriculum.slice(0, 10).map((c) => (
              <li
                key={c.id}
                className="rounded-xl border border-cyan-100 bg-cyan-50/30 px-3 py-2 flex flex-col gap-1"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center justify-center min-w-[2.5rem] h-6 px-2 rounded-md bg-cyan-100 text-cyan-700 text-[11px] font-bold tabular-nums">
                    {c.session_no}차시
                  </span>
                  <span className="flex-1 min-w-0 text-sm font-bold text-[#1E1B4B]">{c.title}</span>
                </div>
                <div className="flex items-center gap-3 flex-wrap text-[11px] text-slate-500">
                  {c.session_date && <span>{formatDateKo(c.session_date)}</span>}
                  {(c.start_time || c.end_time) && (
                    <span className="inline-flex items-center gap-0.5 tabular-nums">
                      <Clock size={11} aria-hidden="true" />
                      {trimTime(c.start_time)}
                      {c.end_time && `~${trimTime(c.end_time)}`}
                    </span>
                  )}
                  {c.venue && (
                    <span className="inline-flex items-center gap-0.5">
                      <MapPin size={11} aria-hidden="true" />
                      {c.venue}
                    </span>
                  )}
                </div>
              </li>
            ))}
            {curriculum.length > 10 && (
              <li className="text-[11px] text-slate-400 italic text-center pt-1">
                +{curriculum.length - 10}차시 더 — 전체는 신청 후 안내드려요.
              </li>
            )}
          </ol>
        )}
      </Card>
    </div>
  );
}

function Card({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-violet-100 bg-white p-5 shadow-[0_4px_16px_rgba(124,58,237,0.06)]">
      <header className="flex items-center gap-1.5 mb-3">
        {icon}
        <h3 className="text-sm font-bold text-[#1E1B4B]">{title}</h3>
      </header>
      {children}
    </section>
  );
}

function Loading() {
  return (
    <div className="flex justify-center py-4">
      <Loader2 className="animate-spin text-violet-400" size={18} aria-hidden="true" />
    </div>
  );
}
