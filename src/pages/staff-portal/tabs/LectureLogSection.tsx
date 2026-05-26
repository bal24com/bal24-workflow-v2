// bal24 v2 — STEP-PORTAL-LECTURE-LOG-REDESIGN (박경수님 2026-05-26)
// 강사 포털 · [일지 → 강의일지] 서브탭 패널.
// 전체 커리큘럼 테이블 + 본인 담당 배지 + 작성하기/이어쓰기/보기 + 인라인 폼 슬라이드 다운.

import { Fragment, useCallback, useEffect, useState, type ReactElement } from 'react';
import { Loader2, PencilLine, CheckCircle2, FileText } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../contexts/ToastContext';
import { formatDateKo } from '../../../lib/utils';
import EmptyState from '../../../components/EmptyState';
import type { StaffPortalIdentity } from '../staffPortalUtils';
import LectureLogForm, { type LectureLogRow, type LectureLogPhoto } from './LectureLogForm';
import PortalCommentView from '../../../components/portal/PortalCommentView';

interface Props {
  staff: StaffPortalIdentity;
  programId: string;
}

interface CurriculumRow {
  id: string; session_no: number; title: string;
  session_date: string | null; start_time: string | null; end_time: string | null;
  mine: boolean;
}

const CARD_CLASS =
  'bg-white rounded-2xl border border-violet-100 shadow-[0_4px_16px_rgba(124,58,237,0.08)] p-5';

function trimTime(t: string | null): string { return t ? t.slice(0, 5) : ''; }

export default function LectureLogSection({ staff, programId }: Props) {
  const toast = useToast();
  const [curriculums, setCurriculums] = useState<CurriculumRow[]>([]);
  const [logs, setLogs] = useState<Record<string, LectureLogRow>>({});
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // 박경수님 환경: staff_pool 강사만 일지 작성 가능 (profile 강사는 별도 흐름)
  const canWrite = staff.sourceType === 'staff_pool';

  const fetchData = useCallback(async () => {
    setLoading(true);

    // 1) 전체 커리큘럼
    const { data: cur } = await supabase.from('program_curriculum')
      .select('id, session_no, title, session_date, start_time, end_time')
      .eq('program_id', programId)
      .order('session_no', { ascending: true });

    // 2) 본인 담당 차시 (curriculum_staff)
    const staffCol = staff.sourceType === 'staff_pool' ? 'staff_pool_id' : 'profile_id';
    const { data: cs } = await supabase.from('curriculum_staff')
      .select('curriculum_id').eq(staffCol, staff.id);
    const mineSet = new Set(((cs ?? []) as Array<{ curriculum_id: string }>).map((r) => r.curriculum_id));

    type CurRaw = {
      id: string; session_no: number; title: string;
      session_date: string | null; start_time: string | null; end_time: string | null;
    };
    const rows: CurriculumRow[] = ((cur ?? []) as CurRaw[]).map((c) => ({
      id: c.id, session_no: c.session_no, title: c.title,
      session_date: c.session_date, start_time: c.start_time, end_time: c.end_time,
      mine: mineSet.has(c.id),
    }));
    setCurriculums(rows);

    // 3) 내 일지 (curriculum_logs where staff_id = 본인)
    const curIds = rows.map((r) => r.id);
    if (curIds.length > 0 && canWrite) {
      const { data: log, error: logErr } = await supabase.from('curriculum_logs')
        .select('id, curriculum_id, staff_id, program_id, content, photos, status, submitted_at')
        .in('curriculum_id', curIds).eq('staff_id', staff.id);
      if (logErr) {
        console.warn('[LectureLog] 일지 조회 경고:', logErr.message);
      } else {
        const map: Record<string, LectureLogRow> = {};
        ((log ?? []) as LectureLogRow[]).forEach((l) => {
          map[l.curriculum_id] = { ...l, photos: (l.photos ?? []) as LectureLogPhoto[] };
        });
        setLogs(map);
      }
    } else {
      setLogs({});
    }
    setLoading(false);
  }, [programId, staff.id, staff.sourceType, canWrite]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className={CARD_CLASS}>
        <div className="flex justify-center py-6">
          <Loader2 size={18} className="animate-spin text-violet-400" aria-hidden="true" />
        </div>
      </div>
    );
  }
  if (curriculums.length === 0) {
    return (
      <div className={CARD_CLASS}>
        <EmptyState emoji="📚" title="등록된 커리큘럼이 없어요."
          description="PM이 커리큘럼을 등록하면 차시별로 일지를 작성할 수 있어요." />
      </div>
    );
  }

  const myCount = Object.keys(logs).length;

  return (
    <section className={CARD_CLASS}>
      <header className="mb-3">
        <h2 className="text-base font-bold text-[#1E1B4B] flex items-center gap-2">
          <PencilLine size={16} className="text-violet-500" aria-hidden="true" />
          강의일지
          <span className="text-xs font-normal text-slate-500">
            (전체 {curriculums.length}차시 / 내가 작성한 일지 {myCount}건)
          </span>
        </h2>
        <p className="mt-1.5 text-[11px] text-cyan-700 bg-cyan-50 border border-cyan-200 rounded-lg px-2.5 py-1.5">
          💡 전체 커리큘럼에 대해 일지를 작성할 수 있어요. 담당 차시가 아니어도 참관·보조 활동을 기록할 수 있어요.
        </p>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-violet-50/50 text-slate-500 text-xs">
            <tr>
              <th className="text-left px-3 py-2 font-semibold w-16">차시</th>
              <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">날짜</th>
              <th className="text-left px-3 py-2 font-semibold">제목</th>
              <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">시간</th>
              <th className="text-center px-3 py-2 font-semibold whitespace-nowrap">내 일지 상태</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {curriculums.map((c) => {
              const log = logs[c.id];
              const expanded = expandedId === c.id;
              const statusBadge = renderStatus(log);
              return (
                <Fragment key={c.id}>
                  <tr
                    className={`${c.mine ? 'bg-violet-50/40' : ''} ${canWrite ? 'cursor-pointer hover:bg-violet-50' : ''}`}
                    onClick={canWrite ? () => setExpandedId(expanded ? null : c.id) : undefined}>
                    <td className="px-3 py-2 text-xs font-bold text-violet-700 tabular-nums">
                      <span className="inline-flex items-center gap-1">
                        {c.session_no}차시
                        {c.mine && (
                          <span className="ml-1 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-violet-100 text-violet-700 border border-violet-200">
                            👤 담당
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600 tabular-nums whitespace-nowrap">
                      {formatDateKo(c.session_date) || '-'}
                    </td>
                    <td className="px-3 py-2 text-sm font-medium text-slate-800">{c.title}</td>
                    <td className="px-3 py-2 text-xs text-slate-600 tabular-nums whitespace-nowrap">
                      {c.start_time || c.end_time
                        ? `${trimTime(c.start_time)}${c.end_time ? `~${trimTime(c.end_time)}` : ''}`
                        : '-'}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {canWrite ? statusBadge : <span className="text-[10px] text-slate-400">읽기 전용</span>}
                    </td>
                  </tr>
                  {expanded && canWrite && (
                    <tr className="bg-amber-50/30">
                      <td colSpan={5} className="px-3 py-3 border-t border-amber-200">
                        <LectureLogForm
                          curriculum={{
                            id: c.id, session_no: c.session_no, title: c.title,
                            session_date: c.session_date,
                          }}
                          staffId={staff.id}
                          staffName={staff.name}
                          staffAffiliation={staff.affiliation}
                          programId={programId}
                          existing={log ?? null}
                          onSaved={(next) => {
                            setLogs((prev) => ({ ...prev, [c.id]: next }));
                          }}
                          onClose={() => setExpandedId(null)}
                          toast={toast}
                        />
                        {/* 박경수님 2026-05-26 PART G — 강의일지 PM 댓글 (저장된 일지 있을 때만) */}
                        {log?.id && (
                          <PortalCommentView targetType="curriculum_log" targetId={log.id} />
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function renderStatus(log: LectureLogRow | undefined): ReactElement {
  if (!log) {
    return (
      <span className="inline-flex items-center gap-0.5 px-2 py-1 rounded-md text-[10px] font-bold text-violet-700 border border-violet-300 hover:bg-violet-50">
        <PencilLine size={10} aria-hidden="true" /> 작성하기
      </span>
    );
  }
  if (log.status === 'submitted') {
    return (
      <span className="inline-flex items-center gap-0.5 px-2 py-1 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-700">
        <CheckCircle2 size={10} aria-hidden="true" /> 제출완료 · 보기
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 px-2 py-1 rounded-md text-[10px] font-bold bg-amber-100 text-amber-700">
      <FileText size={10} aria-hidden="true" /> 임시저장 · 이어쓰기
    </span>
  );
}
