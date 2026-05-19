// bal24 v2 — STEP-STAFF-PORTAL-P4
// 전문가 활동 이력 드로어 (우측 슬라이드) — 참여 프로그램 + 최근 멘토링 일지 + 최근 활동 일지.

import { useCallback, useEffect, useState } from 'react';
import { X, Loader2, BookOpen, ListChecks, ExternalLink, Briefcase } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatDateKo } from '../../lib/utils';
import type { StaffPool, ActivityLog } from '../../types/database';
import type { MentoringLog } from '../../types/mentoring';

interface Props {
  expert: StaffPool | null;
  onClose: () => void;
}

interface ProgramLite { id: string; name: string; tag: '강의' | '멘토링' }

export default function ExpertActivityDrawer({ expert, onClose }: Props) {
  const [programs, setPrograms] = useState<ProgramLite[]>([]);
  const [mentoringLogs, setMentoringLogs] = useState<MentoringLog[]>([]);
  const [activityLogs, setActivityLogs] = useState<Pick<ActivityLog, 'id' | 'log_type' | 'title' | 'activity_date'>[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async (expertId: string) => {
    setLoading(true);
    // 1) curriculum_staff → 강의 프로그램
    const { data: cs } = await supabase.from('curriculum_staff')
      .select('curriculum:program_curriculum!inner(program_id)').eq('staff_pool_id', expertId);
    type CsRow = { curriculum: { program_id: string } | { program_id: string }[] | null };
    const lectureProgIds = new Set<string>();
    ((cs ?? []) as unknown as CsRow[]).forEach((r) => {
      const c = Array.isArray(r.curriculum) ? r.curriculum[0] : r.curriculum;
      if (c?.program_id) lectureProgIds.add(c.program_id);
    });

    // 2) mentoring_assignments → 멘토링 프로그램
    const { data: asn } = await supabase.from('mentoring_assignments')
      .select('id, program_id').eq('mentor_pool_id', expertId);
    type AsnRow = { id: string; program_id: string | null };
    const asnRows = (asn ?? []) as AsnRow[];
    const mentoringProgIds = new Set(asnRows.map((a) => a.program_id).filter(Boolean) as string[]);
    const asnIds = asnRows.map((a) => a.id);

    // 3) programs 이름 일괄 조회
    const allProgIds = Array.from(new Set([...lectureProgIds, ...mentoringProgIds]));
    let progMap = new Map<string, string>();
    if (allProgIds.length > 0) {
      const { data: prog } = await supabase.from('programs').select('id, name').in('id', allProgIds);
      (prog ?? []).forEach((p) => progMap.set(p.id as string, p.name as string));
    }
    const progRows: ProgramLite[] = [];
    lectureProgIds.forEach((pid) => progRows.push({ id: pid, name: progMap.get(pid) ?? '(미지정)', tag: '강의' }));
    mentoringProgIds.forEach((pid) => {
      if (!lectureProgIds.has(pid)) progRows.push({ id: pid, name: progMap.get(pid) ?? '(미지정)', tag: '멘토링' });
    });
    setPrograms(progRows);

    // 4) mentoring_logs 최근 5건 (PGRST205 안전)
    if (asnIds.length > 0) {
      const { data: ml, error: mlErr } = await supabase.from('mentoring_logs')
        .select('*').in('assignment_id', asnIds).order('log_date', { ascending: false }).limit(5);
      if (mlErr) {
        const m = (mlErr.message ?? '').toLowerCase();
        if (!m.includes('does not exist') && !m.includes('pgrst205')) console.warn('[expert-drawer] 멘토링 일지 경고:', mlErr.message);
        setMentoringLogs([]);
      } else setMentoringLogs((ml ?? []) as MentoringLog[]);
    } else setMentoringLogs([]);

    // 5) activity_logs 최근 5건 (PGRST205 안전, expert_id 단일 컬럼)
    const { data: al, error: alErr } = await supabase.from('activity_logs')
      .select('id, log_type, title, activity_date').eq('expert_id', expertId)
      .is('deleted_at', null).order('activity_date', { ascending: false }).limit(5);
    if (alErr) {
      const m = (alErr.message ?? '').toLowerCase();
      if (!m.includes('does not exist') && !m.includes('pgrst205')) console.warn('[expert-drawer] 활동 일지 경고:', alErr.message);
      setActivityLogs([]);
    } else setActivityLogs((al ?? []) as Pick<ActivityLog, 'id' | 'log_type' | 'title' | 'activity_date'>[]);

    setLoading(false);
  }, []);

  useEffect(() => {
    if (!expert) return;
    void fetchData(expert.id);
  }, [expert, fetchData]);

  if (!expert) return null;

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/40 z-40" onClick={onClose} aria-hidden="true" />
      <aside className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-md bg-white shadow-2xl flex flex-col"
        role="dialog" aria-label={`${expert.name} 활동 이력`}>
        <header className="flex items-center justify-between gap-2 px-5 py-4 border-b border-slate-200">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-[#1E1B4B] truncate">{expert.name}</h2>
            {expert.organization && <p className="text-xs text-slate-500 truncate">{expert.organization}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="닫기"
            className="p-1.5 rounded-md text-slate-400 hover:bg-slate-100">
            <X size={16} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-violet-400" /></div>
          ) : (
            <>
              {/* 참여 프로그램 */}
              <section>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                  <Briefcase size={11} aria-hidden="true" /> 참여 프로그램 ({programs.length}개)
                </h3>
                {programs.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">참여 이력이 없어요.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {programs.map((p) => (
                      <li key={`${p.id}-${p.tag}`} className="flex items-center gap-2 rounded-lg border border-slate-100 bg-violet-50/30 px-3 py-2">
                        <span className="text-sm font-semibold text-[#1E1B4B] truncate flex-1">{p.name}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${p.tag === '강의' ? 'bg-blue-100 text-blue-700' : 'bg-violet-100 text-violet-700'}`}>{p.tag}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* 최근 멘토링 일지 */}
              <section>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                  <BookOpen size={11} aria-hidden="true" /> 최근 멘토링 일지 ({mentoringLogs.length}건)
                </h3>
                {mentoringLogs.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">작성된 멘토링 일지가 없어요.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {mentoringLogs.map((l) => (
                      <li key={l.id} className="rounded-lg border border-slate-100 bg-violet-50/30 px-3 py-2">
                        <div className="flex items-center gap-1.5 text-[10px]">
                          <span className="font-bold text-slate-700 tabular-nums">{formatDateKo(l.log_date)}</span>
                          <span className="px-1 py-0.5 rounded bg-violet-100 text-violet-700 font-semibold">{l.session_no ?? 1}회차</span>
                        </div>
                        <p className="mt-1 text-xs text-slate-700 line-clamp-2">{l.content}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* 최근 활동 일지 */}
              <section>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                  <ListChecks size={11} aria-hidden="true" /> 최근 활동 일지 ({activityLogs.length}건)
                </h3>
                {activityLogs.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">작성된 활동 일지가 없어요.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {activityLogs.map((l) => (
                      <li key={l.id} className="rounded-lg border border-slate-100 bg-cyan-50/30 px-3 py-2 flex items-center gap-2">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cyan-100 text-cyan-700">{l.log_type}</span>
                        <span className="text-xs font-semibold text-slate-700 truncate flex-1">{l.title}</span>
                        <span className="text-[10px] text-slate-500 tabular-nums shrink-0">{formatDateKo(l.activity_date)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </div>

        {/* 푸터 — 포털 바로가기 */}
        {expert.staff_portal_token && (
          <footer className="border-t border-slate-200 px-5 py-3">
            <a href={`/staff-portal/${expert.staff_portal_token}`} target="_blank" rel="noreferrer"
              className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-bold hover:bg-violet-700">
              <ExternalLink size={14} aria-hidden="true" />
              포털 바로가기
            </a>
          </footer>
        )}
      </aside>
    </>
  );
}
