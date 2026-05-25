// 태그 분류 탭 공용 훅 — 카테고리 fetch + 활성 태그 state + 카운트 계산
// STEP-TAGS-2B-3B

import { useEffect, useMemo, useState } from 'react';
import { fetchTagCategories } from '../lib/tagUtils';
import type { TagCategory, TagScope } from '../types/database';

interface RowWithTags {
  tags?: string[] | null;
}

export function useTagFilter<T extends RowWithTags>(scope: TagScope, rows: T[]) {
  const [categories, setCategories] = useState<TagCategory[]>([]);
  const [active, setActive] = useState<string>('전체');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const list = await fetchTagCategories(scope);
      if (!cancelled) setCategories(list);
    })();
    return () => { cancelled = true; };
  }, [scope]);

  const counts = useMemo(() => {
    const acc: Record<string, number> = { 전체: rows.length };
    for (const t of categories) acc[t.name] = rows.filter((r) => (r.tags ?? []).includes(t.name)).length;
    return acc;
  }, [rows, categories]);

  /** 활성 태그가 '전체' 가 아니면 해당 태그 포함하는 row 만 통과 */
  function matches(row: T): boolean {
    return active === '전체' || (row.tags ?? []).includes(active);
  }

  return { categories, active, setActive, counts, matches };
}
