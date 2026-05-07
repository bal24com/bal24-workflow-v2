// bal24 v2 — 고객사 목록 페이지
// 카드(기본) / 리스트 + 검색(상호/담당자) + 신규 등록·수정·내용보기 + 담당자 N명 표시

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  LayoutGrid, List, Plus, Loader2, Search, Building2, Phone, Mail, Users,
  Banknote, FileText, Briefcase, Eye, Pencil,
} from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
} from '../../components/ui';
import { supabase } from '../../lib/supabase';
import EmptyState from '../../components/EmptyState';
import type { Client, ClientContact, ClientType } from '../../types/database';
import ClientFormModal from './ClientFormModal';
import ClientDetailModal from './ClientDetailModal';

type ViewMode = 'card' | 'list';

type ClientRow = Client & {
  contacts: Pick<ClientContact, 'id' | 'name' | 'position' | 'phone_mobile' | 'email'>[];
};

const SELECT_COLUMNS =
  '*, contacts:client_contacts(id,name,position,phone_mobile,email)';

const TYPE_BADGE: Record<ClientType, { bg: string; text: string; label: string }> = {
  client: { bg: 'bg-violet-100', text: 'text-violet-700', label: '고객사' },
  vendor: { bg: 'bg-orange-100', text: 'text-orange-700', label: '거래처' },
  both: { bg: 'bg-cyan-100', text: 'text-cyan-700', label: '고객·거래처' },
};

function formatBusinessNumber(raw?: string | null): string {
  if (!raw) return '';
  const d = raw.replace(/\D/g, '');
  if (d.length !== 10) return raw;
  return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
}

function typeBadge(c: Client) {
  const key = (c.client_type ?? 'client') as ClientType;
  return TYPE_BADGE[key] ?? TYPE_BADGE.client;
}

interface CardActions {
  onView: (c: ClientRow) => void;
  onEdit: (c: ClientRow) => void;
}

function ClientGridCard({ c, onView, onEdit }: { c: ClientRow } & CardActions) {
  const tone = typeBadge(c);
  const ceo = c.ceo_name ?? c.representative;
  const industry = [c.business_type, c.business_item].filter(Boolean).join(' · ');
  const bankLine = [c.bank_name, c.bank_account, c.bank_holder].filter(Boolean).join(' ');
  const primaryContact = c.contacts[0];

  return (
    <Card className="hover:border-violet-200 hover:shadow-md transition h-full flex flex-col">
      <CardHeader>
        <div className="flex items-start gap-2">
          <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-violet-100 text-violet-600 shrink-0">
            <Building2 size={18} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone.bg} ${tone.text}`}>
                {tone.label}
              </span>
            </div>
            <div className="text-base font-bold text-[#1E1B4B] truncate">{c.name}</div>
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
        {primaryContact && (
          <Line icon={<Users size={12} aria-hidden="true" />}>
            <span className="text-slate-500">담당</span>{' '}
            <span className="text-slate-700 font-medium">{primaryContact.name}</span>
            {primaryContact.position && <span className="text-slate-500"> · {primaryContact.position}</span>}
            {c.contacts.length > 1 && (
              <span className="ml-1 text-[10px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded">
                외 {c.contacts.length - 1}명
              </span>
            )}
          </Line>
        )}
        {c.note && (
          <p className="text-[11px] text-slate-500 italic line-clamp-1 pt-1">{c.note}</p>
        )}
      </CardContent>

      <div className="flex items-center gap-2 px-5 pb-4">
        <Button
          variant="outline"
          size="sm"
          leftIcon={<Eye size={14} />}
          onClick={() => onView(c)}
          className="!flex-1"
        >
          내용보기
        </Button>
        <Button
          variant="primary"
          size="sm"
          leftIcon={<Pencil size={14} />}
          onClick={() => onEdit(c)}
          className="!flex-1"
        >
          수정
        </Button>
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

function ClientListRow({ c, onView, onEdit }: { c: ClientRow } & CardActions) {
  const tone = typeBadge(c);
  const ceo = c.ceo_name ?? c.representative;
  return (
    <li className="flex items-center gap-3 p-4 bg-white rounded-xl border border-slate-200 hover:border-violet-200 hover:shadow-sm transition">
      <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-violet-100 text-violet-600 shrink-0">
        <Building2 size={18} aria-hidden="true" />
      </span>
      <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${tone.bg} ${tone.text}`}>
              {tone.label}
            </span>
            <span className="text-sm font-bold text-text truncate">{c.name}</span>
          </div>
          <div className="text-xs text-muted truncate">
            {ceo ?? '대표자 미지정'}
            {c.business_number && ` · ${formatBusinessNumber(c.business_number)}`}
          </div>
        </div>
        <div className="min-w-0 text-xs text-muted">
          {[c.business_type, c.business_item].filter(Boolean).join(' · ') || (
            <span className="text-slate-400">업종 미지정</span>
          )}
        </div>
        <div className="min-w-0 text-xs text-muted truncate">
          {c.phone || c.email ? (
            <>
              {c.phone && <span>{c.phone}</span>}
              {c.phone && c.email && ' · '}
              {c.email}
            </>
          ) : c.contacts[0] ? (
            <>
              <span className="font-semibold text-slate-700">담당</span>{' '}
              {c.contacts[0].name}
              {c.contacts[0].phone_mobile && ` · ${c.contacts[0].phone_mobile}`}
            </>
          ) : (
            <span className="text-slate-400">연락처 미등록</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <Button variant="outline" size="sm" leftIcon={<Eye size={14} />} onClick={() => onView(c)}>
          내용
        </Button>
        <Button variant="primary" size="sm" leftIcon={<Pencil size={14} />} onClick={() => onEdit(c)}>
          수정
        </Button>
      </div>
    </li>
  );
}

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>('card');
  const [search, setSearch] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Client | null>(null);
  const [detailTarget, setDetailTarget] = useState<Client | null>(null);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const { data, error } = await supabase
        .from('clients')
        .select(SELECT_COLUMNS)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setClients((data ?? []) as ClientRow[]);
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[clients] 목록 조회 실패:', raw);
      const m = raw.toLowerCase();
      if (m.includes("could not find the table 'public.client_contacts'") || m.includes('pgrst205')) {
        setErrorMsg('담당자 테이블이 아직 적용되지 않았어요. Supabase에서 마이그레이션을 실행해 주세요.');
      } else {
        setErrorMsg('고객사 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchClients();
  }, [fetchClients]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) => {
      if (c.name?.toLowerCase().includes(q)) return true;
      if (c.business_name?.toLowerCase().includes(q)) return true;
      if (c.representative?.toLowerCase().includes(q)) return true;
      if (c.ceo_name?.toLowerCase().includes(q)) return true;
      return c.contacts.some((ct) => ct.name?.toLowerCase().includes(q));
    });
  }, [clients, search]);

  const handleView = (c: ClientRow) => setDetailTarget(c);
  const handleEdit = (c: ClientRow) => {
    setDetailTarget(null);
    setEditTarget(c);
  };

  return (
    <div className="space-y-5 max-w-[1400px]">
      <h1 className="text-2xl font-bold text-[#1E1B4B] flex items-center gap-2">
        <span aria-hidden="true">🏢</span>
        고객사
      </h1>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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

      {errorMsg && (
        <div role="alert" className="rounded-xl bg-danger/10 border border-danger/20 px-4 py-3 text-sm text-danger">{errorMsg}</div>
      )}

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
            <ClientGridCard key={c.id} c={c} onView={handleView} onEdit={handleEdit} />
          ))}
        </div>
      ) : (
        <ul className="space-y-2">
          {visible.map((c) => (
            <ClientListRow key={c.id} c={c} onView={handleView} onEdit={handleEdit} />
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
      />
    </div>
  );
}
