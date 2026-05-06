// bal24 v2 — 고객사 목록 페이지
// 카드(기본) / 리스트 + 검색(상호/담당자) + 신규 등록 + 담당자 N명 표시

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  LayoutGrid, List, Plus, Loader2, Search, Building2, Phone, Mail, Users,
} from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../components/ui';
import { supabase } from '../../lib/supabase';
import type { Client, ClientContact } from '../../types/database';
import ClientFormModal from './ClientFormModal';

type ViewMode = 'card' | 'list';

type ClientRow = Client & {
  contacts: Pick<ClientContact, 'id' | 'name' | 'position' | 'phone_mobile' | 'email'>[];
};

const SELECT_COLUMNS =
  '*, contacts:client_contacts(id,name,position,phone_mobile,email)';

function formatBusinessNumber(raw?: string | null): string {
  if (!raw) return '';
  const d = raw.replace(/\D/g, '');
  if (d.length !== 10) return raw;
  return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
}

function ClientGridCard({ c }: { c: ClientRow }) {
  const primary = c.contacts[0];
  return (
    <Card className="hover:border-primary/30 hover:shadow-md transition h-full">
      <CardHeader>
        <div className="flex items-start gap-2">
          <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 text-primary shrink-0">
            <Building2 size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <CardTitle className="truncate">{c.name}</CardTitle>
            <CardDescription>
              {c.representative ?? '대표자 미지정'}
              {c.business_number && ` · ${formatBusinessNumber(c.business_number)}`}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-1.5 text-xs text-muted">
        {(c.business_type || c.business_item) && (
          <div>
            {c.business_type && <span className="text-slate-700">{c.business_type}</span>}
            {c.business_type && c.business_item && ' · '}
            {c.business_item && <span className="text-slate-700">{c.business_item}</span>}
          </div>
        )}
        {primary ? (
          <>
            <div className="flex items-center gap-1.5">
              <Users size={12} className="text-slate-400" />
              <span className="text-slate-700 font-medium">{primary.name}</span>
              {primary.position && <span>· {primary.position}</span>}
              {c.contacts.length > 1 && (
                <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                  외 {c.contacts.length - 1}명
                </span>
              )}
            </div>
            {primary.phone_mobile && (
              <div className="flex items-center gap-1.5">
                <Phone size={12} className="text-slate-400" />
                <span className="truncate">{primary.phone_mobile}</span>
              </div>
            )}
            {primary.email && (
              <div className="flex items-center gap-1.5">
                <Mail size={12} className="text-slate-400" />
                <span className="truncate">{primary.email}</span>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center gap-1.5 text-slate-400">
            <Users size={12} />
            담당자 미등록
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ClientListRow({ c }: { c: ClientRow }) {
  const primary = c.contacts[0];
  return (
    <li className="flex items-center gap-3 p-4 bg-white rounded-xl border border-slate-200 hover:border-primary/30 hover:shadow-sm transition">
      <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 text-primary shrink-0">
        <Building2 size={18} />
      </span>
      <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-3">
        <div className="min-w-0">
          <div className="text-sm font-bold text-text truncate">{c.name}</div>
          <div className="text-xs text-muted truncate">
            {c.representative ?? '대표자 미지정'}
            {c.business_number && ` · ${formatBusinessNumber(c.business_number)}`}
          </div>
        </div>
        <div className="min-w-0 text-xs text-muted">
          {c.business_type || c.business_item ? (
            <>
              <span className="font-semibold text-slate-700">업종</span>{' '}
              {[c.business_type, c.business_item].filter(Boolean).join(' · ')}
            </>
          ) : (
            <span className="text-slate-400">업종 미지정</span>
          )}
        </div>
        <div className="min-w-0 text-xs text-muted truncate">
          {primary ? (
            <>
              <span className="font-semibold text-slate-700">담당</span>{' '}
              {primary.name}
              {primary.phone_mobile && ` · ${primary.phone_mobile}`}
              {c.contacts.length > 1 && (
                <span className="ml-1 text-[10px] bg-primary/10 text-primary px-1 py-0.5 rounded">
                  +{c.contacts.length - 1}
                </span>
              )}
            </>
          ) : (
            <span className="text-slate-400">담당자 미등록</span>
          )}
        </div>
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
  const [modalOpen, setModalOpen] = useState(false);

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
      if (c.representative?.toLowerCase().includes(q)) return true;
      return c.contacts.some((ct) => ct.name?.toLowerCase().includes(q));
    });
  }, [clients, search]);

  return (
    <div className="space-y-5 max-w-[1400px]">
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

          <Button variant="primary" leftIcon={<Plus size={16} />} onClick={() => setModalOpen(true)}>
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
        <div className="flex flex-col items-center justify-center py-16 text-center bg-white rounded-xl border border-dashed border-slate-200">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
            <Building2 size={20} />
          </div>
          <p className="text-sm text-muted mb-3">
            {search.trim() ? '검색 결과가 없어요.' : '아직 등록된 고객사가 없어요.'}
          </p>
          {!search.trim() && (
            <Button variant="outline" size="sm" leftIcon={<Plus size={14} />} onClick={() => setModalOpen(true)}>
              첫 고객사 등록하기
            </Button>
          )}
        </div>
      ) : view === 'card' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map((c) => (<ClientGridCard key={c.id} c={c} />))}
        </div>
      ) : (
        <ul className="space-y-2">
          {visible.map((c) => (<ClientListRow key={c.id} c={c} />))}
        </ul>
      )}

      <ClientFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={() => void fetchClients()}
      />
    </div>
  );
}
