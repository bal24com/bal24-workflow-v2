// bal24 v2 — STEP-GRANT-LEDGER 지원금 탭 (요약 + 지출 + 원장)
// projectId, programId(optional)

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import {
  Loader2, Plus, Wallet, TrendingDown, RefreshCcw, FileCheck2, ExternalLink, Pencil,
} from 'lucide-react';
import { Button, Card, CardContent, Input } from '../../../components/ui';
import EmptyState from '../../../components/EmptyState';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { isMissingTableError } from '../../schedule/scheduleUtils';
import { formatDateKo, formatMoney } from '../../../lib/utils';
import {
  GRANT_LEDGER_TYPE_LABELS, GRANT_LEDGER_TYPE_TONE,
  GRANT_FUND_TYPE_LABELS, GRANT_FUND_TYPE_TONE,
  GRANT_EXP_STATUS_LABELS, GRANT_EXP_STATUS_TONE,
  type GrantLedger, type GrantLedgerType, type GrantExpenditure, type GrantSummary,
} from '../../../types/grantLedger';
import GrantExpenditureFormModal from './GrantExpenditureFormModal';

interface Props {
  projectId: string;
  programId?: string | null;
}

type SubTab = 'expenditures' | 'ledger';

export default function GrantLedgerTab({ projectId, programId }: Props) {
  const toast = useToast();
  const { user } = useAuth();
  const [subTab, setSubTab] = useState<SubTab>('expenditures');
  const [ledgers, setLedgers] = useState<GrantLedger[]>([]);
  const [expenditures, setExpenditures] = useState<GrantExpenditure[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);
  const [modalTarget, setModalTarget] = useState<GrantExpenditure | null | 'new'>(null);

  // 원장 인라인 폼
  const [ledgerType, setLedgerType] = useState<GrantLedgerType>('allocated');
  const [ledgerAmount, setLedgerAmount] = useState('0');
  const [ledgerDate, setLedgerDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [ledgerDescription, setLedgerDescription] = useState('');
  const [ledgerSubmitting, setLedgerSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setTableMissing(false);
    let query1 = supabase.from('grant_ledger').select('*').eq('project_id', projectId).order('ledger_date', { ascending: false });
    let query2 = supabase.from('grant_expenditures').select('*').eq('project_id', projectId).order('expenditure_date', { ascending: false });
    if (programId) {
      query1 = query1.eq('program_id', programId);
      query2 = query2.eq('program_id', programId);
    }
    const [l, e] = await Promise.all([query1, query2]);
    if (l.error || e.error) {
      const lMissing = l.error && isMissingTableError(l.error.message);
      const eMissing = e.error && isMissingTableError(e.error.message);
      if (lMissing || eMissing) {
        setTableMissing(true);
        setLedgers([]); setExpenditures([]);
        setLoading(false);
        return;
      }
      if (l.error) console.error('[grant-ledger] 원장 조회 실패:', l.error.message);
      if (e.error) console.error('[grant-ledger] 지출 조회 실패:', e.error.message);
    }
    setLedgers(((l.data ?? []) as GrantLedger[]));
    setExpenditures(((e.data ?? []) as GrantExpenditure[]));
    setLoading(false);
  }, [projectId, programId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await refresh();
      if (cancelled) return;
    })();
    return () => { cancelled = true; };
  }, [refresh]);

  // 요약 계산
  const summary = useMemo<GrantSummary>(() => {
    let allocated = 0, disbursed = 0, returned = 0;
    ledgers.forEach((l) => {
      const amt = Number(l.amount);
      if (l.ledger_type === 'allocated') allocated += amt;
      else if (l.ledger_type === 'disbursed') disbursed += amt;
      else if (l.ledger_type === 'returned') returned += amt;
    });
    let selfAmount = 0;
    let expDisbursed = 0;
    expenditures.forEach((x) => {
      const amt = Number(x.amount);
      if (x.fund_type === 'self') selfAmount += amt;
      else expDisbursed += amt;
    });
    // 지원금 집행은 원장(disbursed) + grant 지출 합산
    const totalDisbursed = disbursed + expDisbursed;
    const balance = allocated - totalDisbursed + returned;
    return { allocated, disbursed: totalDisbursed, returned, balance, selfAmount };
  }, [ledgers, expenditures]);

  const executionRate = summary.allocated > 0
    ? Math.round((summary.disbursed / summary.allocated) * 1000) / 10
    : 0;

  async function handleLedgerInsert(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const amt = Number(ledgerAmount.replace(/,/g, ''));
    if (Number.isNaN(amt) || amt <= 0) { toast.error('금액을 입력해 주세요.'); return; }
    setLedgerSubmitting(true);
    try {
      const { error } = await supabase.from('grant_ledger').insert({
        project_id: projectId,
        program_id: programId ?? null,
        ledger_type: ledgerType,
        amount: amt,
        ledger_date: ledgerDate,
        description: ledgerDescription.trim() || null,
        created_by: user?.id ?? null,
      });
      if (error) {
        console.error('[grant-ledger] 원장 등록 실패:', error.message);
        toast.error('원장 등록에 실패했어요.');
        return;
      }
      toast.success('원장 항목을 등록했어요.');
      setLedgerAmount('0'); setLedgerDescription('');
      await refresh();
    } finally {
      setLedgerSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-500">
        <Loader2 size={20} className="animate-spin text-violet-400 mr-2" aria-hidden="true" />
        불러오는 중…
      </div>
    );
  }

  if (tableMissing) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        <p className="font-bold">지원금 테이블이 아직 만들어지지 않았어요.</p>
        <p className="mt-1 text-xs">관리자가 <code>20260510_grant_ledger.sql</code> 마이그레이션을 실행하면 사용할 수 있어요.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* 요약 카드 */}
      <ul className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard label="배정액"   value={formatMoney(summary.allocated)} icon={<Wallet size={16} />} tone="violet" />
        <SummaryCard label="집행액"   value={formatMoney(summary.disbursed)} icon={<TrendingDown size={16} />} tone="cyan" sub={`집행율 ${executionRate}%`} />
        <SummaryCard label="자부담"   value={formatMoney(summary.selfAmount)} icon={<FileCheck2 size={16} />} tone="amber" />
        <SummaryCard label="잔액"     value={formatMoney(summary.balance)} icon={<RefreshCcw size={16} />} tone="emerald" />
      </ul>

      {/* 서브 탭 */}
      <nav role="tablist" className="flex items-center gap-1 border-b border-slate-200">
        {([
          ['expenditures', `지출 내역 (${expenditures.length})`],
          ['ledger',       `원장 이력 (${ledgers.length})`],
        ] as const).map(([key, label]) => {
          const active = subTab === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSubTab(key)}
              className={[
                'px-4 py-2 text-sm font-semibold border-b-2 transition-colors',
                active ? 'text-violet-700 border-violet-600' : 'text-slate-500 border-transparent hover:text-[#1E1B4B]',
              ].join(' ')}
            >
              {label}
            </button>
          );
        })}
      </nav>

      {subTab === 'expenditures' && (
        <ExpenditureSection
          items={expenditures}
          onAdd={() => setModalTarget('new')}
          onEdit={(x) => setModalTarget(x)}
        />
      )}

      {subTab === 'ledger' && (
        <LedgerSection
          items={ledgers}
          ledgerType={ledgerType} setLedgerType={setLedgerType}
          ledgerAmount={ledgerAmount} setLedgerAmount={setLedgerAmount}
          ledgerDate={ledgerDate} setLedgerDate={setLedgerDate}
          ledgerDescription={ledgerDescription} setLedgerDescription={setLedgerDescription}
          submitting={ledgerSubmitting}
          onSubmit={handleLedgerInsert}
        />
      )}

      {modalTarget !== null && (
        <GrantExpenditureFormModal
          open={true}
          projectId={projectId}
          programId={programId ?? null}
          expenditure={modalTarget === 'new' ? null : modalTarget}
          onClose={() => setModalTarget(null)}
          onSaved={() => { void refresh(); setModalTarget(null); }}
        />
      )}
    </div>
  );
}

// ─── 요약 카드 ──────────────────────────────────────────────
interface SummaryProps { label: string; value: string; icon: React.ReactNode; tone: 'violet'|'cyan'|'amber'|'emerald'; sub?: string }
const TONE_BG: Record<SummaryProps['tone'], string> = {
  violet: 'border-violet-100 bg-violet-50/40',
  cyan:   'border-cyan-100 bg-cyan-50/40',
  amber:  'border-amber-100 bg-amber-50/40',
  emerald:'border-emerald-100 bg-emerald-50/40',
};
const TONE_TEXT: Record<SummaryProps['tone'], string> = {
  violet: 'text-violet-700', cyan: 'text-cyan-700', amber: 'text-amber-700', emerald: 'text-emerald-700',
};
function SummaryCard({ label, value, icon, tone, sub }: SummaryProps) {
  return (
    <li>
      <Card className={`h-full ${TONE_BG[tone]}`}>
        <CardContent className="p-4 space-y-1">
          <div className={`inline-flex items-center gap-1 text-[11px] font-semibold ${TONE_TEXT[tone]}`}>
            {icon}{label}
          </div>
          <p className="text-base font-bold tabular-nums text-[#1E1B4B]">{value}</p>
          {sub && <p className="text-[11px] text-slate-500">{sub}</p>}
        </CardContent>
      </Card>
    </li>
  );
}

// ─── 지출 섹션 ──────────────────────────────────────────────
function ExpenditureSection({
  items, onAdd, onEdit,
}: { items: GrantExpenditure[]; onAdd: () => void; onEdit: (x: GrantExpenditure) => void }) {
  return (
    <section className="space-y-3">
      <header className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-[#1E1B4B]">지출 내역</h3>
        <Button variant="primary" size="sm" leftIcon={<Plus size={14} />} onClick={onAdd}>지출 등록</Button>
      </header>
      {items.length === 0 ? (
        <EmptyState emoji="🧾" title="등록된 지출이 없어요" description="지원금/자부담 지출을 등록해 보세요." />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs">
              <tr>
                <th className="text-left px-3 py-2.5 font-semibold whitespace-nowrap">지출일</th>
                <th className="text-left px-3 py-2.5 font-semibold">항목명</th>
                <th className="text-left px-3 py-2.5 font-semibold">주관기관</th>
                <th className="text-center px-3 py-2.5 font-semibold">구분</th>
                <th className="text-right px-3 py-2.5 font-semibold">금액</th>
                <th className="text-center px-3 py-2.5 font-semibold">서류</th>
                <th className="text-center px-3 py-2.5 font-semibold">검수</th>
                <th className="text-right px-3 py-2.5 font-semibold">액션</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((x) => (
                <tr key={x.id} className="hover:bg-violet-50/30 transition-colors">
                  <td className="px-3 py-2.5 text-xs tabular-nums whitespace-nowrap">{formatDateKo(x.expenditure_date)}</td>
                  <td className="px-3 py-2.5 font-medium text-slate-800">{x.item_name}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-600">{x.vendor_name ?? '-'}</td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${GRANT_FUND_TYPE_TONE[x.fund_type]}`}>
                      {GRANT_FUND_TYPE_LABELS[x.fund_type]}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{formatMoney(x.amount)}</td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${x.docs_submitted ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-orange-50 text-orange-700 border-orange-200'}`}>
                      {x.docs_submitted ? '서류완료' : '서류미완료'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${GRANT_EXP_STATUS_TONE[x.status]}`}>
                      {GRANT_EXP_STATUS_LABELS[x.status]}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right space-x-1">
                    {x.receipt_url && (
                      <a href={x.receipt_url} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-0.5 text-[11px] text-slate-500 hover:text-violet-700">
                        <ExternalLink size={11} />
                      </a>
                    )}
                    <button type="button" onClick={() => onEdit(x)}
                      className="inline-flex items-center gap-1 text-[11px] text-violet-700 hover:underline">
                      <Pencil size={11} /> 수정
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ─── 원장 섹션 ──────────────────────────────────────────────
interface LedgerSectionProps {
  items: GrantLedger[];
  ledgerType: GrantLedgerType; setLedgerType: (v: GrantLedgerType) => void;
  ledgerAmount: string; setLedgerAmount: (v: string) => void;
  ledgerDate: string; setLedgerDate: (v: string) => void;
  ledgerDescription: string; setLedgerDescription: (v: string) => void;
  submitting: boolean;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}
function LedgerSection(p: LedgerSectionProps) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-bold text-[#1E1B4B]">원장 이력</h3>
      {/* 인라인 등록 폼 */}
      <form onSubmit={p.onSubmit} className="rounded-xl border border-violet-100 bg-violet-50/30 p-3 grid grid-cols-1 sm:grid-cols-5 gap-2 items-end">
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-slate-600">유형</label>
          <select value={p.ledgerType} onChange={(e) => p.setLedgerType(e.target.value as GrantLedgerType)} disabled={p.submitting}
            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs">
            {(['allocated','disbursed','returned','adjusted'] as const).map((t) => (
              <option key={t} value={t}>{GRANT_LEDGER_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>
        <Input type="date" label="날짜" value={p.ledgerDate} onChange={(e) => p.setLedgerDate(e.target.value)} disabled={p.submitting} />
        <Input type="number" label="금액" inputMode="numeric" value={p.ledgerAmount} onChange={(e) => p.setLedgerAmount(e.target.value)} disabled={p.submitting} />
        <Input label="설명" value={p.ledgerDescription} onChange={(e) => p.setLedgerDescription(e.target.value)} disabled={p.submitting} placeholder="예) 1차 지원금 입금" />
        <Button type="submit" variant="primary" loading={p.submitting} leftIcon={<Plus size={14} />}>등록</Button>
      </form>

      {p.items.length === 0 ? (
        <EmptyState emoji="📋" title="원장 이력이 없어요" />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs">
              <tr>
                <th className="text-left px-3 py-2.5 font-semibold whitespace-nowrap">날짜</th>
                <th className="text-center px-3 py-2.5 font-semibold">유형</th>
                <th className="text-right px-3 py-2.5 font-semibold">금액</th>
                <th className="text-left px-3 py-2.5 font-semibold">설명</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {p.items.map((l) => (
                <tr key={l.id}>
                  <td className="px-3 py-2.5 text-xs tabular-nums whitespace-nowrap">{formatDateKo(l.ledger_date)}</td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${GRANT_LEDGER_TYPE_TONE[l.ledger_type]}`}>
                      {GRANT_LEDGER_TYPE_LABELS[l.ledger_type]}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{formatMoney(l.amount)}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-600">{l.description ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
