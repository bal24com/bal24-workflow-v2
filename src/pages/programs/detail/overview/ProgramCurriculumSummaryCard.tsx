// bal24 v2 — 커리큘럼 요약 카드 (차시 목록 5개 + 더보기)
//   STEP-UX-FIXES — AI 드롭존은 커리큘럼 탭으로 이동, 여기는 미리보기만

import { useCallback, useEffect, useState } from 'react';
import { Loader2, ClipboardList, Sparkles, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/ui';
import { supabase } from '../../../../lib/supabase';
import type { ProgramCurriculum } from '../../../../types/database';

interface Props {
  programId: string;
  /** STEP-UX-FIXES — 커리큘럼 탭에서 차시 등록 시 부모가 증가시키는 키 */
  refreshKey?: number;
}

type CurriculumSummary = Pick<ProgramCurriculum, 'id' | 'session_no' | 'title' | 'day_label' | 'start_time' | 'end_time'> & {
  instructorName: string | null;
};

interface StaffJoin {
  curriculum_id: string;
  role: string;
  instructor_name_raw: string | null;
  staff_pool: { name: string } | { name: string }[] | null;
  profile: { name: string } | { name: string }[] | null;
}

function pickName(s: StaffJoin): string | null {
  const sp = Array.isArray(s.staff_pool) ? s.staff_pool[0] : s.staff_pool;
  const pf = Array.isArray(s.profile) ? s.profile[0] : s.profile;
  return sp?.name ?? pf?.name ?? s.instructor_name_raw ?? null;
}

export default function ProgramCurriculumSummaryCard({ programId, refreshKey }: Props) {
  const [sessions, setSessions] = useState<CurriculumSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  const reload = useCallback(async () => {
    const { data, error } = await supabase
      .from('program_curriculum')
      .select('id, session_no, title, day_label, start_time, end_time')
      .eq('program_id', programId)
      .order('session_no');
    if (error) console.error('[overview-curriculum] 조회 실패:', error.message);
    const rows = (data ?? []) as Array<Omit<CurriculumSummary, 'instructorName'>>;
    // STEP-OVERVIEW-CARD-FIX — curriculum_staff에서 강사 이름 매핑
    let instructorMap = new Map<string, string>();
    if (rows.length > 0) {
      const curIds = rows.map((r) => r.id);
      const { data: cs, error: csErr } = await supabase.from('curriculum_staff')
        .select('curriculum_id, role, instructor_name_raw, staff_pool:staff_pool(name), profile:profiles(name)')
        .in('curriculum_id', curIds);
      if (csErr) console.warn('[overview-curriculum] 강사 조회 경고:', csErr.message);
      // role='강사' 우선, 없으면 첫 번째
      const byCur = new Map<string, StaffJoin[]>();
      ((cs ?? []) as unknown as StaffJoin[]).forEach((s) => {
        const arr = byCur.get(s.curriculum_id) ?? [];
        arr.push(s); byCur.set(s.curriculum_id, arr);
      });
      byCur.forEach((arr, curId) => {
        const target = arr.find((s) => s.role === '강사') ?? arr[0];
        const name = pickName(target);
        if (name) instructorMap.set(curId, name);
      });
    }
    setSessions(rows.map((r) => ({ ...r, instructorName: instructorMap.get(r.id) ?? null })));
  }, [programId]);

  useEffect(() => {
    if (!programId) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      await reload();
      if (cancelled) return;
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [reload, programId, refreshKey]);

  const displayed = showAll ? sessions : sessions.slice(0, 5);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-bold text-[#1E1B4B] flex items-center gap-1.5">
          <ClipboardList size={14} className="text-violet-500" aria-hidden="true" />
          커리큘럼
          <span className="text-xs font-normal text-slate-500 ml-1">({sessions.length}차시)</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 size={14} className="animate-spin text-violet-400" aria-hidden="true" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-violet-200 bg-violet-50/40 p-4 text-center space-y-1.5">
            <p className="text-xs text-slate-500">등록된 커리큘럼이 없어요.</p>
            <p className="inline-flex items-center gap-1 text-[11px] font-semibold text-violet-700">
              <Sparkles size={11} aria-hidden="true" /> 커리큘럼 탭에서 AI로 추출하세요 <ArrowRight size={11} aria-hidden="true" />
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 -mx-2">
            {/* STEP-OVERVIEW-CARD-FIX — 강사 컬럼 추가 */}
            {displayed.map((s) => (
              <div key={s.id} className="grid grid-cols-[52px_minmax(80px,95px)_1fr_minmax(70px,90px)] items-center gap-2 px-2 py-1.5 text-xs">
                <span className="text-slate-400 font-bold tabular-nums">
                  {s.day_label ?? `${s.session_no}차시`}
                </span>
                <span className="text-slate-500 tabular-nums">
                  {s.start_time && s.end_time ? `${s.start_time.slice(0, 5)}~${s.end_time.slice(0, 5)}` : '—'}
                </span>
                <span className="font-medium text-slate-700 truncate">{s.title}</span>
                <span className={`text-[11px] truncate text-right ${s.instructorName ? 'text-violet-700 font-semibold' : 'text-slate-300 italic'}`}>
                  {s.instructorName ?? '미배정'}
                </span>
              </div>
            ))}
            {sessions.length > 5 && (
              <button type="button" onClick={() => setShowAll((v) => !v)}
                className="w-full text-xs text-violet-600 hover:bg-violet-50 py-2 mt-1 transition-colors">
                {showAll ? '접기' : `+${sessions.length - 5}개 더보기`}
              </button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
