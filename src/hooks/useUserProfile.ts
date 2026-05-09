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

  // STEP-ROLE-TYPE-AUDIT — hasRole 헬퍼 사용 (소문자 통일 + 대소문자 안전망)
  const role: Role | null = profile?.role ?? null;
  const isAdmin = hasRole(role, 'admin');
  const isPM = hasRole(role, 'pm') || isAdmin;
  const isFinance = hasRole(role, 'finance') || isAdmin;
  const isMember = !!profile?.consortium_member_id;

  return { profile, loading, role, isAdmin, isPM, isFinance, isMember };
}
