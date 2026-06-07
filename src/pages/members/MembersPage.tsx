// bal24 v2 — 팀원 관리 페이지 (STEP 18)
// 3열 카드 그리드 + 역할 필터 탭 + 이름·부서·직책 검색

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Search, UserPlus, Link2, Trash2, ShieldCheck } from 'lucide-react';
import { Button } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { copyToClipboard } from '../../lib/clipboard';
import { useToast } from '../../contexts/ToastContext';
import EmptyState from '../../components/EmptyState';
import { useAuth } from '../../contexts/AuthContext';
import type { Profile, Role } from '../../types/database';
import MemberFormModal from './MemberFormModal';
import MemberDetailPanel from './MemberDetailPanel';
import MemberInviteModal from './MemberInviteModal';
import InviteListSection from './InviteListSection';
import MemberRequestsTab from './MemberRequestsTab';
import { cleanupOrphans } from './memberCleanupUtils';
// 박경수님 + SkyClaw STEP-RBAC-SETUP (2026-05-28) — admin 전용 역할 변경 모달
import MemberRoleModal from '../../components/admin/MemberRoleModal';
import {
  ROLE_LABELS, ROLE_BADGE_TONE,
  getRoleBadgeTone, getRoleLabel, normalizeRole, hasRole,
} from '../../constants/roles';

// STEP-ROLE-TYPE-AUDIT — 모든 role 비교는 소문자 통일
const ROLE_OPTIONS: Array<{ value: Role | 'ALL'; label: string }> = [
  { value: 'ALL', label: '전체' },
  { value: 'admin',   label: ROLE_LABELS.admin },
  { value: 'pm',      label: ROLE_LABELS.pm },
  { value: 'staff',   label: ROLE_LABELS.staff },
  { value: 'finance', label: ROLE_LABELS.finance },
  { value: 'partner', label: ROLE_LABELS.partner },
];

/** Legacy export — 외부에서 import 중. constants/roles.ts 의 ROLE_BADGE_TONE 와 동일 */
export const ROLE_BADGE = ROLE_BADGE_TONE;

/** Legacy alias — 다른 파일에서 import 중일 수 있음. 동작 동일 */
export const getRoleBadge = getRoleBadgeTone;
export { normalizeRole };

function initial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?';
}

export default function MembersPage() {
  const { user } = useAuth();
  const toast = useToast();

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
  // 박경수님 + SkyClaw STEP-RBAC-SETUP (2026-05-28) — admin 전용 역할 변경 모달 대상
  const [roleEditTarget, setRoleEditTarget] = useState<Profile | null>(null);
  // STEP-MEMBER-ORPHAN-CLEANUP — 고아 계정 정리
  const [cleaning, setCleaning] = useState(false);

  async function handleCleanupOrphans() {
    // 1) dry-run으로 미리 확인
    const preview = await cleanupOrphans({ dryRun: true });
    if (!preview.success) {
      toast.error(preview.errorMsg ?? '정리 미리보기에 실패했어요.');
      return;
    }
    if (preview.foundCount === 0) {
      toast.success('정리할 고아 계정이 없어요. 시스템이 깨끗합니다.');
      return;
    }
    const emails = (preview.orphans ?? []).map((o) => o.email).slice(0, 5).join(', ');
    const more = preview.foundCount > 5 ? ` 외 ${preview.foundCount - 5}건` : '';
    const ok = window.confirm(
      `고아 계정 ${preview.foundCount}건을 발견했어요.\n\n${emails}${more}\n\n이 계정들을 영구 삭제할까요? 되돌릴 수 없어요.`,
    );
    if (!ok) return;

    // 2) 실제 삭제
    setCleaning(true);
    const result = await cleanupOrphans();
    setCleaning(false);
    if (!result.success) {
      toast.error(result.errorMsg ?? '정리 실패');
      return;
    }
    if (result.errors.length > 0) {
      console.warn('[members] 일부 삭제 실패:', result.errors);
      toast.warning(`${result.deletedCount}건 삭제 완료, ${result.errors.length}건 실패. 콘솔 확인.`);
    } else {
      toast.success(`${result.deletedCount}건의 고아 계정을 정리했어요.`);
    }
    void reload();
  }

  // STEP-ROLE-TYPE-AUDIT — hasRole 헬퍼 사용
  const isAdmin = hasRole(myRole, 'admin');
  const isPM = hasRole(myRole, 'pm');
  const canSeeRequests = isAdmin || isPM;
  // 탭 ('list' = 팀원 목록 · 'requests' = 가입신청)
  const [activeTab, setActiveTab] = useState<'list' | 'requests'>('list');

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
      // STEP-ROLE-TYPE-AUDIT — 소문자 통일 비교
      if (roleFilter !== 'ALL' && normalizeRole(m.role) !== roleFilter) return false;
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

  // STEP-STAFF-PORTAL-TEAMMATE — 팀원 포털 영구 링크 복사 (profiles.staff_portal_token)
  const handleCopyPortalLink = async (m: Profile) => {
    const token = m.staff_portal_token;
    if (!token) {
      toast.error('포털 토큰이 아직 발급되지 않았어요. 잠시 후 다시 시도해 주세요.');
      return;
    }
    const link = `${window.location.origin}/staff-portal/${token}`;
    const ok = await copyToClipboard(link);
    if (ok) toast.success(`${m.name}님 포털 링크가 복사됐어요.`);
    else toast.error('링크 복사에 실패했어요.');
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold text-[#1E1B4B] flex items-center gap-2">
          <span aria-hidden="true">👤</span>
          팀원 관리
        </h1>
        {isAdmin && activeTab === 'list' && (
          <div className="flex items-center gap-2">
            {/* STEP-MEMBER-ORPHAN-CLEANUP — ADMIN/PM만 표시 */}
            {(isAdmin || isPM) && (
              <Button variant="outline" onClick={() => void handleCleanupOrphans()} loading={cleaning}
                className="!border-rose-200 !text-rose-600 hover:!bg-rose-50">
                <Trash2 size={14} className="mr-1.5" aria-hidden="true" />
                고아 계정 정리
              </Button>
            )}
            <Button variant="outline" onClick={openCreate}>직접 등록</Button>
            <Button variant="primary" onClick={() => setInviteOpen(true)}>
              <UserPlus size={16} className="mr-1.5" aria-hidden="true" />
              이메일 초대
            </Button>
          </div>
        )}
      </header>

      {/* 탭 */}
      {canSeeRequests && (
        <nav role="tablist" className="flex items-center gap-1 border-b border-slate-200">
          {([
            { key: 'list', label: '팀원 목록' },
            { key: 'requests', label: '가입신청' },
          ] as const).map((t) => {
            const active = activeTab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(t.key)}
                className={[
                  'px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors',
                  active ? 'text-violet-700 border-violet-600' : 'text-slate-500 border-transparent hover:text-[#1E1B4B]',
                ].join(' ')}
              >
                {t.label}
              </button>
            );
          })}
        </nav>
      )}

      {activeTab === 'requests' && canSeeRequests ? <MemberRequestsTab /> : (
      <>
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
            const tone = getRoleBadgeTone(m.role);
            const roleLabel = getRoleLabel(m.role);
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
                    {roleLabel}
                  </span>
                </div>

                <p className="text-sm italic text-slate-500 line-clamp-2 min-h-[2.5rem]">
                  {m.slogan ?? '한 줄 소개가 없어요.'}
                </p>

                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={() => setDetailId(m.id)} className="!flex-1">
                    상세 보기
                  </Button>
                  {/* STEP-RBAC-SETUP — admin 전용 역할 변경 (본인 제외) */}
                  {isAdmin && m.id !== user?.id && (
                    <button type="button" onClick={(e) => { e.stopPropagation(); setRoleEditTarget(m); }}
                      aria-label={`${m.name} 역할 변경`} title="역할 변경"
                      className="inline-flex items-center justify-center w-9 h-9 rounded-md text-emerald-600 border border-emerald-200 bg-white hover:bg-emerald-50 transition-colors shrink-0">
                      <ShieldCheck size={14} aria-hidden="true" />
                    </button>
                  )}
                  <button type="button"
                    onClick={(e) => { e.stopPropagation(); void handleCopyPortalLink(m); }}
                    aria-label="팀원 포털 링크 복사" title="팀원 포털 링크 복사"
                    className="inline-flex items-center justify-center w-9 h-9 rounded-md text-violet-600 border border-violet-200 bg-white hover:bg-violet-50 transition-colors shrink-0">
                    <Link2 size={14} aria-hidden="true" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* STEP-MEMBER-INVITE — 초대 대기 목록 (ADMIN 전용) */}
      {isAdmin && <InviteListSection isAdmin={isAdmin} reloadKey={inviteReloadKey} />}
      </>
      )}

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
        <MemberDetailPanel memberId={detailId} isAdmin={isAdmin}
          onClose={() => setDetailId(null)} onEdit={(member) => openEdit(member)} />
      )}

      {/* 박경수님 + SkyClaw STEP-RBAC-SETUP (2026-05-28) — admin 전용 역할 변경 모달 */}
      <MemberRoleModal open={roleEditTarget !== null} memberId={roleEditTarget?.id ?? null}
        memberName={roleEditTarget?.name ?? ''} currentRole={roleEditTarget?.role ?? null}
        onClose={() => setRoleEditTarget(null)} onSaved={() => { void reload(); }} />
    </div>
  );
}
