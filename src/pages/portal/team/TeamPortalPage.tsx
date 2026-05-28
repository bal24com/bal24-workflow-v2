// 팀·학생 포털 — scope=team 접근. 해당 팀 정보만 노출.
// 박경수님 2026-05-28 STEP-SCHOOL-PORTAL PART C-1.

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Users, BookOpen, ClipboardList, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { getSurveysByProgram } from '../../../hooks/portal/useSurvey';
import type { SchoolPortalContext, Survey } from '../../../types/schoolPortal';

interface Props { context: SchoolPortalContext }

interface MentorRow {
  id: string;
  staff_name: string | null;
  role: string | null;
  status: string | null;
}

interface MentoringLog {
  id: string;
  log_date: string | null;
  topic: string | null;
  content: string | null;
  mentee_names: string[];
}

interface StaffRaw { name: string }
interface InstructorRaw {
  id: string;
  status: string | null;
  role: string | null;
  staff_pool: StaffRaw | StaffRaw[] | null;
}
interface MentoringLogRaw {
  id: string;
  log_date: string | null;
  topic: string | null;
  content: string | null;
  mentee_ids: unknown;
}
interface ParticipantNameRaw { id: string; name: string }

function pickOne<T>(v: T | T[] | null): T | null {
  if (!v) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}
function toIdArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string');
}

export default function TeamPortalPage({ context }: Props) {
  const teamLabel = context.portal.team_label ?? '팀';
  const participantIds = context.portal.participant_ids;
  const [mentors, setMentors] = useState<MentorRow[]>([]);
  const [logs, setLogs] = useState<MentoringLog[]>([]);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [memberNames, setMemberNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const programId = context.programId;

      // 1) 팀원 이름 + 멘토 + 멘토링 일지 (mentee_ids 교집합) + 설문
      const [mentorRes, logRes, surveyList, partRes] = await Promise.all([
        supabase
          .from('instructor_invitations')
          .select('id, status, role, staff_pool:staff_pool_id(name)')
          .eq('program_id', programId),
        supabase
          .from('mentoring_logs')
          .select('id, log_date, topic, content, mentee_ids')
          .eq('program_id', programId)
          .order('log_date', { ascending: false })
          .limit(50),
        getSurveysByProgram(programId),
        participantIds.length > 0
          ? supabase
              .from('program_participants')
              .select('id, name')
              .in('id', participantIds)
          : Promise.resolve({ data: [], error: null } as { data: ParticipantNameRaw[]; error: null }),
      ]);

      // 멘토 — 우선 전체 강사를 표시 (mentee_ids 매칭은 일지 단위에서)
      const mentorRows: MentorRow[] = ((mentorRes.data ?? []) as InstructorRaw[]).map((r) => {
        const staff = pickOne(r.staff_pool);
        return { id: r.id, staff_name: staff?.name ?? null, role: r.role, status: r.status };
      });
      setMentors(mentorRows);

      // 팀원 이름 매핑
      const partMap = new Map<string, string>();
      const partData = (partRes.data ?? []) as ParticipantNameRaw[];
      for (const p of partData) partMap.set(p.id, p.name);
      setMemberNames(partData.map((p) => p.name));

      // 일지 — mentee_ids 와 participant_ids 교집합 있는 것만
      const memberSet = new Set(participantIds);
      const logRows: MentoringLog[] = [];
      for (const raw of (logRes.data ?? []) as MentoringLogRaw[]) {
        const ids = toIdArray(raw.mentee_ids);
        const intersect = ids.filter((id) => memberSet.has(id));
        if (intersect.length === 0) continue;
        logRows.push({
          id: raw.id,
          log_date: raw.log_date,
          topic: raw.topic,
          content: raw.content,
          mentee_names: intersect.map((id) => partMap.get(id) ?? id),
        });
      }
      setLogs(logRows);

      // 팀 단위 설문만 표시 (target_scope='team' 또는 'all')
      const filtered = surveyList.filter((s) => s.target_scope === 'team' || s.target_scope === 'all');
      setSurveys(filtered);
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[TeamPortalPage] 로드 실패:', raw);
    } finally {
      setLoading(false);
    }
  }, [context.programId, participantIds]);

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-gradient-to-r from-teal-600 to-blue-700 text-white px-6 py-7">
        <div className="max-w-[800px] mx-auto">
          <div className="inline-flex items-center gap-1.5 bg-white/15 text-xs font-semibold px-3 py-1 rounded-full mb-3">
            <Users size={12} aria-hidden="true" /> 팀 포털
          </div>
          <h1 className="text-2xl font-extrabold leading-snug">
            {teamLabel}
            <span className="text-teal-200 ml-2 text-base font-bold">팀원 {participantIds.length}명</span>
          </h1>
          <div className="mt-1 text-sm text-teal-100">
            🏫 {context.schoolName ?? '학교 미지정'} · 📚 {context.programTitle}
          </div>
          {memberNames.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {memberNames.map((n) => (
                <span key={n} className="text-[11px] bg-white/15 px-2 py-0.5 rounded-full">{n}</span>
              ))}
            </div>
          )}
        </div>
      </header>

      <main className="max-w-[800px] mx-auto px-4 py-6 space-y-4">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-violet-500" size={24} /></div>
        ) : (
          <>
            {/* 담당 멘토 */}
            <section className="bg-white rounded-2xl shadow-sm p-5">
              <h2 className="text-sm font-bold text-slate-700 mb-3 inline-flex items-center gap-1.5">
                <Users size={16} className="text-teal-600" aria-hidden="true" /> 담당 멘토 ({mentors.length}명)
              </h2>
              {mentors.length === 0 ? (
                <p className="text-sm text-slate-400 italic text-center py-4">배정된 멘토가 없어요.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {mentors.map((m) => (
                    <div key={m.id} className="border border-slate-200 rounded-lg px-3 py-2 text-sm">
                      <div className="font-semibold">{m.staff_name ?? '미정'}</div>
                      <div className="text-xs text-slate-500">{m.role ?? '강사'} · {m.status ?? '미정'}</div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* 멘토링 일지 */}
            <section className="bg-white rounded-2xl shadow-sm p-5">
              <h2 className="text-sm font-bold text-slate-700 mb-3 inline-flex items-center gap-1.5">
                <BookOpen size={16} className="text-teal-600" aria-hidden="true" /> 멘토링 일지 ({logs.length}건)
              </h2>
              {logs.length === 0 ? (
                <p className="text-sm text-slate-400 italic text-center py-4">아직 등록된 일지가 없어요.</p>
              ) : (
                <ul className="space-y-2">
                  {logs.slice(0, 10).map((l) => (
                    <li key={l.id} className="border border-slate-100 rounded-lg p-3">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-sm font-semibold text-slate-800 truncate">{l.topic ?? '제목 없음'}</span>
                        <span className="text-[11px] text-slate-400 shrink-0">{l.log_date ?? '날짜 없음'}</span>
                      </div>
                      {l.content && <p className="text-xs text-slate-600 line-clamp-2">{l.content}</p>}
                      {l.mentee_names.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {l.mentee_names.map((n) => (
                            <span key={n} className="text-[10px] bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded">{n}</span>
                          ))}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* 배정된 설문 */}
            <section className="bg-white rounded-2xl shadow-sm p-5">
              <h2 className="text-sm font-bold text-slate-700 mb-3 inline-flex items-center gap-1.5">
                <ClipboardList size={16} className="text-teal-600" aria-hidden="true" /> 배정된 설문 ({surveys.length})
              </h2>
              {surveys.length === 0 ? (
                <p className="text-sm text-slate-400 italic text-center py-4">진행 중인 설문이 없어요.</p>
              ) : (
                <ul className="space-y-2">
                  {surveys.map((s) => (
                    <li key={s.id} className="border border-slate-200 rounded-lg p-3 flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-sm truncate">{s.title}</div>
                        {s.due_date && <div className="text-xs text-slate-500">마감 {s.due_date}</div>}
                      </div>
                      <Link to={`/survey-respond/${s.id}?t=${context.portal.portal_token}`}
                        className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded bg-teal-600 text-white hover:bg-teal-700">
                        응답하기 <ArrowRight size={12} aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>

      <footer className="bg-slate-800 text-slate-300 text-xs text-center py-5 leading-loose mt-8">
        <p className="font-bold">{context.programTitle}</p>
        <p>운영기관: (주)밸런스닷 · 문의: ks@bal24.com</p>
      </footer>
    </div>
  );
}
