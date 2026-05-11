// bal24 v2 — 전문가 목록 페이지
// 카드(기본) / 리스트 + 분야 필터 + 검색 + 신규 등록

import { useCallback, useEffect, useMemo, useState } from 'react';
import { LayoutGrid, List, Plus, Loader2, Search, UserStar, Phone, Mail, Pencil, Trash2, Eye } from 'lucide-react';
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
import type { StaffPool } from '../../types/database';
import ExpertFormModal from './ExpertFormModal';

type ViewMode = 'card' | 'list';
type FieldFilter = '전체' | '교육' | '컨설팅' | '행사' | '기타';

const FIELD_FILTERS: FieldFilter[] = ['전체', '교육', '컨설팅', '행사', '기타'];
const KNOWN_FIELDS = ['교육', '컨설팅', '행사'];

function expertMatchesField(s: StaffPool, filter: FieldFilter): boolean {
  if (filter === '전체') return true;
  const tags = s.specialty ?? [];
  if (filter === '기타') {
    if (tags.length === 0) return true;
    return tags.every((t) => !KNOWN_FIELDS.includes(t));
  }
  return tags.includes(filter);
}

function ExpertGridCard({ s, onEdit, onDelete }: { s: StaffPool; onEdit: () => void; onDelete: () => void }) {
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
      </CardContent>
      {/* STEP-CLIENT-EXPERT-CARD — 고객사 카드와 동일 3 버튼 (보기/수정/삭제). 별도 detail 모달이 없어 보기=수정 동작 */}
      <div className="flex items-center gap-2 px-5 pb-4">
        <Button variant="outline" size="sm" leftIcon={<Eye size={14} />} onClick={onEdit} className="!flex-1">내용보기</Button>
        <Button variant="primary" size="sm" leftIcon={<Pencil size={14} />} onClick={onEdit} className="!flex-1">수정</Button>
        <button type="button" onClick={(e) => { e.stopPropagation(); onDelete(); }}
          aria-label="삭제"
          className="inline-flex items-center justify-center gap-1 h-8 px-2.5 rounded-md text-xs font-semibold text-rose-500 border border-rose-200 bg-white hover:bg-rose-50 transition-colors">
          <Trash2 size={13} aria-hidden="true" />
          삭제
        </button>
      </div>
    </Card>
  );
}

function ExpertListRow({ s, onEdit, onDelete }: { s: StaffPool; onEdit: () => void; onDelete: () => void }) {
  return (
    <li className="group flex items-center gap-3 p-4 bg-white rounded-xl border border-slate-200 hover:border-primary/30 hover:shadow-sm transition relative">
      {s.profile_image_url ? (
        <img src={s.profile_image_url} alt={`${s.name} 프로필`} className="w-10 h-10 rounded-full object-cover shrink-0 border border-slate-200" />
      ) : (
        <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary shrink-0">
          <UserStar size={18} />
        </span>
      )}
      <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-3">
        <div className="min-w-0">
          <div className="text-sm font-bold text-text truncate flex items-center gap-1.5">
            {s.name}
            {s.staff_type && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-violet-100 text-violet-700 border border-violet-200">
                {s.staff_type}
              </span>
            )}
          </div>
          <div className="text-xs text-muted truncate">
            {[s.organization, s.position].filter(Boolean).join(' · ') || '소속·직책 미지정'}
          </div>
        </div>
        <div className="min-w-0 text-xs text-muted">
          {s.specialty?.length ? (
            <div className="flex flex-wrap gap-1">
              {s.specialty.map((t) => (
                <span key={t} className="bg-violet-50 text-violet-600 border border-violet-200 px-2 py-0.5 rounded-full text-[11px] font-semibold">{t}</span>
              ))}
            </div>
          ) : (
            <span className="text-slate-400">분야 미지정</span>
          )}
        </div>
        <div className="min-w-0 text-xs text-muted truncate">
          {s.phone_mobile && <>{s.phone_mobile}</>}
          {s.phone_mobile && s.email && ' · '}
          {s.email && <>{s.email}</>}
          {!s.phone_mobile && !s.email && <span className="text-slate-400">연락처 미지정</span>}
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
        <button type="button" onClick={onEdit} aria-label="수정"
          className="p-1.5 rounded-md text-slate-400 hover:bg-violet-50 hover:text-violet-600">
          <Pencil size={12} />
        </button>
        <button type="button" onClick={onDelete} aria-label="삭제"
          className="p-1.5 rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-500">
          <Trash2 size={12} />
        </button>
      </div>
    </li>
  );
}

export default function ExpertsPage() {
  const toast = useToast();
  const [experts, setExperts] = useState<StaffPool[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>('card');
  const [field, setField] = useState<FieldFilter>('전체');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  // STEP-EXPERT-CRUD-FULL — 수정 대상 (null = 신규 등록)
  const [editTarget, setEditTarget] = useState<StaffPool | null>(null);

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
      setExperts((data ?? []) as StaffPool[]);
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

  // STEP-EXPERT-CRUD-FULL — soft-delete (휴지통 30일 보관)
  const handleDelete = async (s: StaffPool) => {
    if (!window.confirm(`"${s.name}" 전문가를 삭제할까요? 30일 후 자동으로 완전 삭제됩니다. (관리자 휴지통에서 복원 가능)`)) return;
    const err = await softDelete('staff_pool', s.id);
    if (err) { toast.error(err); return; }
    toast.success('전문가를 휴지통으로 이동했어요.');
    void fetchExperts();
  };

  const counts = useMemo<Record<FieldFilter, number>>(() => {
    const acc: Record<FieldFilter, number> = { 전체: experts.length, 교육: 0, 컨설팅: 0, 행사: 0, 기타: 0 };
    for (const s of experts) {
      for (const f of ['교육', '컨설팅', '행사'] as const) {
        if (expertMatchesField(s, f)) acc[f] += 1;
      }
      if (expertMatchesField(s, '기타')) acc['기타'] += 1;
    }
    return acc;
  }, [experts]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return experts.filter((s) => {
      if (!expertMatchesField(s, field)) return false;
      if (!q) return true;
      const haystack = [
        s.name,
        s.organization,
        ...(s.specialty ?? []),
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [experts, field, search]);

  return (
    <div className="space-y-5 max-w-[1400px]">
      <h1 className="text-2xl font-bold text-[#1E1B4B] flex items-center gap-2">
        <span aria-hidden="true">👥</span>
        전문가
      </h1>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="분야 필터">
          {FIELD_FILTERS.map((f) => {
            const active = field === f;
            return (
              <button
                key={f}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setField(f)}
                className={[
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                  active ? 'bg-primary text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50',
                ].join(' ')}
              >
                {f}
                <span className={['inline-flex items-center justify-center min-w-[1.25rem] px-1 rounded text-[10px]',
                  active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'].join(' ')}>
                  {counts[f] ?? 0}
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
          title={search.trim() || field !== '전체' ? '조건에 맞는 전문가가 없어요.' : '아직 등록된 전문가가 없어요.'}
          description={!search.trim() && field === '전체' ? '첫 전문가를 등록해 보세요.' : undefined}
          action={
            !search.trim() && field === '전체' && (
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
              onDelete={() => void handleDelete(s)} />
          ))}
        </div>
      ) : (
        <ul className="space-y-2">
          {visible.map((s) => (
            <ExpertListRow key={s.id} s={s}
              onEdit={() => { setEditTarget(s); setModalOpen(true); }}
              onDelete={() => void handleDelete(s)} />
          ))}
        </ul>
      )}

      <ExpertFormModal
        open={modalOpen}
        expert={editTarget}
        onClose={() => { setModalOpen(false); setEditTarget(null); }}
        onCreated={() => void fetchExperts()}
      />
    </div>
  );
}
