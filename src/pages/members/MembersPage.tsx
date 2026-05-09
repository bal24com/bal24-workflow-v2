// bal24 v2 — 팀원 관리 페이지 (STEP 18)
// 3열 카드 그리드 + 역할 필터 탭 + 이름·부서·직책 검색

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Search, UserPlus } from 'lucide-react';
import { Button } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import EmptyState from '../../components/EmptyState';
import { useAuth } from '../../contexts/AuthContext';
import type { Profile, Role } from '../../types/database';
import MemberFormModal from './MemberFormModal';
import MemberDetailPanel from './MemberDetailPanel';
import MemberInviteModal from './MemberInviteModal';
import InviteListSection from './InviteListSection';

const ROLE_OPTIONS: Array<{ value: Role | 'ALL'; label: string }> = [
  { value: 'ALL', label: '전체' },
  { value: 'ADMIN', label: 'ADMIN' },
  { value: 'PM', label: 'PM' },
  { value: 'STAFF', label: 'STAFF' },
  { value: 'FINANCE', label: 'FINANCE' },
  { value: 'PARTNER', label: 'PARTNER' },
];

export const ROLE_BADGE: Record<Role, { bg: string; text: string }> = {
  ADMIN: { bg: 'bg-violet-100', text: 'text-violet-700' },
  PM: { bg: 'bg-cyan-100', text: 'text-cyan-700' },
  STAFF: { bg: 'bg-slate-100', text: 'text-slate-600' },
  FINANCE: { bg: 'bg-orange-100', text: 'text-orange-700' },
  PARTNER: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  MEMBER: { bg: 'bg-slate-100', text: 'text-slate-500' },
};

function initial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?';
}

export default function MembersPage() {
  const { user } = useAuth();

  const [members, setMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState<Role | 'ALL'>('ALL');
  const [keyword, setKeyword] = useState('');
  const [myRole, setMyRole] = useState<Role | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Profile | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  // STEP-MEMBER-INVITE — 이메일 초대 모달
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteReloadKey, setInviteReloadKey] = useState(0);

  // V2 보정: profiles.role 소문자 ('admin') / 기존 대문자 ('ADMIN') 둘 다 허용
  const isAdmin = (myRole?.toString().toLowerCase() ?? '') === 'admin';

  const reload = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true });
    if (error) {
      console.error('[members] 팀원 목록 조회 실패:', error.message);
    }
    setMembers((data as Profile[] | null) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await reload();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [reload]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        console.error('[members] 본인 권한 조회 실패:', error.message);
        return;
      }
      setMyRole((data?.role as Role | undefined) ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const filtered = useMemo(() => {
    const k = keyword.trim().toLowerCase();
    return members.filter((m) => {
      if (roleFilter !== 'ALL' && m.role !== roleFilter) return false;
      if (!k) return true;
      const hay = [m.name, m.department ?? '', m.position ?? ''].join(' ').toLowerCase();
      return hay.includes(k);
    });
  }, [members, roleFilter, keyword]);

  const openCreate = () => {
    setEditTarget(null);
    setModalOpen(true);
  };

  const openEdit = (member: Profile) => {
    setEditTarget(member);
    setDetailId(null);
    setModalOpen(true);
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold text-[#1E1B4B] flex items-center gap-2">
          <span aria-hidden="true">👤</span>
          팀원 관리
        </h1>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={openCreate}>직접 등록</Button>
            <Button variant="primary" onClick={() => setInviteOpen(true)}>
              <UserPlus size={16} className="mr-1.5" aria-hidden="true" />
              이메일 초대
            </Button>
          </div>
        )}
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex flex-wrap gap-1.5 rounded-xl border border-violet-100 bg-white p-1 shadow-sm">
          {ROLE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setRoleFilter(opt.value)}
              className={`px-3 py-1.5 text-sm font-semibold rounded-lg transition ${
                roleFilter === opt.value
                  ? 'bg-violet-600 text-white'
                  : 'text-slate-600 hover:bg-violet-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            type="search"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="이름·부서·직책 검색"
            className="w-full rounded-xl border border-violet-100 bg-white pl-9 pr-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-violet-100 bg-white p-12 flex items-center justify-center">
          <Loader2 className="animate-spin text-violet-400" size={28} aria-hidden="true" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          emoji="👤"
          title={keyword || roleFilter !== 'ALL' ? '조건에 맞는 팀원이 없어요.' : '아직 등록된 팀원이 없어요.'}
          description={isAdmin && !keyword && roleFilter === 'ALL' ? '첫 팀원을 초대해 보세요.' : undefined}
          action={
            isAdmin && !keyword && roleFilter === 'ALL' && (
              <Button variant="primary" onClick={() => setInviteOpen(true)}>
                + 이메일로 팀원 초대
              </Button>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((m) => {
            const tone = ROLE_BADGE[m.role];
            return (
              <article
                key={m.id}
                className="rounded-2xl border border-violet-100 bg-white p-5 shadow-[0_4px_16px_rgba(124,58,237,0.06)] flex flex-col gap-3"
              >
                <div className="flex items-center gap-3">
                  {m.avatar_url ? (
                    <img
                      src={m.avatar_url}
                      alt={`${m.name} 프로필 사진`}
                      className="w-16 h-16 rounded-full object-cover border border-violet-100"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-2xl font-bold">
                      {initial(m.name)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-base font-bold text-[#1E1B4B] truncate">{m.name}</div>
                    <div className="text-xs text-slate-500 truncate">{m.position ?? '직책 미등록'}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {m.department && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                      {m.department}
                    </span>
                  )}
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone.bg} ${tone.text}`}>
                    {m.role}
                  </span>
                </div>

                <p className="text-sm italic text-slate-500 line-clamp-2 min-h-[2.5rem]">
                  {m.slogan ?? '한 줄 소개가 없어요.'}
                </p>

                <Button variant="outline" onClick={() => setDetailId(m.id)} className="!w-full">
                  상세 보기
                </Button>
              </article>
            );
          })}
        </div>
      )}

      {/* STEP-MEMBER-INVITE — 초대 대기 목록 (ADMIN 전용) */}
      {isAdmin && <InviteListSection isAdmin={isAdmin} reloadKey={inviteReloadKey} />}

      <MemberFormModal
        open={modalOpen}
        editTarget={editTarget}
        onClose={() => setModalOpen(false)}
        onSaved={() => {
          void reload();
        }}
      />

      <MemberInviteModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onSent={() => setInviteReloadKey((k) => k + 1)}
      />

      {detailId && (
        <MemberDetailPanel
          memberId={detailId}
          isAdmin={isAdmin}
          onClose={() => setDetailId(null)}
          onEdit={(member) => openEdit(member)}
        />
      )}
    </div>
  );
}
