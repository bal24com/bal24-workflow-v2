// bal24 v2 — STEP-EXPERT-CRUD-FULL 관리자 휴지통
// clients / staff_pool 의 deleted_at 휴지통 조회 + 복원 + 영구 삭제 (30일 카운트다운)

import { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw, Trash2, Undo2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';
import { restoreRecord, permanentDelete, daysLeft, type SoftDeleteTable } from '../../lib/softDeleteUtils';
import { formatDateKo } from '../../lib/utils';

type Tab = 'clients' | 'staff_pool';

interface DeletedRow {
  id: string;
  name: string;
  meta: string;
  deleted_at: string;
}

export default function TrashTab() {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('clients');
  const [rows, setRows] = useState<DeletedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({ clients: 0, staff_pool: 0 });
  const [actingId, setActingId] = useState<string | null>(null);

  const fetchRows = useCallback(async (target: Tab) => {
    setLoading(true);
    const baseQ = (target === 'clients'
      ? supabase.from('clients').select('id, name, department, deleted_at')
      : supabase.from('staff_pool').select('id, name, organization, staff_type, deleted_at'))
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false });
    const { data, error } = await baseQ;
    if (error) {
      console.error(`[trash:${target}]`, error.message);
      toast.error('휴지통을 불러오지 못했어요.');
      setRows([]); setLoading(false); return;
    }
    type ClientRow = { id: string; name: string; department: string | null; deleted_at: string };
    type StaffRow  = { id: string; name: string; organization: string | null; staff_type: string | null; deleted_at: string };
    const next: DeletedRow[] = (data ?? []).map((r) => {
      if (target === 'clients') {
        const row = r as ClientRow;
        return { id: row.id, name: row.name ?? '?', meta: row.department ?? '부서 미지정', deleted_at: row.deleted_at };
      }
      const row = r as StaffRow;
      const meta = [row.organization, row.staff_type].filter(Boolean).join(' · ') || '소속 미지정';
      return { id: row.id, name: row.name ?? '?', meta, deleted_at: row.deleted_at };
    });
    setRows(next); setLoading(false);
  }, [toast]);

  const refreshCounts = useCallback(async () => {
    const [c, s] = await Promise.all([
      supabase.from('clients').select('id', { count: 'exact', head: true }).not('deleted_at', 'is', null),
      supabase.from('staff_pool').select('id', { count: 'exact', head: true }).not('deleted_at', 'is', null),
    ]);
    setCounts({ clients: c.count ?? 0, staff_pool: s.count ?? 0 });
  }, []);

  useEffect(() => { void fetchRows(tab); }, [tab, fetchRows]);
  useEffect(() => { void refreshCounts(); }, [refreshCounts, rows.length]);

  async function handleRestore(id: string, name: string) {
    setActingId(id);
    const err = await restoreRecord(tab as SoftDeleteTable, id);
    setActingId(null);
    if (err) { toast.error(err); return; }
    toast.success(`${name}을(를) 복원했어요.`);
    void fetchRows(tab); void refreshCounts();
  }

  async function handlePurge(id: string, name: string) {
    if (!window.confirm(`"${name}"을(를) 완전히 삭제합니다. 복구가 불가능합니다. 계속할까요?`)) return;
    setActingId(id);
    const err = await permanentDelete(tab as SoftDeleteTable, id);
    setActingId(null);
    if (err) { toast.error(err); return; }
    toast.success('영구 삭제했어요.');
    void fetchRows(tab); void refreshCounts();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="inline-flex rounded-xl border border-violet-100 bg-white p-1 shadow-sm">
          {([
            { key: 'clients' as Tab, label: `고객사 (${counts.clients})` },
            { key: 'staff_pool' as Tab, label: `전문가 (${counts.staff_pool})` },
          ]).map((t) => (
            <button key={t.key} type="button" onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 text-sm font-semibold rounded-lg transition ${
                tab === t.key ? 'bg-violet-600 text-white' : 'text-slate-600 hover:bg-violet-50'
              }`}>
              {t.label}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => { void fetchRows(tab); void refreshCounts(); }}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50">
          <RefreshCw size={12} /> 새로고침
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10 text-sm text-slate-400">
          <Loader2 size={16} className="animate-spin mr-2" /> 불러오는 중…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/40 py-10 text-center text-sm text-slate-400">
          휴지통이 비어 있어요.
        </div>
      ) : (
        <div className="rounded-2xl border border-violet-100 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-violet-50/40 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="text-left px-3 py-2 font-bold">이름</th>
                <th className="text-left px-3 py-2 font-bold">{tab === 'clients' ? '부서' : '소속·역할'}</th>
                <th className="text-left px-3 py-2 font-bold">삭제일</th>
                <th className="text-center px-3 py-2 font-bold">남은 일수</th>
                <th className="text-right px-3 py-2 font-bold">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => {
                const left = daysLeft(r.deleted_at);
                const expired = left === 0;
                return (
                  <tr key={r.id} className={expired ? 'bg-rose-50/60' : 'hover:bg-violet-50/30'}>
                    <td className="px-3 py-2 font-bold text-slate-700">{r.name}</td>
                    <td className="px-3 py-2 text-xs text-slate-500">{r.meta}</td>
                    <td className="px-3 py-2 text-xs text-slate-500">{formatDateKo(r.deleted_at)}</td>
                    <td className="px-3 py-2 text-center text-xs font-bold">
                      <span className={expired ? 'text-rose-600' : left <= 7 ? 'text-orange-600' : 'text-slate-500'}>
                        {expired ? '만료' : `D-${left}`}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button type="button" disabled={actingId === r.id}
                          onClick={() => void handleRestore(r.id, r.name)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 disabled:opacity-50">
                          <Undo2 size={11} /> 복원
                        </button>
                        <button type="button" disabled={actingId === r.id}
                          onClick={() => void handlePurge(r.id, r.name)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 disabled:opacity-50">
                          <Trash2 size={11} /> 영구삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
