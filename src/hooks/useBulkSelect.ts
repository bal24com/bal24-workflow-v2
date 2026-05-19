// bal24 v2 — STEP-PARTICIPANT-BULK-DELETE
// 다중 선택 일괄 처리 공통 훅. selectedIds (Set) + allSelected + toggleAll/toggleOne/clearSelection 제공.

import { useCallback, useState } from 'react';

interface HasId { id: string }

export function useBulkSelect<T extends HasId>(items: T[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const allSelected = items.length > 0 && items.every((x) => selectedIds.has(x.id));

  const toggleAll = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const everySelected = items.length > 0 && items.every((x) => next.has(x.id));
      if (everySelected) items.forEach((x) => next.delete(x.id));
      else items.forEach((x) => next.add(x.id));
      return next;
    });
  }, [items]);

  const toggleOne = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  return { selectedIds, allSelected, toggleAll, toggleOne, clearSelection };
}
