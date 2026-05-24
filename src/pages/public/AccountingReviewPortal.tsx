// 회계사무소 외부 검토 포털 — 비로그인 토큰 접근
// STEP-ACCOUNTING-ALL P4 (/accounting-review/:token)

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, CheckCircle2, AlertCircle, Send } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Button } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { formatDateKo, formatMoney } from '../../lib/utils';
// STEP-ACCOUNTING-FOLLOWUP — 외부 포털에서 주민번호 미노출 정책으로 maskIdNo import 제거.
import {
  fetchReviewByToken, upsertReviewItem, updateReviewStatus,
  REVIEW_STATUS_LABEL,
} from '../accounting-portal/accountingReviewUtils';
import type {
  AccountingReview, AccountingReviewItem, PayrollExpense,
} from '../../types/database';

interface ItemState {
  status: 'pending' | 'approved' | 'revision';
  note: string;
}

export default function AccountingReviewPortal() {
  const { token } = useParams<{ token: string }>();
  const [review, setReview] = useState<AccountingReview | null>(null);
  const [expenses, setExpenses] = useState<PayrollExpense[]>([]);
  const [itemStates, setItemStates] = useState<Record<string, ItemState>>({});
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [revisionOpen, setRevisionOpen] = useState<string | null>(null);
  const [revisionInput, setRevisionInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetchReviewByToken(token);
      if (!res) {
        setErrorMsg('만료된 링크이거나 존재하지 않는 검토 세션이에요.');
        return;
      }
      setReview(res.review);

      // 검토 항목 초기 상태 매핑
      const stateMap: Record<string, ItemState> = {};
      res.items.forEach((it: AccountingReviewItem) => {
        stateMap[it.payroll_expense_id] = {
          status: it.review_status,
          note: it.revision_note ?? '',
        };
      });
      setItemStates(stateMap);

      // 연결된 외주/급여 내역
      // STEP-ACCOUNTING-FOLLOWUP — 회계사무소 외부 포털에서 주민번호(payee_id_no) fetch 제거.
      // 박경수님 보안 강화 정책 (1차) — 외부 노출 컬럼만 명시적으로 select.
      if (res.review.project_ids.length > 0) {
        const { data, error } = await supabase
          .from('payroll_expenses').select(
            'id, project_id, expense_type, description, payee_name, ' +
            'bank_name, bank_account, unit_price, quantity, subtotal, ' +
            'tax_rate_type, tax_amount, net_amount, payment_status, ' +
            'paid_at, created_at',
          )
          .in('project_id', res.review.project_ids)
          .is('deleted_at', null)
          .order('paid_at', { ascending: false });
        if (error) {
          console.error('[AccountingReviewPortal] payroll 조회 실패:', error.message);
          setErrorMsg('외주/급여 내역을 불러오지 못했어요.');
          return;
        }
        setExpenses(((data as unknown) as PayrollExpense[] | null) ?? []);
      }

      // 처음 진입 시 reviewing 상태로 자동 전환
      if (res.review.status === 'pending') {
        await updateReviewStatus(res.review.id, 'reviewing');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      console.error('[AccountingReviewPortal] 로드 실패:', msg);
      setErrorMsg('포털을 불러오지 못했어요.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const summary = useMemo(() => {
    const total = expenses.length;
    const approved = Object.values(itemStates).filter((s) => s.status === 'approved').length;
    const revision = Object.values(itemStates).filter((s) => s.status === 'revision').length;
    const pending = total - approved - revision;
    return { total, approved, revision, pending };
  }, [expenses.length, itemStates]);

  async function handleApprove(expenseId: string) {
    if (!review) return;
    setSavingId(expenseId);
    const err = await upsertReviewItem(review.id, expenseId, 'approved', null);
    setSavingId(null);
    if (err) { setErrorMsg(err); return; }
    setItemStates((prev) => ({ ...prev, [expenseId]: { status: 'approved', note: '' } }));
  }

  async function handleRevisionSave(expenseId: string) {
    if (!review) return;
    if (!revisionInput.trim()) { setErrorMsg('수정 사유를 입력해 주세요.'); return; }
    setSavingId(expenseId);
    const err = await upsertReviewItem(review.id, expenseId, 'revision', revisionInput.trim());
    setSavingId(null);
    if (err) { setErrorMsg(err); return; }
    setItemStates((prev) => ({ ...prev, [expenseId]: { status: 'revision', note: revisionInput.trim() } }));
    setRevisionOpen(null);
    setRevisionInput('');
  }

  async function handleSubmitComplete() {
    if (!review) return;
    if (!window.confirm('검토를 완료 처리할까요? 이후에도 항목 수정은 가능합니다.')) return;
    setSubmitting(true);
    const err = await updateReviewStatus(review.id, 'completed');
    setSubmitting(false);
    if (err) { setErrorMsg(err); return; }
    void load();
  }

  function handleExcelExport() {
    const approvedExpenses = expenses.filter((e) => itemStates[e.id]?.status === 'approved');
    if (approvedExpenses.length === 0) {
      setErrorMsg('승인된 항목이 없어 다운로드할 수 없어요.');
      return;
    }
    const sheet = XLSX.utils.json_to_sheet(approvedExpenses.map((e) => ({
      성명: e.payee_name,
      내용: e.description ?? '',
      구분: e.expense_type,
      단가: e.unit_price,
      회수: e.quantity,
      합계: e.subtotal,
      세액구분: e.tax_rate_type,
      원천세: e.tax_amount,
      실지급: e.net_amount,
      은행명: e.bank_name ?? '',
      계좌번호: e.bank_account ?? '',
      지급일: e.paid_at ? formatDateKo(e.paid_at) : '',
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, '승인 내역');
    XLSX.writeFile(wb, `${review?.period_label ?? '회계검토'}_승인내역.xlsx`);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-violet-500" size={32} />
      </div>
    );
  }

  if (!review) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md rounded-2xl border border-rose-200 bg-white p-6 text-center shadow-lg">
          <AlertCircle className="mx-auto text-rose-500 mb-3" size={32} />
          <h1 className="text-lg font-bold text-text mb-1">접근할 수 없어요</h1>
          <p className="text-sm text-muted">{errorMsg ?? '링크가 만료됐거나 잘못됐어요.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-8 sm:py-10">
      <div className="max-w-[1200px] mx-auto">
        <header className="rounded-2xl bg-white border border-violet-100 p-5 shadow-sm mb-5">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-xl font-bold text-[#1E1B4B]">📋 회계사무소 검토 포털</h1>
            <span className="text-xs px-2 py-0.5 rounded-md bg-violet-50 text-violet-700 border border-violet-200 font-semibold">
              {REVIEW_STATUS_LABEL[review.status]}
            </span>
          </div>
          <div className="text-sm text-slate-700">{review.period_label}</div>
          <div className="text-xs text-muted mt-1">만료 {formatDateKo(review.expires_at)} 까지 검토 가능</div>
        </header>

        {/* 요약 KPI */}
        <div className="grid grid-cols-4 gap-3 mb-5">
          <KpiCard label="전체" value={`${summary.total}`} tone="slate" />
          <KpiCard label="승인" value={`${summary.approved}`} tone="emerald" />
          <KpiCard label="수정요청" value={`${summary.revision}`} tone="rose" />
          <KpiCard label="미검토" value={`${summary.pending}`} tone="amber" />
        </div>

        {errorMsg && (
          <div className="mb-4 rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-xs text-rose-700 flex items-center gap-2">
            <AlertCircle size={14} aria-hidden="true" />
            {errorMsg}
            <button type="button" onClick={() => setErrorMsg(null)} className="ml-auto text-rose-500 hover:underline">닫기</button>
          </div>
        )}

        {/* 목록 */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto mb-5">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs">
              <tr>
                <th className="text-left px-3 py-2.5 font-semibold">성명/내용</th>
                <th className="text-center px-3 py-2.5 font-semibold whitespace-nowrap">구분</th>
                <th className="text-right px-3 py-2.5 font-semibold whitespace-nowrap">세전</th>
                <th className="text-right px-3 py-2.5 font-semibold whitespace-nowrap">원천세</th>
                <th className="text-right px-3 py-2.5 font-semibold whitespace-nowrap">실지급</th>
                <th className="text-left px-3 py-2.5 font-semibold whitespace-nowrap">계좌</th>
                <th className="text-center px-3 py-2.5 font-semibold whitespace-nowrap">검토</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {expenses.map((e) => {
                const state = itemStates[e.id];
                const isApproved = state?.status === 'approved';
                const isRevision = state?.status === 'revision';
                const rowTone = isApproved ? 'bg-emerald-50/40' : isRevision ? 'bg-rose-50/40' : '';
                return (
                  <>
                    <tr key={e.id} className={rowTone}>
                      <td className="px-3 py-2">
                        <div className="text-sm font-medium text-text">{e.payee_name}</div>
                        <div className="text-[11px] text-muted truncate max-w-[260px]">
                          {e.description ?? ''}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center text-xs">{e.expense_type}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-xs">{formatMoney(e.subtotal)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-xs text-rose-600">{e.tax_amount > 0 ? `-${formatMoney(e.tax_amount)}` : '-'}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-sm font-bold text-violet-700">{formatMoney(e.net_amount)}</td>
                      <td className="px-3 py-2 text-xs text-muted">
                        {e.bank_name ?? '-'}
                        {e.bank_account && <div className="text-[10px]">{e.bank_account}</div>}
                      </td>
                      <td className="px-3 py-2 text-center whitespace-nowrap">
                        {isApproved && <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-100 text-emerald-700 text-[11px] font-bold"><CheckCircle2 size={11} />승인</span>}
                        {isRevision && <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-rose-100 text-rose-700 text-[11px] font-bold"><AlertCircle size={11} />수정요청</span>}
                        {!isApproved && !isRevision && (
                          <div className="inline-flex gap-1">
                            <button type="button" onClick={() => void handleApprove(e.id)} disabled={savingId === e.id} className="px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold hover:bg-emerald-100 disabled:opacity-50">✅승인</button>
                            <button type="button" onClick={() => { setRevisionOpen(e.id); setRevisionInput(state?.note ?? ''); }} className="px-2 py-1 rounded-md bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-bold hover:bg-rose-100">⚠️수정</button>
                          </div>
                        )}
                        {(isApproved || isRevision) && (
                          <button type="button" onClick={() => { setRevisionOpen(e.id); setRevisionInput(state?.note ?? ''); }} className="text-[11px] text-slate-500 underline ml-2">재검토</button>
                        )}
                      </td>
                    </tr>
                    {revisionOpen === e.id && (
                      <tr>
                        <td colSpan={7} className="px-3 py-3 bg-rose-50/30">
                          <div className="text-xs font-semibold text-rose-700 mb-1.5">수정 요청 사유</div>
                          <textarea
                            value={revisionInput}
                            onChange={(ev) => setRevisionInput(ev.target.value)}
                            rows={2}
                            className="w-full rounded-lg border border-rose-200 px-3 py-2 text-sm"
                            placeholder="예: 세액구분이 잘못됐어요. 3.3 → 8.8 변경 필요."
                          />
                          <div className="flex justify-end gap-2 mt-2">
                            <Button variant="ghost" size="sm" onClick={() => { setRevisionOpen(null); setRevisionInput(''); }}>닫기</Button>
                            <Button variant="primary" size="sm" onClick={() => void handleRevisionSave(e.id)} loading={savingId === e.id}>저장</Button>
                          </div>
                          {isRevision && (
                            <div className="mt-2 text-[11px] text-muted">기존 사유: {state?.note}</div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 하단 액션 */}
        <div className="flex flex-col sm:flex-row justify-end gap-2">
          <Button variant="outline" onClick={handleExcelExport}>승인 내역 Excel 다운로드</Button>
          <Button variant="primary" leftIcon={<Send size={14} />} onClick={() => void handleSubmitComplete()} loading={submitting}>
            검토 완료 제출
          </Button>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, tone }: { label: string; value: string; tone: 'slate' | 'emerald' | 'rose' | 'amber' }) {
  const colorMap: Record<string, string> = {
    slate: 'text-slate-700 border-slate-200',
    emerald: 'text-emerald-700 border-emerald-200 bg-emerald-50/30',
    rose: 'text-rose-700 border-rose-200 bg-rose-50/30',
    amber: 'text-amber-700 border-amber-200 bg-amber-50/30',
  };
  return (
    <div className={`rounded-2xl border bg-white p-3 ${colorMap[tone]}`}>
      <div className="text-[11px] text-slate-500 font-semibold">{label}</div>
      <div className="mt-0.5 text-2xl font-bold tabular-nums">{value}</div>
    </div>
  );
}
