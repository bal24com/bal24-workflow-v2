// 박경수님 2026-05-29 STEP-CLEANUP Phase 2 — 기관 연관 사업 드로어.
// projects.client_id 매칭으로 해당 기관 사업 목록 표시 + 행 클릭 시 사업 상세 이동.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, X, FolderKanban, ArrowRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatMoney, formatDateKo } from '../../lib/utils';
import type { Client } from '../../types/database';

interface ProjectRow {
  id: string;
  name: string;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
}

interface Props {
  client: Client | null;
  onClose: () => void;
}

const STATUS_CLASS: Record<string, string> = {
  '제안':   'bg-slate-100 text-slate-600',
  '진행':   'bg-violet-100 text-violet-700',
  '정산':   'bg-orange-100 text-orange-700',
  '종료':   'bg-emerald-100 text-emerald-700',
  '계약':   'bg-blue-100 text-blue-700',
};

export default function ClientProjectsDrawer({ client, onClose }: Props) {
  const navigate = useNavigate();
  const [rows, setRows] = useState<ProjectRow[]>([]);
  const [contractAmounts, setContractAmounts] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!client) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, status, start_date, end_date')
        .eq('client_id', client.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      if (cancelled) return;
      if (error) {
        console.error('[ClientProjectsDrawer] projects 조회 실패:', error.message);
        setRows([]);
      } else {
        const projects = (data ?? []) as ProjectRow[];
        setRows(projects);
        // 사업별 계약금액 합계 — income_contracts 매칭.
        if (projects.length > 0) {
          const ids = projects.map((p) => p.id);
          const { data: cRows, error: cErr } = await supabase
            .from('income_contracts')
            .select('project_id, contract_amount')
            .in('project_id', ids);
          if (cErr) console.warn('[ClientProjectsDrawer] contracts 조회 경고:', cErr.message);
          const map = new Map<string, number>();
          ((cRows ?? []) as Array<{ project_id: string; contract_amount: number | null }>).forEach((r) => {
            const cur = map.get(r.project_id) ?? 0;
            map.set(r.project_id, cur + (Number(r.contract_amount) || 0));
          });
          if (!cancelled) setContractAmounts(map);
        }
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [client]);

  if (!client) return null;

  const totalAmount = Array.from(contractAmounts.values()).reduce((s, v) => s + v, 0);

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} aria-hidden="true" />
      <div className="relative ml-auto w-full max-w-2xl bg-white h-full overflow-y-auto">
        <header className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-lg font-bold text-[#1E1B4B] inline-flex items-center gap-2">
              <FolderKanban size={18} className="text-violet-600" aria-hidden="true" />
              {client.name} — 연관 사업
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">총 {rows.length}건 · 계약 합계 {formatMoney(totalAmount)}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="닫기"
            className="p-1.5 rounded hover:bg-slate-100">
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 size={20} className="animate-spin text-violet-400" aria-hidden="true" />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">
            연관된 사업이 없어요.
          </div>
        ) : (
          <ul className="p-4 space-y-2">
            {rows.map((p) => {
              const period = (p.start_date || p.end_date)
                ? `${formatDateKo(p.start_date) || '-'} ~ ${formatDateKo(p.end_date) || '-'}`
                : '기간 미지정';
              const statusCls = STATUS_CLASS[p.status ?? ''] ?? 'bg-slate-100 text-slate-600';
              const amount = contractAmounts.get(p.id) ?? 0;
              return (
                <li key={p.id}>
                  <button type="button"
                    onClick={() => { onClose(); navigate(`/projects/${p.id}`); }}
                    className="w-full text-left p-3 rounded-xl border border-violet-100 hover:border-violet-300 hover:bg-violet-50/40 transition-colors space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-[#1E1B4B] truncate flex-1">{p.name}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${statusCls}`}>
                        {p.status ?? '미지정'}
                      </span>
                      <ArrowRight size={14} className="text-slate-400 shrink-0" aria-hidden="true" />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 tabular-nums">{period}</span>
                      {amount > 0 && (
                        <span className="text-violet-700 font-semibold tabular-nums">{formatMoney(amount)}</span>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
