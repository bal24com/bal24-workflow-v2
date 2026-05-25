// 견적 항목·세항목 동적 로드 훅 — 박경수님 + SkyClaw 2026-05-26
// 지급요청 폼의 [항목] 드롭다운 + [세항목] datalist 에 견적(estimate_items) 데이터 자동 노출.
// program_id 매칭 + project_id 매칭 OR (둘 중 하나라도 매칭되면 잡힘 — 견적 program_id null 환경 대응).

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface UseEstimateCategoriesResult {
  categories: string[];
  /** 항목별 세항목(description) 옵션 맵 */
  descriptionsByCategory: Record<string, string[]>;
  loading: boolean;
  reload: () => Promise<void>;
}

interface EstimateItemRow {
  category: string | null;
  description: string | null;
}

export function useEstimateCategories(
  programId: string | null,
  projectId: string | null,
): UseEstimateCategoriesResult {
  const [categories, setCategories] = useState<string[]>([]);
  const [descriptionsByCategory, setDescriptionsByCategory] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!programId && !projectId) {
      setCategories([]); setDescriptionsByCategory({}); return;
    }
    setLoading(true);
    try {
      // 1) program_id 매칭 + project_id 매칭 OR — 박경수님 환경 견적 program_id=NULL 도 잡힘
      const queries = [];
      if (programId) queries.push(supabase.from('project_estimates').select('id').eq('program_id', programId).is('deleted_at', null));
      if (projectId) queries.push(supabase.from('project_estimates').select('id').eq('project_id', projectId).is('deleted_at', null));
      const results = await Promise.all(queries);
      const errs = results.filter((r) => r.error);
      if (errs.length > 0) console.error('[useEstimateCategories] 견적 조회 실패:', errs.map((e) => e.error?.message));
      const estimateIds = Array.from(new Set(
        results.flatMap((r) => ((r.data ?? []) as { id: string }[]).map((e) => e.id)),
      ));
      if (estimateIds.length === 0) { setCategories([]); setDescriptionsByCategory({}); return; }

      // 2) estimate_items 의 category + description 함께 fetch
      const { data: items, error: itemErr } = await supabase
        .from('estimate_items')
        .select('category, description')
        .in('estimate_id', estimateIds);
      if (itemErr) {
        console.error('[useEstimateCategories] 항목 조회 실패:', itemErr.message);
        setCategories([]); setDescriptionsByCategory({}); return;
      }

      // 3) 카테고리·세항목 정리
      const rows = (items ?? []) as EstimateItemRow[];
      const catSet = new Set<string>();
      const descMap: Record<string, Set<string>> = {};
      for (const r of rows) {
        const c = (r.category ?? '').trim();
        if (!c) continue;
        catSet.add(c);
        const d = (r.description ?? '').trim();
        if (!d) continue;
        if (!descMap[c]) descMap[c] = new Set();
        descMap[c].add(d);
      }
      setCategories(Array.from(catSet).sort());
      const finalDescMap: Record<string, string[]> = {};
      for (const [k, v] of Object.entries(descMap)) finalDescMap[k] = Array.from(v).sort();
      setDescriptionsByCategory(finalDescMap);
    } finally {
      setLoading(false);
    }
  }, [programId, projectId]);

  useEffect(() => { void reload(); }, [reload]);

  return { categories, descriptionsByCategory, loading, reload };
}
