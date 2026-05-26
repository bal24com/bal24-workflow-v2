// bal24 v2 — 박경수님 2026-05-26 강사 포털 [일지] 탭 fetch 헬퍼.
// StaffLogTab 본문 슬림화용 (V-1 400줄 유지).

import { supabase } from '../../../lib/supabase';
import type { ActivityLog, ActivityLogType } from '../../../types/database';
import { type MentoringLog, type MentoringLogStatus } from '../../../types/mentoring';

export type UnifiedKind = 'mentoring' | 'activity';

export interface UnifiedLog {
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
  // 멘토링 일지 상세 양식 표시용
  subject?: string | null;
  teamName?: string | null;
  menteeIds?: string[] | null;
  menteeNames?: string[];
  startTime?: string | null;
  endTime?: string | null;
  durationMin?: number | null;
  recipient?: string | null;
  status?: MentoringLogStatus;
  assignmentId?: string | null;
}

export interface AssignmentLite {
  id: string;
  mentee_ids: string[] | null;
  program: { id: string; name: string } | null;
}

export interface MenteeLite { id: string; name: string; organization: string | null }

export interface StaffLogFetchResult {
  logs: UnifiedLog[];
  assignmentsById: Map<string, AssignmentLite>;
  menteesById: Map<string, MenteeLite>;
}

interface FetchInput {
  staffId: string;
  sourceType: 'staff_pool' | 'profile';
  programId: string;
}

interface FetchOutput extends StaffLogFetchResult {
  error?: string | null;
}

export async function fetchStaffLogs({ staffId, sourceType, programId }: FetchInput): Promise<FetchOutput> {
  const unified: UnifiedLog[] = [];
  let firstError: string | null = null;

  const mentorCol = sourceType === 'staff_pool' ? 'mentor_pool_id' : 'mentor_profile_id';
  const { data: asn } = await supabase.from('mentoring_assignments')
    .select('id, mentee_ids, program:programs!mentoring_assignments_program_id_fkey(id, name)')
    .eq(mentorCol, staffId)
    .eq('program_id', programId);
  type AsnRow = { id: string; mentee_ids: string[] | null; program: { id: string; name: string } | null };
  const asnRows = ((asn ?? []) as unknown) as AsnRow[];
  const asnMap = new Map<string, AssignmentLite>(
    asnRows.map((a) => [a.id, { id: a.id, mentee_ids: a.mentee_ids, program: a.program }]),
  );
  const asnIds = asnRows.map((a) => a.id);

  // 멘티 이름 캐시
  const allMenteeIds = Array.from(new Set(asnRows.flatMap((a) => a.mentee_ids ?? [])));
  const menteeMap = new Map<string, MenteeLite>();
  if (allMenteeIds.length > 0) {
    const { data: mn } = await supabase.from('program_participants')
      .select('id, name, organization').in('id', allMenteeIds);
    ((mn ?? []) as MenteeLite[]).forEach((m) => menteeMap.set(m.id, m));
  }

  if (asnIds.length > 0) {
    const { data: ml, error: mlErr } = await supabase.from('mentoring_logs')
      .select('*').in('assignment_id', asnIds).order('log_date', { ascending: false });
    if (mlErr) {
      const m = (mlErr.message ?? '').toLowerCase();
      if (!m.includes('does not exist') && !m.includes('pgrst205')) {
        console.warn('[staff-portal/log] mentoring_logs 경고:', mlErr.message);
        firstError = mlErr.message;
      }
    } else {
      ((ml ?? []) as MentoringLog[]).forEach((l) => {
        const prog = l.assignment_id ? asnMap.get(l.assignment_id)?.program : null;
        const menteeIds = l.mentee_ids ?? [];
        const menteeNames = menteeIds
          .map((id) => menteeMap.get(id)?.name)
          .filter((n): n is string => !!n);
        unified.push({
          kind: 'mentoring',
          id: l.id,
          date: l.log_date,
          programId: prog?.id ?? l.program_id,
          programName: prog?.name ?? null,
          sessionNo: l.session_no ?? null,
          title: l.subject ?? null,
          content: l.content,
          nextPlan: l.next_plan,
          subject: l.subject,
          teamName: l.team_name,
          menteeIds,
          menteeNames,
          startTime: l.start_time,
          endTime: l.end_time,
          durationMin: l.duration_min,
          recipient: l.recipient,
          status: l.status,
          assignmentId: l.assignment_id,
        });
      });
    }
  }

  if (sourceType === 'staff_pool') {
    const { data: al, error: alErr } = await supabase.from('activity_logs')
      .select('*').eq('expert_id', staffId)
      .eq('program_id', programId)
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
      const progMap = new Map<string, string>();
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
  return { logs: unified, assignmentsById: asnMap, menteesById: menteeMap, error: firstError };
}
