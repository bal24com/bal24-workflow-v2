// bal24 v2 — MEMBER 본인이 배정된 program_id 목록 훅 (STEP-PROGRAM-ASSIGNMENT)
// ProgramsPage 분리 (V-1 안전) — MEMBER 필터링 시 .in('id', programIds).

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

export function useMemberProgramIds(consortiumMemberId: string | null | undefined) {
  const [programIds, setProgramIds] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(Boolean(consortiumMemberId));

  useEffect(() => {
    if (!consortiumMemberId) {
      setProgramIds([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const { data, error } = await supabase
        .from('program_assignments')
        .select('program_id')
        .eq('consortium_member_id', consortiumMemberId);
      if (cancelled) return;
      if (error) {
        console.error('[member-programs] 배정 목록 조회 실패:', error.message);
        setProgramIds([]);
      } else {
        const rows = (data as { program_id: string }[] | null) ?? [];
        setProgramIds(rows.map((r) => r.program_id));
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [consortiumMemberId]);

  return { programIds, loading };
}
