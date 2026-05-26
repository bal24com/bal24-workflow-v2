// bal24 v2 — 일정·캘린더 이벤트 통합 유틸 (STEP 17)
// 박경수님 2026-05-27 STEP-HOME-CALENDAR-FIX — programs · tasks 2종만 fetch.
// project · attendance · custom 은 화면 단순화를 위해 fetch 자체를 제거 (비용 절감).

import { supabase } from '../../lib/supabase';

/**
 * Supabase 응답에서 "테이블이 스키마에 없음" 에러 여부 판정.
 * PostgREST PGRST205 ("Could not find the table 'public.X' in the schema cache")
 * — 마이그레이션 미적용 환경에서 안전하게 빈 결과로 fallback 하기 위함.
 */
export function isMissingTableError(message: string | null | undefined): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return m.includes('pgrst205') ||
    (m.includes('could not find the table') && m.includes('schema cache'));
}

export type EventSource =
  | 'project'    // STEP-UX-FIXES — 프로젝트 기간 (배경 바)
  | 'task'
  | 'program'
  | 'attendance'
  | 'custom';

export interface UnifiedEvent {
  id: string;
  title: string;
  /** "YYYY-MM-DD" — 시작일 */
  date: string;
  /** 기간 이벤트 (프로젝트·프로그램)의 종료일 */
  endDate?: string;
  /** "HH:MM" */
  startTime?: string;
  endTime?: string;
  allDay: boolean;
  source: EventSource;
  color: string;
  /** "D-3" / "초과" 등 부가 표시 */
  badge?: string;
  /** 원본 record id */
  relatedId?: string;
  relatedType?: string;
  /** custom 이벤트의 project_id (수정 모달 prefill 용) */
  projectId?: string | null;
  programId?: string | null;
  description?: string | null;
}

// 컬러 매핑 (이벤트 바는 그라데이션 통일이라 SOURCE_COLOR 사용처는 필터 칩 아이콘 정도로 축소)
export const SOURCE_COLOR: Record<EventSource, string> = {
  project: '#6366F1',     // indigo (프로젝트 기간 배경 바)
  program: '#10B981',     // emerald (프로그램·교육)
  custom: '#64748B',      // slate (개인 일정)
  task: '#F97316',        // orange (기본·태스크)
  attendance: '#F59E0B',  // amber (출석)
};

export const SOURCE_LABEL: Record<EventSource, string> = {
  project: '프로젝트',
  task: '태스크',
  program: '프로그램',
  attendance: '출석',
  custom: '직접 등록',
};

export const SOURCE_EMOJI: Record<EventSource, string> = {
  project: '📋',
  task: '✅',
  program: '🎓',
  attendance: '📍',
  custom: '📌',
};

/** YYYY-MM-DD 포맷 보장 */
function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 해당 월의 시작일/종료일 (로컬 기준 — 타임존 안전) */
export function monthRange(year: number, month: number): { startDate: string; endDate: string } {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  return { startDate: toDateString(start), endDate: toDateString(end) };
}

/** 해당 주의 시작일(일요일)/종료일(토요일) */
export function weekRange(date: Date): { start: Date; end: Date; days: Date[] } {
  const start = new Date(date);
  start.setDate(date.getDate() - date.getDay());
  start.setHours(0, 0, 0, 0);
  const days: Date[] = [];
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }
  const end = days[6];
  return { start, end, days };
}

/** D-day 배지 텍스트 (오늘 = D-day, 지나간 날짜 = 초과) */
function dDayBadge(dueIso: string): string {
  const due = new Date(`${dueIso}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.ceil((due.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return '초과';
  if (diff === 0) return 'D-day';
  return `D-${diff}`;
}

/** 해당 월의 전체 이벤트를 통합하여 반환 (programs + tasks 2종만) */
export async function fetchMonthEvents(year: number, month: number): Promise<UnifiedEvent[]> {
  const { startDate, endDate } = monthRange(year, month);

  // 박경수님 2026-05-27 STEP-HOME-CALENDAR-FIX — programs · tasks 2종만 fetch.
  const [tasks, programs] = await Promise.all([
    // 1) 태스크 마감일 (완료 제외) — 부모 프로젝트 휴지통 클라이언트 필터
    supabase
      .from('tasks')
      .select('id, project_id, title, due_date, status, projects(deleted_at)')
      .not('due_date', 'is', null)
      .gte('due_date', startDate)
      .lte('due_date', endDate)
      .neq('status', '완료'),
    // 2) 프로그램 기간 (휴지통 제외)
    supabase
      .from('programs')
      .select('id, name, start_date, end_date')
      .is('deleted_at', null)
      .not('start_date', 'is', null)
      .not('end_date', 'is', null)
      .lte('start_date', endDate)
      .gte('end_date', startDate),
  ]);

  if (tasks.error) console.error('[schedule] tasks 조회 실패:', tasks.error.message);
  if (programs.error) console.error('[schedule] programs 조회 실패:', programs.error.message);

  const events: UnifiedEvent[] = [];

  for (const t of tasks.data ?? []) {
    if (!t.due_date) continue;
    // STEP-TRASH-FILTER-AUDIT — project_id 있고 그 프로젝트가 휴지통이면 캘린더에서 제외.
    // project_id NULL (컨소시엄 전용 태스크) 은 그대로 캘린더 노출.
    const rawProj = (t as unknown as { projects?: { deleted_at: string | null } | { deleted_at: string | null }[] | null }).projects;
    const proj = Array.isArray(rawProj) ? rawProj[0] : rawProj;
    if (t.project_id && proj?.deleted_at) continue;
    events.push({
      id: `task-${t.id}`,
      title: t.title,
      date: t.due_date,
      allDay: true,
      source: 'task',
      color: SOURCE_COLOR.task,
      badge: dDayBadge(t.due_date),
      relatedId: t.project_id ?? t.id,
      relatedType: 'task',
    });
  }

  for (const p of programs.data ?? []) {
    if (!p.start_date || !p.end_date) continue;
    events.push({
      id: `program-${p.id}`,
      title: p.name,
      date: p.start_date,
      endDate: p.end_date,
      allDay: true,
      source: 'program',
      color: SOURCE_COLOR.program,
      relatedId: p.id,
      relatedType: 'program',
    });
  }

  return events.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    const at = a.startTime ?? '00:00';
    const bt = b.startTime ?? '00:00';
    return at.localeCompare(bt);
  });
}

/** 기간 이벤트가 특정 날짜에 걸쳐있는지 */
export function eventCoversDate(event: UnifiedEvent, date: string): boolean {
  if (!event.endDate) return event.date === date;
  return event.date <= date && date <= event.endDate;
}

/** 해당 날짜의 이벤트만 필터 */
export function eventsOnDate(events: UnifiedEvent[], date: string): UnifiedEvent[] {
  return events.filter((e) => eventCoversDate(e, date));
}
