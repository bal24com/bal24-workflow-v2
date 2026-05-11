// bal24 v2 — STEP-V1-SPLIT-FULL
// staff_pool + profiles 통합 옵션 fetch 훅 (CurriculumTab 분리 — 기능 변경 없음)

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import type { StaffOption } from './curriculum/CurriculumRowStaffSection';

export function useCurriculumStaff(): { staffOptions: StaffOption[]; loading: boolean } {
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [poolRes, profileRes] = await Promise.all([
        supabase.from('staff_pool').select('id, name, organization').is('deleted_at', null).order('name'),
        supabase.from('profiles').select('id, name, department').eq('is_active', true).order('name'),
      ]);
      if (cancelled) return;
      if (poolRes.error)    console.error('[curriculum-tab] staff_pool 조회 실패:', poolRes.error.message);
      if (profileRes.error) console.error('[curriculum-tab] profiles 조회 실패:', profileRes.error.message);
      setStaffOptions([
        ...(poolRes.data    ?? []).map((s): StaffOption => ({ id: s.id, name: s.name, organization: s.organization ?? null, sourceType: 'staff_pool' })),
        ...(profileRes.data ?? []).map((p): StaffOption => ({ id: p.id, name: p.name, organization: p.department ?? '내부직원', sourceType: 'profile' })),
      ]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  return { staffOptions, loading };
}
