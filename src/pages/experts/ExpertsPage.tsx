// bal24 v2 — 전문가 목록 페이지
// 카드(기본) / 리스트 + 분야 필터 + 검색 + 신규 등록

import { useCallback, useEffect, useMemo, useState } from 'react';
import { LayoutGrid, List, Plus, Loader2, Search, UserStar, Phone, Mail, Pencil, Trash2, Eye, Link2, Activity } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../components/ui';
import { supabase } from '../../lib/supabase';
import EmptyState from '../../components/EmptyState';
import { useToast } from '../../contexts/ToastContext';
import { softDelete } from '../../lib/softDeleteUtils';
import { copyToClipboard } from '../../lib/clipboard';
import type { StaffPool, StaffType } from '../../types/database';
import ExpertFormModal from './ExpertFormModal';
import ExpertActivityDrawer from './ExpertActivityDrawer';
import ExpertListRow from './ExpertListRow';
import ExpertRecentPrograms from './ExpertRecentPrograms';
import { fetchRecentProgramsForExperts, type ExpertProgramRef } from './expertProgramsFetch';

type ViewMode = 'card' | 'list';
// 박경수님 2026-05-26 STEP-EXPERTS-UI-REFINE — staff_type 기반 역할 필터로 단순화.
type RoleFilter = 'all' | StaffType;
const ROLE_FILTERS: Array<{ key: RoleFilter; label: string }> = [
  { key: 'all',   label: '전체' },
  { key: '강사',  label: '강사' },
  { key: '멘토',  label: '멘토' },
  { key: 'FT',    label: 'FT' },
  { key: 'TA',    label: 'TA' },
  { key: '운영진', label: '운영진' },
  { key: '기타',  label: '기타' },
];

function expertMatchesRole(s: StaffPool, filter: RoleFilter): boolean {
  if (filter === 'all') return true;
  return s.staff_type === filter;
}

function ExpertGridCard({ s, onEdit, onDelete, onCopyPortal, onShowActivity, onResetPin, recentPrograms }: { s: StaffPool; onEdit: () => void; onDelete: () => void; onCopyPortal: () => void; onShowActivity: () => void; onResetPin: () => void; recentPrograms?: ExpertProgramRef[] }) {
  return (
    // STEP-CLIENT-EXPERT-CARD — 고객사 카드와 동일한 min-h
    <Card className="group hover:border-primary/30 hover:shadow-md transition min-h-[260px] flex flex-col">
      <CardHeader>
        <div className="flex items-start gap-3">
          {s.profile_image_url ? (
            <img
              src={s.profile_image_url}
              alt={`${s.name} 프로필`}
              className="w-10 h-10 rounded-full object-cover shrink-0 border border-slate-200"
            />
          ) : (
            <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary shrink-0">
              <UserStar size={18} />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <CardTitle className="truncate flex items-center gap-1.5">
              {s.name}
              {s.staff_type && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-violet-100 text-violet-700 border border-violet-200">
                  {s.staff_type}
                </span>
              )}
            </CardTitle>
            <CardDescription>
              {[s.organization, s.position].filter(Boolean).join(' · ') || '소속·직책 미지정'}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-1.5 text-xs text-muted flex-1">
        {s.specialty?.length ? (
          <div className="flex flex-wrap gap-1">
            {s.specialty.map((t) => (
              <span key={t} className="bg-violet-50 text-violet-600 border border-violet-200 px-2 py-0.5 rounded-full text-[11px] font-semibold">
                {t}
              </span>
            ))}
          </div>
        ) : null}
        {s.phone_mobile && (
          <div className="flex items-center gap-1.5">
            <Phone size={12} className="text-slate-400" />
            <span className="truncate">{s.phone_mobile}</span>
          </div>
        )}
        {s.email && (
          <div className="flex items-center gap-1.5">
            <Mail size={12} className="text-slate-400" />
            <span className="truncate">{s.email}</span>
          </div>
        )}
        {s.main_duties && (
          <p className="text-xs text-muted line-clamp-2 pt-1">{s.main_duties}</p>
        )}
        {/* 박경수님 2026-05-26 STEP-EXPERTS-UI-REFINE — 최근 참여 프로그램 (최대 3개) */}
        <ExpertRecentPrograms programs={recentPrograms} variant="card" />
      </CardContent>
      {/* STEP-CLIENT-EXPERT-CARD — 고객사 카드와 동일 3 버튼 + STEP-STAFF-PORTAL-P2 포털 링크 복사 */}
      <div className="flex items-center gap-2 px-5 pb-4">
        <Button variant="outline" size="sm" leftIcon={<Eye size={14} />} onClick={onEdit} className="!flex-1">내용보기</Button>
        <Button variant="primary" size="sm" leftIcon={<Pencil size={14} />} onClick={onEdit} className="!flex-1">수정</Button>
        <button type="button" onClick={(e) => { e.stopPropagation(); onShowActivity(); }}
          aria-label="활동 이력" title="활동 이력"
          className="inline-flex items-center justify-center w-8 h-8 rounded-md text-cyan-600 border border-cyan-200 bg-white hover:bg-cyan-50 transition-colors">
          <Activity size={13} aria-hidden="true" />
        </button>
        <button type="button" onClick={(e) => { e.stopPropagation(); onResetPin(); }}
          aria-label="PIN 초기화" title="PIN 을 전화번호 끝 6자리로 초기화"
          className="inline-flex items-center justify-center w-8 h-8 rounded-md text-amber-700 border border-amber-200 bg-white hover:bg-amber-50 transition-colors">
          🔑
        </button>
        <button type="button" onClick={(e) => { e.stopPropagation(); onCopyPortal(); }}
          aria-label="강사 포털 링크 복사" title="강사 포털 링크 복사"
          className="inline-flex items-center justify-center w-8 h-8 rounded-md text-violet-600 border border-violet-200 bg-white hover:bg-violet-50 transition-colors">
          <Link2 size={13} aria-hidden="true" />
        </button>
        <button type="button" onClick={(e) => { e.stopPropagation(); onDelete(); }}
          aria-label="삭제"
          className="inline-flex items-center justify-center w-8 h-8 rounded-md text-rose-500 border border-rose-200 bg-white hover:bg-rose-50 transition-colors">
          <Trash2 size={13} aria-hidden="true" />
        </button>
      </div>
    </Card>
  );
}

// ExpertListRow 는 ./ExpertListRow 로 분리 (V-1, 박경수님 2026-05-26).

export default function ExpertsPage() {
  const toast = useToast();
  const [experts, setExperts] = useState<StaffPool[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>('card');
  // 박경수님 2026-05-26 STEP-EXPERTS-UI-REFINE — 분야 필터(FIELD_FILTERS)·TagFilterTabs 제거, 역할 필터 1행만.
  const [role, setRole] = useState<RoleFilter>('all');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  // STEP-EXPERT-CRUD-FULL — 수정 대상 (null = 신규 등록)
  const [editTarget, setEditTarget] = useState<StaffPool | null>(null);
  // STEP-STAFF-PORTAL-P4 — 활동 이력 드로어 대상
  const [activityTarget, setActivityTarget] = useState<StaffPool | null>(null);
  // 박경수님 2026-05-26 STEP-EXPERTS-UI-REFINE — 카드별 최근 참여 프로그램 (staff_id → ExpertProgramRef[])
  const [programsByStaff, setProgramsByStaff] = useState<Map<string, ExpertProgramRef[]>>(new Map());

  const fetchExperts = useCallback(async () => {
    setLoading(true);
    try {
      // STEP-EXPERT-CRUD-FULL — 휴지통(deleted_at IS NOT NULL) 제외
      const { data, error } = await supabase
        .from('staff_pool')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const list = (data ?? []) as StaffPool[];
      setExperts(list);
      // 박경수님 2026-05-26 — 참여 프로그램 배치 fetch (N+1 방지)
      const ids = list.map((e) => e.id);
      if (ids.length > 0) {
        const map = await fetchRecentProgramsForExperts(ids);
        setProgramsByStaff(map);
      } else {
        setProgramsByStaff(new Map());
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[experts] 목록 조회 실패:', raw);
      const m = raw.toLowerCase();
      if (m.includes('column') && m.includes('does not exist')) {
        toast.error('전문가 테이블 컬럼이 아직 적용되지 않았어요. Supabase에서 마이그레이션을 실행해 주세요.');
      } else {
        toast.error('전문가 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
      }
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void fetchExperts();
  }, [fetchExperts]);

  // STEP-STAFF-PORTAL-P2 — 강사 포털 영구 링크 복사
  const handleCopyPortalLink = async (s: StaffPool) => {
    const token = s.staff_portal_token;
    if (!token) {
      toast.error('포털 토큰이 아직 발급되지 않았어요. Supabase 마이그레이션 후 잠시 기다려 주세요.');
      return;
    }
    const link = `${window.location.origin}/staff-portal/${token}`;
    const ok = await copyToClipboard(link);
    if (ok) toast.success(`${s.name}님 포털 링크가 복사됐어요.`);
    else toast.error('링크 복사에 실패했어요.');
  };

  // 박경수님 2026-05-26 STEP-STAFF-PORTAL-PIN-GATEWAY — PIN 초기화 (전화번호 끝 6자리)
  const handleResetPin = async (s: StaffPool) => {
    const { resetStaffPinFromPhone } = await import('./expertPinUtils');
    const digits = ((s.phone ?? s.phone_mobile ?? '') as string).replace(/[^0-9]/g, '');
    const previewPin = digits.length >= 6 ? digits.slice(-6) : '000000';
    const note = digits.length >= 6 ? '' : ' (전화번호 없음 → 임시 000000)';
    if (!window.confirm(`${s.name}님 PIN 을 "${previewPin}"${note} 으로 초기화할까요?`)) return;
    const r = await resetStaffPinFromPhone(s.id, s.phone ?? null, s.phone_mobile ?? null);
    if (!r.ok) {
      toast.error(r.error ?? 'PIN 초기화에 실패했어요.');
      return;
    }
    toast.success(`${s.name}님 PIN 이 "${r.pin}" 으로 초기화됐어요.`);
    void fetchExperts();
  };

  // STEP-EXPERT-CRUD-FULL — soft-delete (휴지통 30일 보관)
  const handleDelete = async (s: StaffPool) => {
    if (!window.confirm(`"${s.name}" 전문가를 삭제할까요? 30일 후 자동으로 완전 삭제됩니다. (관리자 휴지통에서 복원 가능)`)) return;
    const err = await softDelete('staff_pool', s.id);
    if (err) { toast.error(err); return; }
    toast.success('전문가를 휴지통으로 이동했어요.');
    void fetchExperts();
  };

  // 박경수님 2026-05-26 STEP-EXPERTS-UI-REFINE — staff_type 기반 카운트.
  const counts = useMemo<Record<RoleFilter, number>>(() => {
    const acc: Record<RoleFilter, number> = {
      all: experts.length, '강사': 0, '멘토': 0, 'FT': 0, 'TA': 0, '운영진': 0, '기타': 0,
    };
    for (const s of experts) {
      if (s.staff_type) acc[s.staff_type] = (acc[s.staff_type] ?? 0) + 1;
    }
    return acc;
  }, [experts]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return experts.filter((s) => {
      if (!expertMatchesRole(s, role)) return false;
      if (!q) return true;
      const haystack = [s.name, s.organization, ...(s.specialty ?? [])].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [experts, role, search]);

  return (
    <div className="space-y-5 max-w-[1400px]">
      <h1 className="text-2xl font-bold text-[#1E1B4B] flex items-center gap-2">
        <span aria-hidden="true">👥</span>
        전문가
      </h1>

      {/* 박경수님 2026-05-26 STEP-EXPERTS-UI-REFINE — TagFilterTabs·FIELD_FILTERS 제거. 역할(staff_type) 1행만. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="역할 필터">
          {ROLE_FILTERS.map((f) => {
            const active = role === f.key;
            return (
              <button
                key={f.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setRole(f.key)}
                className={[
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                  active ? 'bg-primary text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50',
                ].join(' ')}
              >
                {f.label}
                <span className={['inline-flex items-center justify-center min-w-[1.25rem] px-1 rounded text-[10px]',
                  active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'].join(' ')}>
                  {counts[f.key] ?? 0}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
            <button type="button" onClick={() => setView('card')} aria-pressed={view === 'card'} aria-label="카드 보기"
              className={['inline-flex items-center justify-center w-8 h-8 rounded-md transition-colors',
                view === 'card' ? 'bg-primary text-white' : 'text-slate-500 hover:bg-slate-50'].join(' ')}>
              <LayoutGrid size={16} />
            </button>
            <button type="button" onClick={() => setView('list')} aria-pressed={view === 'list'} aria-label="리스트 보기"
              className={['inline-flex items-center justify-center w-8 h-8 rounded-md transition-colors',
                view === 'list' ? 'bg-primary text-white' : 'text-slate-500 hover:bg-slate-50'].join(' ')}>
              <List size={16} />
            </button>
          </div>
          <Button variant="primary" leftIcon={<Plus size={16} />} onClick={() => { setEditTarget(null); setModalOpen(true); }}>신규 등록</Button>
        </div>
      </div>

      <div className="relative w-full sm:max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="이름·분야·소속으로 검색"
          className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-sm text-muted">
          <Loader2 size={18} className="animate-spin mr-2" />
          불러오는 중…
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          emoji="👥"
          title={search.trim() || role !== 'all' ? '조건에 맞는 전문가가 없어요.' : '아직 등록된 전문가가 없어요.'}
          description={!search.trim() && role === 'all' ? '첫 전문가를 등록해 보세요.' : undefined}
          action={
            !search.trim() && role === 'all' && (
              <Button variant="primary" leftIcon={<Plus size={14} />} onClick={() => { setEditTarget(null); setModalOpen(true); }}>
                + 전문가 등록
              </Button>
            )
          }
        />
      ) : view === 'card' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map((s) => (
            <ExpertGridCard key={s.id} s={s}
              onEdit={() => { setEditTarget(s); setModalOpen(true); }}
              onDelete={() => void handleDelete(s)}
              onCopyPortal={() => void handleCopyPortalLink(s)}
              onShowActivity={() => setActivityTarget(s)}
              onResetPin={() => void handleResetPin(s)}
              recentPrograms={programsByStaff.get(s.id)} />
          ))}
        </div>
      ) : (
        <ul className="space-y-2">
          {visible.map((s) => (
            <ExpertListRow key={s.id} s={s}
              onEdit={() => { setEditTarget(s); setModalOpen(true); }}
              onDelete={() => void handleDelete(s)}
              onCopyPortal={() => void handleCopyPortalLink(s)}
              onShowActivity={() => setActivityTarget(s)}
              onResetPin={() => void handleResetPin(s)}
              recentPrograms={programsByStaff.get(s.id)} />
          ))}
        </ul>
      )}

      <ExpertFormModal
        open={modalOpen}
        expert={editTarget}
        onClose={() => { setModalOpen(false); setEditTarget(null); }}
        onCreated={() => void fetchExperts()}
      />

      {/* STEP-STAFF-PORTAL-P4 — 활동 이력 드로어 */}
      <ExpertActivityDrawer expert={activityTarget} onClose={() => setActivityTarget(null)} />
    </div>
  );
}
