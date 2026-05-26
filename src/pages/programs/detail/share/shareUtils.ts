// bal24 v2 — 외부공유 fetch / save / 단계 판별 유틸 (Stage 3-B-1)

import { supabase } from '../../../../lib/supabase';
import type {
  ProgramShare, ShareAudience, ShareItem, ShareStage, ShareVisibility,
} from '../../../../types/database';
import { ITEMS_BY_AUDIENCE } from './visibilityCatalog';

/** Q4: 모두 ON 시드 — 새 program_share INSERT 시 default visibility */
export function defaultVisibility(): ShareVisibility {
  const v: ShareVisibility = {};
  (Object.keys(ITEMS_BY_AUDIENCE) as ShareAudience[]).forEach((aud) => {
    v[aud] = {};
    ITEMS_BY_AUDIENCE[aud].forEach((item) => {
      v[aud]![item] = true;
    });
  });
  return v;
}

/** 4 날짜 기준 현재 단계 자동 판별 (Q3: 시작일 기준).
 *  STEP-OVERVIEW-CARD-FIX — programEndDate 지나면 result_date 미설정이어도 자동 result. */
export function detectStage(
  now: string,
  dates: Pick<ProgramShare, 'pre_date' | 'ready_date' | 'progress_date' | 'result_date'>,
  programEndDate?: string | null,
): ShareStage {
  if (dates.result_date && now >= dates.result_date) return 'result';
  // 교육 종료일 다음 날부터는 결과 단계로 자동 전환
  if (programEndDate && now > programEndDate) return 'result';
  if (dates.progress_date && now >= dates.progress_date) return 'progress';
  if (dates.ready_date && now >= dates.ready_date) return 'ready';
  if (dates.pre_date && now >= dates.pre_date) return 'pre';
  return 'before';
}

/** 항목 toggle 상태 조회 — visibility[audience][item] (default: true) */
export function isItemVisible(
  v: ShareVisibility,
  audience: ShareAudience,
  item: ShareItem,
): boolean {
  return v?.[audience]?.[item] !== false;
}

/** program_share 단건 fetch + 없으면 default 시드 (upsert 패턴) 후 반환 */
export async function fetchOrSeedProgramShare(programId: string): Promise<ProgramShare | null> {
  // 1) 우선 SELECT — 있으면 그대로 반환
  const sel = await supabase
    .from('program_share')
    .select('*')
    .eq('program_id', programId)
    .maybeSingle();
  if (sel.error) {
    console.error('[program-share] 조회 실패:', sel.error.message);
    return null;
  }
  if (sel.data) return sel.data as ProgramShare;

  // 2) 없으면 upsert — 동시 진입 race condition 회피 + RLS·중복 충돌 안전
  //    onConflict='program_id'로 PK 충돌 시 기존 row 유지, ignoreDuplicates=true는 INSERT만 시도
  const ups = await supabase
    .from('program_share')
    .upsert(
      { program_id: programId, visibility: defaultVisibility() },
      { onConflict: 'program_id', ignoreDuplicates: true },
    )
    .select('*');
  if (ups.error) {
    console.error('[program-share] 초기 시드 upsert 실패:', ups.error.message);
    return null;
  }

  // upsert가 ignoreDuplicates=true 일 때 충돌 row는 빈 배열 반환 → 다시 SELECT
  const upserted = (ups.data as ProgramShare[] | null) ?? [];
  if (upserted.length > 0) return upserted[0];

  const reSel = await supabase
    .from('program_share')
    .select('*')
    .eq('program_id', programId)
    .maybeSingle();
  if (reSel.error) {
    console.error('[program-share] 재조회 실패:', reSel.error.message);
    return null;
  }
  return (reSel.data as ProgramShare | null) ?? null;
}

export interface SaveDatesPayload {
  pre_date: string | null;
  ready_date: string | null;
  progress_date: string | null;
  result_date: string | null;
  // 박경수님 + SkyClaw 2026-05-28 — 각 단계 종료일
  pre_end_date: string | null;
  ready_end_date: string | null;
  progress_end_date: string | null;
  result_end_date: string | null;
}

/** STEP-AUTOFILL-PHASE-DATES — 빈 문자열도 null로 정규화 (DB date 컬럼 invalid input syntax 방지) */
function toDateOrNull(v: string | null | undefined): string | null {
  if (v == null) return null;
  const t = String(v).trim();
  return t === '' ? null : t;
}

export interface SaveDatesResult {
  ok: boolean;
  error?: string;
}

export async function saveStageDates(
  programId: string,
  dates: SaveDatesPayload,
): Promise<SaveDatesResult> {
  // STEP-PHASE-DATE-FIX — seed + update 2단계를 단일 upsert로 단순화
  // 다른 NOT NULL 컬럼(client_token 등)은 DB default가 채워 주므로 신규 row도 안전.
  const safePayload = {
    program_id:        programId,
    pre_date:          toDateOrNull(dates.pre_date),
    ready_date:        toDateOrNull(dates.ready_date),
    progress_date:     toDateOrNull(dates.progress_date),
    result_date:       toDateOrNull(dates.result_date),
    // 박경수님 + SkyClaw 2026-05-28 — 각 단계 종료일
    pre_end_date:      toDateOrNull(dates.pre_end_date),
    ready_end_date:    toDateOrNull(dates.ready_end_date),
    progress_end_date: toDateOrNull(dates.progress_end_date),
    result_end_date:   toDateOrNull(dates.result_end_date),
    updated_at:        new Date().toISOString(),
  };
  const { error } = await supabase
    .from('program_share')
    .upsert(safePayload, { onConflict: 'program_id' });
  if (error) {
    console.error('[program-share] 단계 날짜 저장 실패:', error.message, error);
    return { ok: false, error: error.message || '알 수 없는 오류' };
  }
  return { ok: true };
}

export async function toggleItemVisibility(
  programId: string,
  current: ShareVisibility,
  audience: ShareAudience,
  item: ShareItem,
  next: boolean,
): Promise<ShareVisibility | null> {
  const updated: ShareVisibility = {
    ...current,
    [audience]: { ...(current[audience] ?? {}), [item]: next },
  };
  const { error } = await supabase
    .from('program_share')
    .update({ visibility: updated, updated_at: new Date().toISOString() })
    .eq('program_id', programId);
  if (error) {
    console.error('[program-share] visibility 저장 실패:', error.message);
    return null;
  }
  return updated;
}

/** 외부 공유 URL 빌더 (Q2: /share/... prefix) */
export function buildShareUrl(audience: ShareAudience, token: string): string {
  const base = typeof window !== 'undefined' ? window.location.origin : '';
  return `${base}/share/${audience}/${token}`;
}

/** 토큰 재발급 (보안 사고 시) */
export async function regenerateToken(
  programId: string,
  audience: ShareAudience,
): Promise<boolean> {
  const col = `${audience}_token`;
  const newToken =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '')
      : Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  const { error } = await supabase
    .from('program_share')
    .update({ [col]: newToken, updated_at: new Date().toISOString() })
    .eq('program_id', programId);
  if (error) {
    console.error('[program-share] 토큰 재발급 실패:', error.message);
    return false;
  }
  return true;
}

/** 현재 단계의 사람이 읽기 좋은 라벨 + D±N */
export function describeCurrentStage(
  stage: ShareStage,
  dates: Pick<ProgramShare, 'pre_date' | 'ready_date' | 'progress_date' | 'result_date'>,
  now: string,
): string {
  const stageDate =
    stage === 'result' ? dates.result_date :
    stage === 'progress' ? dates.progress_date :
    stage === 'ready' ? dates.ready_date :
    stage === 'pre' ? dates.pre_date : null;

  if (!stageDate) return '';
  const days = Math.floor(
    (new Date(now).getTime() - new Date(stageDate).getTime()) / (1000 * 60 * 60 * 24),
  );
  if (days === 0) return '시작일 당일';
  if (days > 0) return `시작 D+${days}`;
  return `시작 D${days}`;
}
