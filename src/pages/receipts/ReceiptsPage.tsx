// bal24 v2 — 증빙(영수증) 통합 목록
// expense_id / income_id가 연결된 모든 영수증을 한곳에서 조회

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Loader2, Search, FileIcon, ExternalLink, Plus,
} from 'lucide-react';
import { Button } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { formatDateKo, formatMoney } from '../../lib/utils';
import EmptyState from '../../components/EmptyState';
import { useToast } from '../../contexts/ToastContext';
import { RECEIPT_TYPE_VALUES } from '../../utils/accounting';
import type { Receipt, ReceiptType } from '../../types/database';
import { usePartnerProfile } from '../../hooks/usePartnerProfile';

type ReceiptRow = Receipt & {
  expense?: { id: string; description: string; expense_date: string; deleted_at: string | null } | null;
  income?: { id: string; description: string; income_date: string; deleted_at: string | null } | null;
  project?: { id: string; name: string; deleted_at: string | null } | null;
  consortium?: { id: string; name: string; deleted_at: string | null } | null;
};

// STEP-TRASH-FILTER-AUDIT — nested deleted_at 까지 가져와서 휴지통 join 거래 차단
const SELECT_COLUMNS =
  '*, expense:expenses!receipts_expense_id_fkey(id,description,expense_date,deleted_at), income:income(id,description,income_date,deleted_at), project:projects(id,name,deleted_at), consortium:consortiums(id,name,deleted_at)';

type TypeFilter = ReceiptType | '전체';

function fileSizeLabel(bytes?: number | null): string {
  if (bytes == null || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function TypeFilterTabs({ value, onChange, counts }: {
  value: TypeFilter;
  onChange: (v: TypeFilter) => void;
  counts: Record<TypeFilter, number>;
}) {
  const all: TypeFilter[] = ['전체', ...RECEIPT_TYPE_VALUES];
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="유형 필터">
      {all.map((t) => {
        const active = value === t;
        return (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t)}
            className={['inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
              active ? 'bg-primary text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'].join(' ')}
          >
            {t}
            <span className={['inline-flex items-center justify-center min-w-[1.25rem] px-1 rounded text-[10px]',
              active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'].join(' ')}>
              {counts[t] ?? 0}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default function ReceiptsPage() {
  const toast = useToast();
  // STEP-PARTNER-RECEIPTS-FILTER — PARTNER 면 본인 회사(consortium_member_id) 증빙만
  const { isPartner, consortiumMemberId, isLoading: partnerLoading } = usePartnerProfile();
  const [items, setItems] = useState<ReceiptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<TypeFilter>('전체');
  const [search, setSearch] = useState('');

  const fetchItems = useCallback(async () => {
    if (isPartner && partnerLoading) return;
    setLoading(true);
    try {
      let query = supabase
        .from('receipts')
        .select(SELECT_COLUMNS)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      if (isPartner && consortiumMemberId) {
        query = query.eq('consortium_member_id', consortiumMemberId);
      }
      const { data, error } = await query;
      if (error) throw error;
      setItems((data ?? []) as ReceiptRow[]);
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[receipts] 조회 실패:', raw);
      toast.error('증빙 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  }, [toast, isPartner, consortiumMemberId, partnerLoading]);

  useEffect(() => { void fetchItems(); }, [fetchItems]);

  // STEP-TRASH-FILTER-AUDIT — 휴지통 join 영수증 제외 (재사용 헬퍼)
  const isLive = useCallback((r: ReceiptRow) =>
    !r.expense?.deleted_at && !r.income?.deleted_at && !r.project?.deleted_at && !r.consortium?.deleted_at,
  []);

  const counts = useMemo<Record<TypeFilter, number>>(() => {
    const live = items.filter(isLive);
    const acc: Record<TypeFilter, number> = {
      전체: live.length,
      영수증: 0, 세금계산서: 0, 간이영수증: 0, 계좌이체: 0, 카드전표: 0, 기타: 0,
    };
    for (const r of live) acc[r.receipt_type] = (acc[r.receipt_type] ?? 0) + 1;
    return acc;
  }, [items, isLive]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((r) => {
      if (!isLive(r)) return false;
      if (filter !== '전체' && r.receipt_type !== filter) return false;
      if (!q) return true;
      const hay = [r.file_name, r.description, r.expense?.description, r.income?.description, r.project?.name, r.consortium?.name]
        .filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [items, filter, search, isLive]);

  const total = useMemo(() => visible.reduce((s, r) => s + Number(r.amount || 0), 0), [visible]);

  return (
    <div className="space-y-5 max-w-[1400px]">
      <h1 className="text-2xl font-bold text-[#1E1B4B] flex items-center gap-2">
        <span aria-hidden="true">🧾</span>
        증빙
      </h1>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <TypeFilterTabs value={filter} onChange={setFilter} counts={counts} />
        <div className="flex items-center gap-2 text-xs text-muted">
          <span>합계 <span className="text-text font-bold">{formatMoney(total)}</span></span>
        </div>
      </div>

      <div className="relative w-full sm:max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="파일명·연결 거래·프로젝트로 검색"
          className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {isPartner ? (
        <div className="rounded-xl bg-orange-50 border border-orange-200 px-4 py-3 text-xs text-orange-900">
          🔒 <strong>담당 컨소시엄의 증빙만</strong> 표시돼요.
        </div>
      ) : (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-900">
          💡 신규 증빙은 <strong>지출 등록 시 자동 첨부</strong>돼요. 이 페이지는 모든 영수증을 한곳에서 보고·검색하는 용도예요.
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-sm text-muted">
          <Loader2 size={18} className="animate-spin mr-2" />
          불러오는 중…
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          emoji="🧾"
          title={search.trim() || filter !== '전체' ? '조건에 맞는 영수증이 없어요.' : '아직 등록된 영수증이 없어요.'}
          description={!search.trim() && filter === '전체' ? '지출 페이지에서 영수증을 등록해 주세요.' : undefined}
          action={
            !search.trim() && filter === '전체' && !isPartner && (
              <Button variant="primary" leftIcon={<Plus size={14} />} onClick={() => { window.location.href = '/expense'; }}>
                지출 페이지로 이동
              </Button>
            )
          }
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs">
              <tr>
                <th className="text-left px-4 py-2.5 font-semibold whitespace-nowrap">등록일</th>
                <th className="text-left px-4 py-2.5 font-semibold">유형</th>
                <th className="text-left px-4 py-2.5 font-semibold">파일</th>
                <th className="text-left px-4 py-2.5 font-semibold">연결 거래</th>
                <th className="text-right px-4 py-2.5 font-semibold whitespace-nowrap">금액</th>
                <th className="text-center px-4 py-2.5 font-semibold whitespace-nowrap">열기</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-2.5 text-xs text-muted whitespace-nowrap">{formatDateKo(r.created_at)}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-700 font-medium">{r.receipt_type}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <FileIcon size={14} className="text-primary shrink-0" />
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-text truncate">{r.file_name}</div>
                        {(r.file_size != null || r.description) && (
                          <div className="text-[10px] text-muted truncate">
                            {fileSizeLabel(r.file_size)}
                            {r.file_size != null && r.description && ' · '}
                            {r.description}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted">
                    {r.expense?.description && <span>지출 · {r.expense.description}</span>}
                    {r.income?.description && <span>수입 · {r.income.description}</span>}
                    {!r.expense && !r.income && <span className="text-slate-400">미연결</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold text-text whitespace-nowrap">
                    {r.amount != null ? formatMoney(r.amount) : '–'}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <a href={r.file_url} target="_blank" rel="noreferrer noopener"
                      className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 hover:text-primary hover:bg-slate-50"
                      aria-label={`${r.file_name} 새 탭에서 열기`}>
                      <ExternalLink size={14} />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
