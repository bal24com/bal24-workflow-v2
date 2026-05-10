// bal24 v2 — STEP-APPLICATION-CAPACITY 정원 체크 훅
// Supabase RPC check_application_capacity 호출.

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export type CapacityReason =
  | 'available'
  | 'unlimited'
  | 'capacity_full'
  | 'deadline_passed'
  | 'not_started'
  | 'program_not_found';

export interface CapacityResult {
  ok: boolean;
  reason: CapacityReason | null;
  max?: number;
  current?: number;
  remaining?: number;
}

/**
 * 신청 가능 여부 1회 조회 + recheck 함수 노출.
 * RPC 호출 실패(테이블/함수 미생성 등) 시 ok=true, reason=null 로 fallback (앱 깨짐 방지).
 */
export function useApplicationCapacity(programId: string | null) {
  const [capacity, setCapacity] = useState<CapacityResult | null>(null);
  const [loading, setLoading] = useState(false);

  const recheck = useCallback(async (): Promise<CapacityResult | null> => {
    if (!programId) return null;
    const { data, error } = await supabase.rpc(
      'check_application_capacity',
      { p_program_id: programId },
    );
    if (error) {
      console.error('[capacity] RPC 호출 실패:', error.message);
      // 함수 미생성 환경 → 차단하지 않고 null 반환 (호출자가 fallback)
      return null;
    }
    return (data as CapacityResult) ?? null;
  }, [programId]);

  useEffect(() => {
    if (!programId) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const result = await recheck();
      if (cancelled) return;
      // RPC 실패 시 ok=true, reason=null 로 fallback (UI 가 차단 메시지 안 띄움)
      setCapacity(result ?? { ok: true, reason: null });
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [programId, recheck]);

  return { capacity, loading, recheck };
}

export function getCapacityMessage(result: CapacityResult | null): string | null {
  if (!result) return null;
  switch (result.reason) {
    case 'capacity_full':
      return `신청이 마감되었어요. (정원 ${result.max ?? 0}명 마감)`;
    case 'deadline_passed':
      return '신청 기간이 종료되었어요.';
    case 'not_started':
      return '신청 기간이 아직 시작되지 않았어요.';
    case 'program_not_found':
      return '프로그램 정보를 찾을 수 없어요.';
    default:
      return null;
  }
}
