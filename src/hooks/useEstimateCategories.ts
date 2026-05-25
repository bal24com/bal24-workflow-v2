// 견적 항목(estimate_items.category) 동적 로드 훅 — 박경수님 + SkyClaw 2026-05-26
// 지급요청 폼의 [항목] 드롭다운에 프로그램별 견적 카테고리 자동 노출.
// estimate_items 에는 deleted_at 컬럼이 없어 project_estimates.deleted_at 으로 활성 견적만 필터.

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface UseEstimateCategoriesResult {
  categories: string[];
  loading: boolean;
  reload: () => Promise<void>;
}

export function useEstimateCategories(
  programId: string | null,
  projectId: string | null,
): UseEstimateCategoriesResult {
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!programId && !projectId) { setCategories([]); return; }
    setLoading(true);
    try {
      // 1) 활성(휴지통 제외) project_estimates id 조회
      const estQ = supabase
        .from('project_estimates')
        .select('id')
        .is('deleted_at', null);
      const { data: ests, error: estErr } = programId
        ? await estQ.eq('program_id', programId)
        : await estQ.eq('project_id', projectId);
      if (estErr) {
        console.error('[useEstimateCategories] 견적 조회 실패:', estErr.message);
        setCategories([]); return;
      }
      const estimateIds = (ests ?? []).map((e) => e.id as string);
      if (estimateIds.length === 0) { setCategories([]); return; }

      // 2) estimate_items.category 중복 제거하여 가져오기
      const { data: items, error: itemErr } = await supabase
        .from('estimate_items')
        .select('category')
        .in('estimate_id', estimateIds);
      if (itemErr) {
        console.error('[useEstimateCategories] 항목 조회 실패:', itemErr.message);
        setCategories([]); return;
      }
      const unique = Array.from(new Set(
        ((items ?? []) as { category: string | null }[])
          .map((r) => (r.category ?? '').trim())
          .filter((c) => c.length > 0),
      ));
      setCategories(unique.sort());
    } finally {
      setLoading(false);
    }
  }, [programId, projectId]);

  useEffect(() => { void reload(); }, [reload]);

  return { categories, loading, reload };
}
