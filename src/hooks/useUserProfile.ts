// bal24 v2 — 로그인 사용자 profiles 정보 + 권한 헬퍼 (STEP-PROGRAM-ASSIGNMENT)
// AuthContext 의 session.user 만으로는 role / consortium_member_id 알 수 없어 추가 fetch.

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { hasRole } from '../constants/roles';
import type { Profile, Role } from '../types/database';

export type UserProfileSummary = Pick<
  Profile,
  'id' | 'name' | 'email' | 'role' | 'consortium_member_id'
>;

export function useUserProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfileSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(user));

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email, role, consortium_member_id')
        .eq('id', user.id)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        console.error('[user-profile] 프로필 조회 실패:', error.message);
        setProfile(null);
      } else {
        setProfile((data as UserProfileSummary | null) ?? null);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user]);

  // STEP-ROLE-NORMALIZE-PM — hasRole 헬퍼로 소문자 통일 + 권한 위계 반영
  // ⚠️ 모든 역할 비교는 hasRole 사용 — 직접 `role === 'PM'` 비교 금지
  // - admin 은 모든 권한 상속 (isPM/isStaff/isFinance 모두 true)
  // - pm 은 staff 권한도 보유 (isStaff true)
  const role: Role | null = profile?.role ?? null;
  const isAdmin   = hasRole(role, 'admin');
  const isPM      = hasRole(role, 'pm') || isAdmin;
  const isStaff   = hasRole(role, 'staff') || isPM;
  const isFinance = hasRole(role, 'finance') || isAdmin;
  const isPartner = hasRole(role, 'partner');
  const isMember  = hasRole(role, 'member');

  // STEP-ROLE-NORMALIZE — 컨소시엄 참여기관 매핑 여부 (역할과 별개)
  // ProgramsPage 등 일부 페이지에서 "내가 속한 컨소시엄 프로그램" 필터링에 사용
  const hasConsortiumMembership = !!profile?.consortium_member_id;

  return {
    profile, loading, role,
    isAdmin, isPM, isStaff, isFinance, isPartner, isMember,
    hasConsortiumMembership,
  };
}
