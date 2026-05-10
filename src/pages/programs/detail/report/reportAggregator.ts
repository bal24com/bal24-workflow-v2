// bal24 v2 — 결과보고서 8 자동집계 섹션 (Stage 2)
// 진입 시 program_id 기준 SQL 집계 → markdown 텍스트로 변환.

import { supabase } from '../../../../lib/supabase';
import { formatDateKo, formatMoney } from '../../../../lib/utils';
import type {
  ProgramCurriculum, CurriculumStaff, InstructorInvitation, SurveyAnswer,
} from '../../../../types/database';
import type { ParticipantStatus } from '../../../../types/application';
import { PARTICIPANT_STATUS_LABEL } from '../programDetailUtils';

export type AutoSectionKey =
  | 'overview'
  | 'participants'
  | 'attendance'
  | 'curriculum'
  | 'staff'
  | 'survey'
  | 'budget'
  | 'outcomes';

export interface AutoSectionDef {
  key: AutoSectionKey;
  title: string;
}

export const AUTO_SECTIONS: AutoSectionDef[] = [
  { key: 'overview',     title: '사업개요' },
  { key: 'participants', title: '참여인원' },
  { key: 'attendance',   title: '출석현황' },
  { key: 'curriculum',   title: '커리큘럼' },
  { key: 'staff',        title: '강사현황' },
  { key: 'survey',       title: '만족도' },
  { key: 'budget',       title: '예산집행' },
  { key: 'outcomes',     title: '결과물' },
];

const NOT_AVAILABLE = '_(자료 없음)_';

function logErr(label: string, msg?: string) {
  if (msg) console.error(`[report-aggregator] ${label}:`, msg);
}

async function aggregateOverview(programId: string): Promise<string> {
  const { data, error } = await supabase
    .from('programs')
    .select('name, type, status, start_date, end_date, venue, capacity, description, goal_text, project:projects(name)')
    .eq('id', programId)
    .maybeSingle();
  if (error) logErr('overview', error.message);
  if (!data) return NOT_AVAILABLE;

  type Row = {
    name: string; type: string; status: string;
    start_date: string | null; end_date: string | null;
    venue: string | null; capacity: number | null;
    description: string | null; goal_text: string | null;
    project: { name: string } | { name: string }[] | null;
  };
  const r = data as Row;
  const project = Array.isArray(r.project) ? r.project[0] : r.project;
  const period =
    r.start_date || r.end_date
      ? `${formatDateKo(r.start_date) || '미정'} ~ ${formatDateKo(r.end_date) || '미정'}`
      : '미정';

  const lines: string[] = [
    `- **프로그램명**: ${r.name}`,
    `- **유형**: ${r.type}`,
    `- **상태**: ${r.status}`,
    `- **기간**: ${period}`,
    `- **장소**: ${r.venue ?? '미정'}`,
    `- **정원**: ${r.capacity != null ? `${r.capacity}명` : '미정'}`,
  ];
  if (project?.name) lines.push(`- **연결 프로젝트**: ${project.name}`);
  if (r.description) lines.push('', '### 요약', r.description);
  if (r.goal_text) lines.push('', '### 성과 목표', r.goal_text);
  return lines.join('\n');
}

async function aggregateParticipants(programId: string): Promise<string> {
  const { data, error } = await supabase
    .from('participant_applications')
    .select('status')
    .eq('program_id', programId)
    .is('deleted_at', null);
  if (error) logErr('participants', error.message);
  const rows = (data as Array<{ status: ParticipantStatus }> | null) ?? [];
  if (rows.length === 0) return NOT_AVAILABLE;

  const counts: Record<string, number> = {};
  rows.forEach((r) => {
    counts[r.status] = (counts[r.status] ?? 0) + 1;
  });
  const lines: string[] = [`- **총 신청**: ${rows.length}명`];
  Object.entries(counts).forEach(([s, n]) => {
    const label = PARTICIPANT_STATUS_LABEL[s as ParticipantStatus] ?? s;
    lines.push(`  - ${label}: ${n}명`);
  });
  return lines.join('\n');
}

async function aggregateAttendance(programId: string): Promise<string> {
  const sessionsRes = await supabase
    .from('attendance_sessions')
    .select('id, title, session_date, records:attendance_records(id)')
    .eq('program_id', programId)
    .order('session_date', { ascending: true });
  if (sessionsRes.error) logErr('attendance', sessionsRes.error.message);
  type Row = {
    id: string; title: string; session_date: string;
    records: { id: string }[];
  };
  const rows = (sessionsRes.data as Row[] | null) ?? [];
  if (rows.length === 0) return NOT_AVAILABLE;
  const totalChecked = rows.reduce((s, r) => s + r.records.length, 0);
  const lines: string[] = [
    `- **총 세션**: ${rows.length}회`,
    `- **누적 체크인**: ${totalChecked}건`,
    '',
    '### 세션별',
  ];
  rows.forEach((r) => {
    lines.push(`- ${formatDateKo(r.session_date)} · ${r.title} — ${r.records.length}명`);
  });
  return lines.join('\n');
}

async function aggregateCurriculum(programId: string): Promise<string> {
  // STEP-CURRICULUM-FULL — programs.report_curriculum_type 기준으로 planned/actual 선택
  const progRes = await supabase.from('programs').select('report_curriculum_type').eq('id', programId).maybeSingle();
  const curriculumType = (progRes.data as { report_curriculum_type?: 'planned' | 'actual' } | null)?.report_curriculum_type ?? 'planned';
  const curRes = await supabase
    .from('program_curriculum')
    .select('id, session_no, title, session_date, duration, venue')
    .eq('program_id', programId)
    .eq('curriculum_type', curriculumType)
    .order('session_no', { ascending: true });
  if (curRes.error) logErr('curriculum', curRes.error.message);
  const rows = (curRes.data as Pick<
    ProgramCurriculum,
    'id' | 'session_no' | 'title' | 'session_date' | 'duration' | 'venue'
  >[] | null) ?? [];
  if (rows.length === 0) return NOT_AVAILABLE;

  const ids = rows.map((r) => r.id);
  const staffRes = await supabase
    .from('curriculum_staff')
    .select('curriculum_id, role, staff_pool:staff_pool(name), profile:profiles(name)')
    .in('curriculum_id', ids);
  type StaffRow = {
    curriculum_id: string;
    role: string;
    staff_pool: { name: string } | { name: string }[] | null;
    profile: { name: string } | { name: string }[] | null;
  };
  const staffByCur: Record<string, string[]> = {};
  ((staffRes.data as StaffRow[] | null) ?? []).forEach((s) => {
    const sp = Array.isArray(s.staff_pool) ? s.staff_pool[0] : s.staff_pool;
    const pf = Array.isArray(s.profile) ? s.profile[0] : s.profile;
    const name = sp?.name ?? pf?.name ?? '?';
    (staffByCur[s.curriculum_id] ||= []).push(`${name}(${s.role})`);
  });

  const lines: string[] = [`- **총 차시**: ${rows.length}회`, ''];
  rows.forEach((r) => {
    const date = r.session_date ? formatDateKo(r.session_date) : '날짜 미정';
    const dur = r.duration != null ? ` · ${r.duration}분` : '';
    const staff = staffByCur[r.id]?.length ? ` · ${staffByCur[r.id].join(', ')}` : '';
    lines.push(`- **${r.session_no}차시**: ${r.title} (${date}${dur})${staff}`);
  });
  return lines.join('\n');
}

async function aggregateStaff(programId: string): Promise<string> {
  const invRes = await supabase
    .from('instructor_invitations')
    .select('name, role, status, lecture_fee')
    .eq('program_id', programId);
  if (invRes.error) logErr('staff/invitations', invRes.error.message);

  const cstRes = await supabase
    .from('curriculum_staff')
    .select('role, status, fee, staff_pool:staff_pool(name), profile:profiles(name), curriculum:program_curriculum!inner(program_id)')
    .eq('curriculum.program_id', programId);
  if (cstRes.error) logErr('staff/curriculum_staff', cstRes.error.message);

  type InvRow = Pick<InstructorInvitation, 'name' | 'role' | 'status' | 'lecture_fee'>;
  type CstJoin = Pick<CurriculumStaff, 'role' | 'status' | 'fee'> & {
    staff_pool: { name: string } | { name: string }[] | null;
    profile: { name: string } | { name: string }[] | null;
  };
  const invs = (invRes.data as InvRow[] | null) ?? [];
  const csts = (cstRes.data as CstJoin[] | null) ?? [];

  if (invs.length === 0 && csts.length === 0) return NOT_AVAILABLE;
  const lines: string[] = [];
  if (invs.length > 0) {
    lines.push(`### 강사 초빙 (${invs.length}건)`);
    invs.forEach((i) => {
      const fee = i.lecture_fee != null ? ` · ${formatMoney(i.lecture_fee)}` : '';
      const role = i.role ?? '강사';
      lines.push(`- ${i.name} (${role}) — ${i.status}${fee}`);
    });
    if (csts.length > 0) lines.push('');
  }
  if (csts.length > 0) {
    lines.push(`### 커리큘럼 매칭 (${csts.length}건)`);
    csts.forEach((c) => {
      const sp = Array.isArray(c.staff_pool) ? c.staff_pool[0] : c.staff_pool;
      const pf = Array.isArray(c.profile) ? c.profile[0] : c.profile;
      const name = sp?.name ?? pf?.name ?? '?';
      const fee = c.fee != null ? ` · ${formatMoney(c.fee)}` : '';
      lines.push(`- ${name} (${c.role}) — ${c.status}${fee}`);
    });
  }
  return lines.join('\n');
}

async function aggregateSurvey(programId: string): Promise<string> {
  const { data, error } = await supabase
    .from('surveys')
    .select('type, answers')
    .eq('program_id', programId);
  if (error) logErr('survey', error.message);
  type Row = { type: string; answers: SurveyAnswer[] | null };
  const rows = (data as Row[] | null) ?? [];
  if (rows.length === 0) return NOT_AVAILABLE;

  const byType: Record<string, { count: number; total: number; n: number }> = {};
  rows.forEach((r) => {
    if (!byType[r.type]) byType[r.type] = { count: 0, total: 0, n: 0 };
    const b = byType[r.type];
    b.count += 1;
    (r.answers ?? []).forEach((a) => {
      if (typeof a.rating === 'number') {
        b.total += a.rating;
        b.n += 1;
      }
    });
  });

  const lines: string[] = [`- **총 응답**: ${rows.length}건`];
  Object.entries(byType).forEach(([t, b]) => {
    const avg = b.n > 0 ? Math.round((b.total / b.n) * 10) / 10 : null;
    lines.push(`  - ${t}: ${b.count}건${avg != null ? ` · 평균 ${avg}점` : ''}`);
  });
  return lines.join('\n');
}

async function aggregateBudget(programId: string): Promise<string> {
  const programRes = await supabase
    .from('programs')
    .select('project_id')
    .eq('id', programId)
    .maybeSingle();
  if (programRes.error) logErr('budget/program', programRes.error.message);
  const projectId = (programRes.data as { project_id: string | null } | null)?.project_id;
  if (!projectId) return NOT_AVAILABLE + ' (연결된 프로젝트 없음)';

  const [incomeRes, expenseRes] = await Promise.all([
    supabase
      .from('income')
      .select('amount, status')
      .eq('project_id', projectId)
      .is('deleted_at', null),
    supabase
      .from('expenses')
      .select('gross_amount, status')
      .eq('project_id', projectId)
      .is('deleted_at', null),
  ]);
  if (incomeRes.error) logErr('budget/income', incomeRes.error.message);
  if (expenseRes.error) logErr('budget/expense', expenseRes.error.message);

  const incomes = (incomeRes.data as Array<{ amount: number | string; status: string }> | null) ?? [];
  const expenses = (expenseRes.data as Array<{ gross_amount: number | string; status: string }> | null) ?? [];
  if (incomes.length === 0 && expenses.length === 0) return NOT_AVAILABLE;

  const incomeReceived = incomes.filter((r) => r.status === '입금완료').reduce((s, r) => s + Number(r.amount ?? 0), 0);
  const expenseTotal = expenses.reduce((s, r) => s + Number(r.gross_amount ?? 0), 0);
  const expensePending = expenses.filter((r) => r.status === '대기').reduce((s, r) => s + Number(r.gross_amount ?? 0), 0);

  return [
    `- **수입(입금완료)**: ${formatMoney(incomeReceived)} (${incomes.length}건)`,
    `- **지출 합계**: ${formatMoney(expenseTotal)} (${expenses.length}건)`,
    `  - 대기 지출: ${formatMoney(expensePending)}`,
    `- **수입 - 지출 잔여**: ${formatMoney(incomeReceived - expenseTotal)}`,
    '',
    '_프로그램이 속한 프로젝트의 수입·지출 합산입니다._',
  ].join('\n');
}

async function aggregateOutcomes(programId: string): Promise<string> {
  const { data, error } = await supabase
    .from('public_forms')
    .select('id, title, form_type, applications:form_applications(id)')
    .eq('program_id', programId)
    .order('created_at', { ascending: false });
  if (error) logErr('outcomes', error.message);
  type Row = { id: string; title: string; form_type: string; applications: { id: string }[] };
  const rows = (data as Row[] | null) ?? [];
  if (rows.length === 0) return NOT_AVAILABLE;

  const lines: string[] = [`- **총 폼**: ${rows.length}개`];
  rows.forEach((r) => {
    lines.push(`  - [${r.form_type}] ${r.title} — 응답 ${r.applications.length}건`);
  });
  return lines.join('\n');
}

const AGGREGATORS: Record<AutoSectionKey, (programId: string) => Promise<string>> = {
  overview: aggregateOverview,
  participants: aggregateParticipants,
  attendance: aggregateAttendance,
  curriculum: aggregateCurriculum,
  staff: aggregateStaff,
  survey: aggregateSurvey,
  budget: aggregateBudget,
  outcomes: aggregateOutcomes,
};

export async function aggregateSection(key: AutoSectionKey, programId: string): Promise<string> {
  const fn = AGGREGATORS[key];
  if (!fn) return NOT_AVAILABLE;
  try {
    return await fn(programId);
  } catch (err) {
    const raw = err instanceof Error ? err.message : '';
    console.error(`[report-aggregator] ${key} 집계 예외:`, raw);
    return NOT_AVAILABLE;
  }
}
