// bal24 v2 — 한국 공휴일 데이터 + 헬퍼
// 양력 기준 공휴일 + 매년 변동되는 음력 공휴일 (2026년만 1차 등록)
// 추후 매년 박경수님이 직접 추가/업데이트.
// holidays 테이블 (사용자 정의 휴일) 도 함께 통합.

import { supabase } from '../lib/supabase';
import { isMissingTableError } from '../pages/schedule/scheduleUtils';

interface Holiday {
  date: string; // "YYYY-MM-DD"
  name: string;
}

export interface DbHoliday {
  id: string;
  date: string;
  name: string;
  is_national: boolean;
  created_at: string;
}

const HOLIDAYS: Holiday[] = [
  // 양력 — 매년 동일
  { date: '2026-01-01', name: '신정' },
  { date: '2026-03-01', name: '삼일절' },
  { date: '2026-05-01', name: '노동절' },
  { date: '2026-05-05', name: '어린이날' },
  { date: '2026-06-06', name: '현충일' },
  { date: '2026-08-15', name: '광복절' },
  { date: '2026-10-03', name: '개천절' },
  { date: '2026-10-09', name: '한글날' },
  { date: '2026-12-25', name: '성탄절' },

  // 2026년 음력 공휴일 (변동)
  { date: '2026-02-16', name: '설날 연휴' },
  { date: '2026-02-17', name: '설날' },
  { date: '2026-02-18', name: '설날 연휴' },
  { date: '2026-05-24', name: '부처님오신날' },
  { date: '2026-05-25', name: '대체공휴일' },
  { date: '2026-09-24', name: '추석 연휴' },
  { date: '2026-09-25', name: '추석' },
  { date: '2026-09-26', name: '추석 연휴' },

  // 2027년 양력
  { date: '2027-01-01', name: '신정' },
  { date: '2027-03-01', name: '삼일절' },
  { date: '2027-05-01', name: '노동절' },
  { date: '2027-05-05', name: '어린이날' },
  { date: '2027-06-06', name: '현충일' },
  { date: '2027-08-15', name: '광복절' },
  { date: '2027-10-03', name: '개천절' },
  { date: '2027-10-09', name: '한글날' },
  { date: '2027-12-25', name: '성탄절' },
];

const HOLIDAY_MAP = new Map(HOLIDAYS.map((h) => [h.date, h.name]));

/** 해당 일자가 공휴일이면 이름, 아니면 null */
export function getHoliday(isoDate: string): string | null {
  return HOLIDAY_MAP.get(isoDate) ?? null;
}

/** 해당 일자가 공휴일·일요일·토요일 중 하나면 true */
export function isRedDay(isoDate: string): boolean {
  if (HOLIDAY_MAP.has(isoDate)) return true;
  const d = new Date(`${isoDate}T00:00:00`);
  return d.getDay() === 0;
}

/** DB holidays 테이블 조회 (마이그레이션 미적용 환경 안전 fallback) */
export async function fetchDbHolidays(): Promise<DbHoliday[]> {
  const { data, error } = await supabase
    .from('holidays')
    .select('id, date, name, is_national, created_at')
    .order('date', { ascending: true });
  if (error) {
    if (!isMissingTableError(error.message)) {
      console.error('[holidays] DB 휴일 조회 실패:', error.message);
    }
    return [];
  }
  return (data ?? []) as DbHoliday[];
}

/** 정적 공휴일 + DB 휴일을 합친 Map 반환 (DB 우선) */
export function buildHolidayMap(dbHolidays: DbHoliday[]): Map<string, string> {
  const map = new Map<string, string>(HOLIDAY_MAP);
  for (const h of dbHolidays) map.set(h.date, h.name);
  return map;
}
