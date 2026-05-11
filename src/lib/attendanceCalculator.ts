// bal24 v2 — 출석률 계산·수료 자동 판정 (Stage 11-②)
// program_id 기준 학생별 출석률 산출 → 80% 이상이면 수료 후보.

import { supabase } from './supabase';
import type { AttendanceCheckStatus } from '../types/database';

export interface AttendanceStats {
  /** 학생 식별 키 — phone 우선, 없으면 name */
  key: string;
  name: string;
  phone: string;
  /** 분모 — 프로그램의 모든 출석 세션 수 */
  totalSessions: number;
  /** 분자 — 학생이 'O' 또는 '△' 로 출석한 세션 수 */
  presentCount: number;
  /** O 만 카운트 (지각 제외) */
  fullPresentCount: number;
  /** 출석률 (% 정수) — present (O+△) 기준 */
  attendanceRate: number;
  /** 80% 이상 = 수료 후보 */
  isCompletion: boolean;
}

/** STEP-TAB-RESTRUCTURE-B — DB programs.completion_threshold 미설정 환경 fallback */
const COMPLETION_THRESHOLD = 80;

interface AttendanceRow {
  attendee_name: string;
  attendee_phone: string | null;
  attendee_role: string;
  status: AttendanceCheckStatus;
  session: { id: string; program_id: string } | { id: string; program_id: string }[] | null;
}

function pickOne<T>(v: T | T[] | null): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v;
}

/**
 * 프로그램의 학생별 출석률 일괄 계산.
 * - attendance_sessions where program_id = X 의 총 세션 수가 분모
 * - attendance_records (attendee_role='student') 에서 학생별 출석/지각/결석 카운트
 * - 동일 학생 식별 = phone 우선
 */
export async function calculateAttendanceForProgram(programId: string): Promise<AttendanceStats[]> {
  // STEP-TAB-RESTRUCTURE-B — 프로그램별 동적 수료 임계값 fetch
  let threshold = COMPLETION_THRESHOLD;
  const progRes = await supabase.from('programs')
    .select('completion_threshold').eq('id', programId).maybeSingle();
  if (progRes.error) {
    // 컬럼 미존재 시 console.warn 후 fallback (80) 유지
    if (!(progRes.error.message ?? '').toLowerCase().includes('completion_threshold')) {
      console.warn('[attendance-calc] 임계값 조회 경고:', progRes.error.message);
    }
  } else if (progRes.data?.completion_threshold != null) {
    threshold = progRes.data.completion_threshold;
  }

  // 1) 프로그램의 총 세션 수
  const sesRes = await supabase
    .from('attendance_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('program_id', programId);
  if (sesRes.error) {
    console.error('[attendance-calc] 세션 카운트 실패:', sesRes.error.message);
    return [];
  }
  const totalSessions = sesRes.count ?? 0;
  if (totalSessions === 0) return [];

  // 2) 모든 출석 기록 (학생만) — session join으로 program_id 필터
  const recRes = await supabase
    .from('attendance_records')
    .select(
      'attendee_name, attendee_phone, attendee_role, status, session:attendance_sessions!inner(id, program_id)',
    )
    .eq('attendee_role', 'student')
    .eq('session.program_id', programId);
  if (recRes.error) {
    console.error('[attendance-calc] 출석 기록 조회 실패:', recRes.error.message);
    return [];
  }

  // 3) 학생별 그룹화 (phone 우선, 없으면 name)
  type Bucket = {
    name: string;
    phone: string;
    sessionIds: Set<string>;       // 해당 학생이 등록된 unique session id
    presentSet: Set<string>;       // O 또는 △
    fullPresentSet: Set<string>;   // O 만
  };
  const buckets = new Map<string, Bucket>();

  ((recRes.data as AttendanceRow[] | null) ?? []).forEach((r) => {
    const sess = pickOne(r.session);
    if (!sess) return;
    const phone = (r.attendee_phone ?? '').trim();
    const name = r.attendee_name.trim();
    const key = phone || `name:${name}`;
    if (!buckets.has(key)) {
      buckets.set(key, {
        name,
        phone,
        sessionIds: new Set(),
        presentSet: new Set(),
        fullPresentSet: new Set(),
      });
    }
    const b = buckets.get(key)!;
    b.sessionIds.add(sess.id);
    if (r.status === 'O' || r.status === '△') b.presentSet.add(sess.id);
    if (r.status === 'O') b.fullPresentSet.add(sess.id);
  });

  // 4) 결과 변환 + 출석률 계산
  return [...buckets.entries()].map(([key, b]) => {
    const presentCount = b.presentSet.size;
    const rate = Math.round((presentCount / totalSessions) * 100);
    return {
      key,
      name: b.name,
      phone: b.phone,
      totalSessions,
      presentCount,
      fullPresentCount: b.fullPresentSet.size,
      attendanceRate: rate,
      isCompletion: rate >= threshold,
    };
  }).sort((a, b) => b.attendanceRate - a.attendanceRate);
}

export { COMPLETION_THRESHOLD };
