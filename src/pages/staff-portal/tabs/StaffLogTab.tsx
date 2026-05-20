// bal24 v2 — STEP-STAFF-PORTAL-P4 / STEP-STAFF-PORTAL-UI-UNIFY
// 강사 포털 · 일지 탭 — mentoring_logs + activity_logs 통합 목록.
// PGRST205 안전 처리 + 타입별 필터 + 상세 펼치기.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, BookOpen, ListChecks, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../contexts/ToastContext';
import { formatDateKo } from '../../../lib/utils';
import EmptyState from '../../../components/EmptyState';
import type { ActivityLog, ActivityLogType } from '../../../types/database';
import type { MentoringLog } from '../../../types/mentoring';
import type { StaffPortalIdentity } from '../staffPortalUtils';

interface Props {
  staff: StaffPortalIdentity;
  selectedProgramId: string | null;
}

type UnifiedKind = 'mentoring' | 'activity';
type FilterKind = 'all' | UnifiedKind;
interface UnifiedLog {
  kind: UnifiedKind;
  id: string;
  date: string;
  programId: string | null;
  programName: string | null;
  sessionNo: number | null;
  title: string | null;
  content: string;
  nextPlan: string | null;
  logType?: ActivityLogType | null;
}

const CARD_CLASS =
  'bg-white rounded-2xl border border-violet-100 shadow-[0_4px_16px_rgba(124,58,237,0.08)] p-5';

const ACTIVITY_TYPE_LABEL: Record<ActivityLogType, string> = {
  mentoring: '멘토링', lecture: '강의', business_trip: '출장',
  ta: 'TA', operation: '운영', dispatch: '파견',
};

export default function StaffLogTab({ staff, selectedProgramId }: Props) {
  const toast = useToast();
  const [logs, setLogs] = useState<UnifiedLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKind>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!selectedProgramId) { setLogs([]); setLoading(false); return; }
    setLoading(true);
    const unified: UnifiedLog[] = [];

    const mentorCol = staff.sourceType === 'staff_pool' ? 'mentor_pool_id' : 'mentor_profile_id';
    const { data: asn } = await supabase.from('mentoring_assignments')
      .select('id, program:programs!mentoring_assignments_program_id_fkey(id, name)')
      .eq(mentorCol, staff.id)
      .eq('program_id', selectedProgramId);
    type AsnRow = { id: string; program: { id: string; name: string } | null };
    const asnRows = ((asn ?? []) as unknown) as AsnRow[];
    const asnMap = new Map(asnRows.map((a) => [a.id, a.program]));
    const asnIds = asnRows.map((a) => a.id);

    if (asnIds.length > 0) {
      const { data: ml, error: mlErr } = await supabase.from('mentoring_logs')
        .select('*').in('assignment_id', asnIds).order('log_date', { ascending: false });
      if (mlErr) {
        const m = (mlErr.message ?? '').toLowerCase();
        if (!m.includes('does not exist') && !m.includes('pgrst205')) {
          console.warn('[staff-portal/log] mentoring_logs 경고:', mlErr.message);
          toast.error('멘토링 일지 조회 중 오류가 발생했어요.');
        }
      } else {
        ((ml ?? []) as MentoringLog[]).forEach((l) => {
          const prog = l.assignment_id ? asnMap.get(l.assignment_id) : null;
          unified.push({
            kind: 'mentoring',
            id: l.id,
            date: l.log_date,
            programId: prog?.id ?? l.program_id,
            programName: prog?.name ?? null,
            sessionNo: l.session_no ?? null,
            title: null,
            content: l.content,
            nextPlan: l.next_plan,
          });
        });
      }
    }

    if (staff.sourceType === 'staff_pool') {
      const { data: al, error: alErr } = await supabase.from('activity_logs')
        .select('*').eq('expert_id', staff.id)
        .eq('program_id', selectedProgramId)
        .is('deleted_at', null)
        .order('activity_date', { ascending: false });
      if (alErr) {
        const m = (alErr.message ?? '').toLowerCase();
        if (!m.includes('does not exist') && !m.includes('pgrst205')) {
          console.warn('[staff-portal/log] activity_logs 경고:', alErr.message);
        }
      } else {
        const progIds = new Set<string>();
        ((al ?? []) as ActivityLog[]).forEach((l) => { if (l.program_id) progIds.add(l.program_id); });
        let progMap = new Map<string, string>();
        if (progIds.size > 0) {
          const { data: prog } = await supabase.from('programs').select('id, name').in('id', Array.from(progIds));
          (prog ?? []).forEach((p) => progMap.set(p.id as string, p.name as string));
        }
        ((al ?? []) as ActivityLog[]).forEach((l) => {
          unified.push({
            kind: 'activity',
            id: l.id,
            date: l.activity_date,
            programId: l.program_id ?? null,
            programName: l.program_id ? progMap.get(l.program_id) ?? null : null,
            sessionNo: null,
            title: l.title,
            content: l.content ?? '',
            nextPlan: l.next_plan ?? null,
            logType: l.log_type,
          });
        });
      }
    }

    unified.sort((a, b) => b.date.localeCompare(a.date));
    setLogs(unified);
    setLoading(false);
  }, [staff.id, staff.sourceType, selectedProgramId, toast]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const visible = useMemo(() => filter === 'all' ? logs : logs.filter((l) => l.kind === filter), [logs, filter]);
  const counts = useMemo(() => ({
    all: logs.length,
    mentoring: logs.filter((l) => l.kind === 'mentoring').length,
    activity: logs.filter((l) => l.kind === 'activity').length,
  }), [logs]);

  if (!selectedProgramId) {
    return (
      <div className={CARD_CLASS}>
        <EmptyState emoji="🎯" title="먼저 개요 탭에서 프로그램을 선택해 주세요."
          description="선택된 프로그램의 일지만 표시돼요." />
      </div>
    );
  }
  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-violet-400" /></div>;
  }

  return (
    <div className="space-y-4">
      <section className={CARD_CLASS}>
        <header className="flex items-center justify-between gap-2 flex-wrap mb-3">
          <h2 className="text-base font-bold text-[#1E1B4B] flex items-center gap-2">
            <FileText size={16} className="text-violet-500" aria-hidden="true" />
            내 일지 ({logs.length}건)
          </h2>
        </header>

        {/* 필터 */}
        <nav role="tablist" aria-label="일지 필터" className="flex gap-1.5 flex-wrap mb-4">
          {([
            { key: 'all', label: '전체' },
            { key: 'mentoring', label: '멘토링 일지' },
            { key: 'activity', label: '활동 일지' },
          ] as const).map((f) => {
            const active = filter === f.key;
            return (
              <button key={f.key} type="button" role="tab" aria-selected={active}
                onClick={() => setFilter(f.key)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  active
                    ? 'bg-violet-600 text-white'
                    : 'text-slate-500 hover:text-violet-600 hover:bg-violet-50'
                }`}>
                {f.label}
                <span className={`inline-flex items-center justify-center min-w-[1.25rem] px-1 rounded text-[10px] ${active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>{counts[f.key]}</span>
              </button>
            );
          })}
        </nav>

        {visible.length === 0 ? (
          <EmptyState emoji="📝"
            title={logs.length === 0 ? '아직 작성된 일지가 없어요.' : '조건에 맞는 일지가 없어요.'} />
        ) : (
          <ul className="space-y-2">
            {visible.map((l) => {
              const expanded = expandedId === l.id;
              const kindBadge = l.kind === 'mentoring' ? '멘토링' : '활동';
              const kindStyle = l.kind === 'mentoring'
                ? 'bg-violet-100 text-violet-700' : 'bg-cyan-100 text-cyan-700';
              const Icon = l.kind === 'mentoring' ? BookOpen : ListChecks;
              return (
                <li key={`${l.kind}-${l.id}`} className="rounded-xl border border-violet-100 bg-violet-50/30 p-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${kindStyle}`}>
                      <Icon size={10} aria-hidden="true" />{kindBadge}
                    </span>
                    <span className="text-xs font-bold text-slate-700 tabular-nums">{formatDateKo(l.date)}</span>
                    {l.sessionNo != null && (
                      <span className="text-[10px] px-1 py-0.5 rounded bg-violet-100 text-violet-700 font-semibold">{l.sessionNo}회차</span>
                    )}
                    {l.logType && (
                      <span className="text-[10px] px-1 py-0.5 rounded bg-slate-100 text-slate-600">{ACTIVITY_TYPE_LABEL[l.logType]}</span>
                    )}
                    {l.programName && (
                      <span className="text-xs text-slate-500 ml-auto truncate max-w-[40%]">{l.programName}</span>
                    )}
                  </div>
                  {l.title && <p className="text-sm font-semibold text-[#1E1B4B] mt-2">{l.title}</p>}
                  <p className={`mt-1.5 text-sm text-slate-700 whitespace-pre-wrap ${expanded ? '' : 'line-clamp-2'}`}>{l.content}</p>
                  {expanded && l.nextPlan && (
                    <p className="mt-2 text-xs text-slate-600">
                      <span className="font-bold text-slate-700">다음 계획:</span> {l.nextPlan}
                    </p>
                  )}
                  <div className="flex justify-end mt-2">
                    <button type="button" onClick={() => setExpandedId(expanded ? null : l.id)}
                      className="inline-flex items-center gap-0.5 text-xs text-violet-600 hover:underline">
                      {expanded ? <><ChevronUp size={12} /> 접기</> : <><ChevronDown size={12} /> 상세 보기</>}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
