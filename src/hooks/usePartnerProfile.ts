// bal24 v2 — STEP-PARTNER-SIDEBAR PARTNER 프로필 + 담당 프로그램 fetch 훅
// V2 실측: profiles.consortium_member_id → program_assignments.consortium_member_id 흐름.
// role 값은 STEP-PM-VIEWER 기준 소문자 'partner' 가정 (admin 도 소문자였음).

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type {
  PartnerProgram, PartnerProfileSummary, PartnerAssignmentRole,
} from '../types/partner';

function pickOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

interface ProgramJoin {
  id: string;
  name: string;
  program_type: string | null;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
  venue: string | null;
}

interface AssignmentRow {
  role: PartnerAssignmentRole | null;
  program: ProgramJoin | ProgramJoin[] | null;
}

interface PartnerHookResult {
  profile: PartnerProfileSummary | null;
  programs: PartnerProgram[];
  programIds: Set<string>;
  isPartner: boolean;
  isLoading: boolean;
}

export function usePartnerProfile(): PartnerHookResult {
  const { user } = useAuth();
  const [profile, setProfile] = useState<PartnerProfileSummary | null>(null);
  const [programs, setPrograms] = useState<PartnerProgram[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(user));

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setPrograms([]);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    void (async () => {
      // 1) 프로필 조회
      const { data: profData, error: profError } = await supabase
        .from('profiles')
        .select('id, name, role, consortium_member_id, my_token')
        .eq('id', user.id)
        .maybeSingle();
      if (profError) {
        console.error('[partner] 프로필 조회 실패:', profError.message);
      }
      if (cancelled) return;
      const p = (profData as PartnerProfileSummary | null) ?? null;
      setProfile(p);

      // 2) PARTNER 가 아니거나 consortium_member_id 없으면 빈 결과
      const role = p?.role ?? '';
      const isPartner = role === 'partner';
      if (!isPartner || !p?.consortium_member_id) {
        if (!cancelled) {
          setPrograms([]);
          setIsLoading(false);
        }
        return;
      }

      // 3) program_assignments 조회 (consortium_member_id 매칭)
      const { data: assignData, error: assignError } = await supabase
        .from('program_assignments')
        .select(`
          role,
          program:programs!program_id(
            id, name, program_type, status, start_date, end_date, venue
          )
        `)
        .eq('consortium_member_id', p.consortium_member_id);
      if (assignError) {
        console.error('[partner] 담당 프로그램 조회 실패:', assignError.message);
      }
      if (cancelled) return;

      const list: PartnerProgram[] = [];
      ((assignData ?? []) as AssignmentRow[]).forEach((row) => {
        const pg = pickOne<ProgramJoin>(row.program);
        if (!pg?.id) return;
        list.push({
          id: pg.id,
          name: pg.name,
          program_type: pg.program_type,
          status: pg.status,
          start_date: pg.start_date,
          end_date: pg.end_date,
          venue: pg.venue,
          assignment_role: row.role,
        });
      });
      // start_date 내림차순
      list.sort((a, b) => {
        if (!a.start_date && !b.start_date) return 0;
        if (!a.start_date) return 1;
        if (!b.start_date) return -1;
        return b.start_date.localeCompare(a.start_date);
      });
      setPrograms(list);
      setIsLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user]);

  const programIds = useMemo(() => new Set(programs.map((p) => p.id)), [programs]);
  const isPartner = (profile?.role ?? '') === 'partner';

  return { profile, programs, programIds, isPartner, isLoading };
}
