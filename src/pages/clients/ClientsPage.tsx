// bal24 v2 — 고객사 목록 페이지
// 카드(기본) / 리스트 + 검색(상호/담당자) + 신규 등록·수정·내용보기 + 담당자 N명 표시

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  LayoutGrid, List, Plus, Loader2, Search, Building2, Phone, Mail, Users,
  Banknote, FileText, Briefcase, Eye, Pencil, Trash2,
} from 'lucide-react';
import { softDelete } from '../../lib/softDeleteUtils';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
} from '../../components/ui';
import { supabase } from '../../lib/supabase';
import EmptyState from '../../components/EmptyState';
import { useToast } from '../../contexts/ToastContext';
import type { Client, ClientContact } from '../../types/database';
import TagFilterTabs from '../../components/TagFilterTabs';
import { useTagFilter } from '../../hooks/useTagFilter';
import ClientFormModal from './ClientFormModal';
import ClientDetailModal from './ClientDetailModal';
// 박경수님 2026-05-29 STEP-CLEANUP Phase 2 — 연관 사업 드로어
import ClientProjectsDrawer from './ClientProjectsDrawer';
import ClientListRowImported from './ClientListRow';
// 박경수님 2026-05-28 STEP-CLIENT-TYPE-TAG — 기관 유형 필터·배지
import { CLIENT_TYPES, getClientTypeBadge } from './clientTypeUtils';

type ViewMode = 'card' | 'list';

type ClientRow = Client & {
  contacts: Pick<ClientContact, 'id' | 'name' | 'position' | 'phone_mobile' | 'email'>[];
};

const SELECT_COLUMNS =
  '*, contacts:client_contacts(id,name,position,phone_mobile,email)';

// 박경수님 + SkyClaw 요청 — client_type 제거. tags 배지로 대체.
function formatBusinessNumber(raw?: string | null): string {
  if (!raw) return '';
  const d = raw.replace(/\D/g, '');
  if (d.length !== 10) return raw;
  return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
}

interface CardActions {
  onView: (c: ClientRow) => void;
  onEdit: (c: ClientRow) => void;
  /** STEP-DELETE-RESUME-FULL — 카드/리스트 hover 삭제 */
  onDelete: (c: ClientRow) => void;
  /** 박경수님 2026-05-29 STEP-CLEANUP — 연관 사업 드로어 */
  onShowProjects?: (c: ClientRow) => void;
}

function ClientGridCard({ c, onView, onEdit, onDelete, onShowProjects }: { c: ClientRow } & CardActions) {
  const ceo = c.ceo_name ?? c.representative;
  const industry = [c.business_type, c.business_item].filter(Boolean).join(' · ');
  const bankLine = [c.bank_name, c.bank_account, c.bank_holder].filter(Boolean).join(' ');
  const cardTags = (c.tags ?? []).slice(0, 3);

  return (
    <Card className="group hover:border-violet-200 hover:shadow-md transition min-h-[260px] flex flex-col relative">
      <CardHeader>
        <div className="flex items-start gap-2">
          <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-violet-100 text-violet-600 shrink-0">
            <Building2 size={18} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            {cardTags.length > 0 && (
              <div className="flex items-center gap-1 mb-0.5 flex-wrap">
                {cardTags.map((t) => (
                  <span key={t} className="rounded-full px-2 py-0.5 text-[11px] font-semibold bg-violet-50 text-violet-700 border border-violet-200">{t}</span>
                ))}
              </div>
            )}
            {/* STEP-CLIENT-EXPERT-CARD — 상호명 + 부서명 병기 */}
            <div className="text-base font-bold text-[#1E1B4B] truncate">
              {c.name}
              {/* 박경수님 2026-05-28 STEP-CLIENT-TYPE-TAG — 기관 유형 배지 */}
              {(() => {
                const b = getClientTypeBadge(c.client_type);
                return <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded font-bold ${b.className}`}>{b.label}</span>;
              })()}
              {/* STEP-CONSORTIUM-REDESIGN (박경수님 2026-05-27) — 자사 뱃지 */}
              {c.is_own_company && (
                <span className="ml-1.5 text-xs px-1.5 py-0.5 bg-teal-100 text-teal-700 rounded font-bold">자사</span>
              )}
              {c.department && <span className="ml-1 text-sm font-semibold text-slate-500">· {c.department}</span>}
            </div>
            {c.business_name && (
              <div className="text-xs text-slate-500 truncate">{c.business_name}</div>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-1.5 text-xs flex-1">
        {ceo && (
          <Line icon={<Users size={12} aria-hidden="true" />}>
            <span className="text-slate-500">대표</span>{' '}
            <span className="text-slate-700 font-medium">{ceo}</span>
          </Line>
        )}
        {c.phone && (
          <Line icon={<Phone size={12} aria-hidden="true" />}>
            <span className="text-slate-700">{c.phone}</span>
          </Line>
        )}
        {c.email && (
          <Line icon={<Mail size={12} aria-hidden="true" />}>
            <span className="text-slate-700 truncate">{c.email}</span>
          </Line>
        )}
        {bankLine && (
          <Line icon={<Banknote size={12} aria-hidden="true" />}>
            <span className="text-slate-700 truncate">{bankLine}</span>
          </Line>
        )}
        {c.business_number && (
          <Line icon={<FileText size={12} aria-hidden="true" />}>
            <span className="text-slate-500">사업자</span>{' '}
            <span className="text-slate-700">{formatBusinessNumber(c.business_number)}</span>
          </Line>
        )}
        {industry && (
          <Line icon={<Briefcase size={12} aria-hidden="true" />}>
            <span className="text-slate-700 truncate">{industry}</span>
          </Line>
        )}
        {/* STEP-CLIENT-EXPERT-CARD — 담당자 최대 2명 + 연락처 표시 */}
        {c.contacts.slice(0, 2).map((ct) => (
          <Line key={ct.id} icon={<Users size={12} aria-hidden="true" />}>
            <span className="text-slate-700 font-medium">{ct.name}</span>
            {ct.position && <span className="text-slate-500"> · {ct.position}</span>}
            {ct.phone_mobile && <span className="text-slate-500"> · {ct.phone_mobile}</span>}
          </Line>
        ))}
        {c.contacts.length > 2 && (
          <p className="text-[10px] text-slate-400 pl-4">외 {c.contacts.length - 2}명</p>
        )}
        {c.note && (
          <p className="text-[11px] text-slate-500 italic line-clamp-1 pt-1">{c.note}</p>
        )}
      </CardContent>

      {/* STEP-CLIENT-EXPERT-CARD — 하단 3 버튼 (보기/수정/삭제) */}
      <div className="flex items-center gap-2 px-5 pb-4">
        <Button variant="outline" size="sm" leftIcon={<Eye size={14} />} onClick={() => onView(c)} className="!flex-1">내용보기</Button>
        <Button variant="primary" size="sm" leftIcon={<Pencil size={14} />} onClick={() => onEdit(c)} className="!flex-1">수정</Button>
        {/* 박경수님 2026-05-29 STEP-CLEANUP — 연관 사업 드로어 */}
        {onShowProjects && (
          <button type="button" onClick={(e) => { e.stopPropagation(); onShowProjects(c); }}
            aria-label="연관 사업" title="연관 사업"
            className="inline-flex items-center justify-center w-8 h-8 rounded-md text-violet-600 border border-violet-200 bg-white hover:bg-violet-50 transition-colors">
            📁
          </button>
        )}
        {/* STEP-CONSORTIUM-REDESIGN — 자사는 삭제 차단 */}
        {!c.is_own_company && (
          <button type="button" onClick={(e) => { e.stopPropagation(); onDelete(c); }}
            aria-label="삭제"
            className="inline-flex items-center justify-center gap-1 h-8 px-2.5 rounded-md text-xs font-semibold text-rose-500 border border-rose-200 bg-white hover:bg-rose-50 transition-colors">
            <Trash2 size={13} aria-hidden="true" />
            삭제
          </button>
        )}
      </div>
    </Card>
  );
}

function Line({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <span className="text-slate-400 shrink-0">{icon}</span>
      <span className="truncate">{children}</span>
    </div>
  );
}

// ClientListRow 는 ./ClientListRow 로 분리 (V-1, STEP-CONSORTIUM-REDESIGN).

export default function ClientsPage() {
  const toast = useToast();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>('card');
  const [search, setSearch] = useState('');
  // 박경수님 2026-05-28 STEP-CLIENT-TYPE-TAG — 기관 유형 필터
  const [typeFilter, setTypeFilter] = useState<string>('전체');

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Client | null>(null);
  const [detailTarget, setDetailTarget] = useState<Client | null>(null);
  // 박경수님 2026-05-29 STEP-CLEANUP Phase 2 — 연관 사업 드로어 대상
  const [projectsTarget, setProjectsTarget] = useState<Client | null>(null);
  const tagFilter = useTagFilter('client', clients); // STEP-TAGS-2B
  const fetchClients = useCallback(async () => {
    setLoading(true);
    try {
      // STEP-EXPERT-CRUD-FULL — 휴지통(deleted_at IS NOT NULL) 제외
      const { data, error } = await supabase
        .from('clients')
        .select(SELECT_COLUMNS)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setClients((data ?? []) as ClientRow[]);
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[clients] 목록 조회 실패:', raw);
      const m = raw.toLowerCase();
      if (m.includes("could not find the table 'public.client_contacts'") || m.includes('pgrst205')) {
        toast.error('담당자 테이블이 아직 적용되지 않았어요. Supabase에서 마이그레이션을 실행해 주세요.');
      } else {
        toast.error('고객사 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
      }
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void fetchClients();
  }, [fetchClients]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients.filter((c) => {
      if (!tagFilter.matches(c)) return false; // STEP-TAGS-2B
      // 박경수님 2026-05-28 — 기관 유형 필터
      if (typeFilter !== '전체' && (c.client_type ?? '거래처') !== typeFilter) return false;
      if (!q) return true;
      if (c.name?.toLowerCase().includes(q)) return true;
      if (c.business_name?.toLowerCase().includes(q)) return true;
      if (c.representative?.toLowerCase().includes(q)) return true;
      if (c.ceo_name?.toLowerCase().includes(q)) return true;
      return c.contacts.some((ct) => ct.name?.toLowerCase().includes(q));
    });
  }, [clients, search, tagFilter, typeFilter]);

  const handleView = (c: ClientRow) => setDetailTarget(c);
  const handleEdit = (c: ClientRow) => {
    setDetailTarget(null);
    setEditTarget(c);
  };

  // STEP-DELETE-RESUME-FULL — 카드/리스트 hover 삭제
  const handleDelete = async (c: ClientRow) => {
    // STEP-CONSORTIUM-REDESIGN (박경수님 2026-05-27) — 자사는 삭제 차단
    if (c.is_own_company) {
      toast.error('자사 고객사는 삭제할 수 없어요.');
      return;
    }
    if (!window.confirm(`"${c.name}"을(를) 삭제할까요? 30일 후 자동으로 완전 삭제됩니다. (관리자 휴지통에서 복원 가능)`)) return;
    const err = await softDelete('clients', c.id);
    if (err) { toast.error(err); return; }
    toast.success('고객사를 휴지통으로 이동했어요.');
    void fetchClients();
  };

  return (
    <div className="space-y-5 max-w-[1400px]">
      <h1 className="text-2xl font-bold text-[#1E1B4B] flex items-center gap-2">
        <span aria-hidden="true">🏢</span>
        고객사
      </h1>

      <TagFilterTabs categories={tagFilter.categories} active={tagFilter.active} counts={tagFilter.counts} onChange={tagFilter.setActive} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="상호명 또는 담당자명으로 검색"
              className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          {/* 박경수님 2026-05-28 STEP-CLIENT-TYPE-TAG — 기관 유형 필터 */}
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20">
            <option value="전체">전체 유형</option>
            {CLIENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
            <button
              type="button"
              onClick={() => setView('card')}
              aria-pressed={view === 'card'}
              aria-label="카드 보기"
              className={['inline-flex items-center justify-center w-8 h-8 rounded-md transition-colors',
                view === 'card' ? 'bg-primary text-white' : 'text-slate-500 hover:bg-slate-50'].join(' ')}
            >
              <LayoutGrid size={16} />
            </button>
            <button
              type="button"
              onClick={() => setView('list')}
              aria-pressed={view === 'list'}
              aria-label="리스트 보기"
              className={['inline-flex items-center justify-center w-8 h-8 rounded-md transition-colors',
                view === 'list' ? 'bg-primary text-white' : 'text-slate-500 hover:bg-slate-50'].join(' ')}
            >
              <List size={16} />
            </button>
          </div>

          <Button variant="primary" leftIcon={<Plus size={16} />} onClick={() => setCreateOpen(true)}>
            신규 등록
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-sm text-muted">
          <Loader2 size={18} className="animate-spin mr-2" />
          불러오는 중…
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          emoji="🏢"
          title={search.trim() ? '검색 결과가 없어요.' : '아직 등록된 고객사가 없어요.'}
          description={!search.trim() ? '첫 고객사를 등록해 보세요.' : undefined}
          action={
            !search.trim() && (
              <Button variant="primary" leftIcon={<Plus size={14} />} onClick={() => setCreateOpen(true)}>
                + 고객사 등록
              </Button>
            )
          }
        />
      ) : view === 'card' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map((c) => (
            <ClientGridCard key={c.id} c={c} onView={handleView} onEdit={handleEdit} onDelete={handleDelete} onShowProjects={setProjectsTarget} />
          ))}
        </div>
      ) : (
        <ul className="space-y-2">
          {visible.map((c) => (
            <ClientListRowImported key={c.id} c={c} onView={handleView} onEdit={handleEdit} onDelete={handleDelete} onShowProjects={setProjectsTarget} />
          ))}
        </ul>
      )}

      {/* 신규 등록 모달 */}
      <ClientFormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSaved={() => {
          setCreateOpen(false);
          void fetchClients();
        }}
      />

      {/* 수정 모달 */}
      <ClientFormModal
        open={Boolean(editTarget)}
        client={editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={() => {
          setEditTarget(null);
          void fetchClients();
        }}
      />

      {/* 상세 모달 */}
      <ClientDetailModal
        open={Boolean(detailTarget)}
        client={detailTarget}
        onClose={() => setDetailTarget(null)}
        onDeleted={() => void fetchClients()}
      />
      {/* 박경수님 2026-05-29 STEP-CLEANUP — 연관 사업 드로어 */}
      <ClientProjectsDrawer client={projectsTarget} onClose={() => setProjectsTarget(null)} />
    </div>
  );
}
