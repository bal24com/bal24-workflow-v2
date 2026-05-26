// bal24 v2 — STEP-STAFF-PORTAL-FEE-TAB (2026-05-26 박경수님)
// 강사 포털 · 자료 탭 [강사료] 서브탭 — payroll_expenses 에서 본인 지급 내역 조회.
// staff_pool_id 기준 매칭 (name fallback 불필요).

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Wallet, CheckCircle2, FileDown } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../contexts/ToastContext';
import { formatDateKo } from '../../../lib/utils';
import type {
  PayrollExpense, PayrollPaymentStatus, PayrollTaxRateType,
} from '../../../types/database';
import {
  buildFeeFormFromPayrollExpense, downloadFeeFormPDF, type PayrollExpenseLite,
} from '../../../utils/feeFormPDF';

interface Props {
  staffId: string;                       // staff_pool.id
  selectedProgramId?: string | null;     // 선택 프로그램 강조 표시용
}

// 박경수님 명세 status 6종 — DB enum 에 맞게 cancelled 적용 (rejected 가 아님)
const FEE_STATUS_MAP: Record<PayrollPaymentStatus, { label: string; color: string }> = {
  draft:      { label: '작성중',   color: 'bg-slate-100 text-slate-600 border-slate-200' },
  submitted:  { label: '검토중',   color: 'bg-blue-100 text-blue-700 border-blue-200' },
  received:   { label: '수신확인', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  processing: { label: '처리중',   color: 'bg-violet-100 text-violet-700 border-violet-200' },
  paid:       { label: '지급완료', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  cancelled:  { label: '취소',     color: 'bg-rose-100 text-rose-700 border-rose-200' },
};

function formatMoney(v: number | null | undefined): string {
  if (v == null) return '-';
  return `${Math.round(Number(v)).toLocaleString('ko-KR')}원`;
}

function taxLabel(t: PayrollTaxRateType): string {
  if (t === '면세' || t === '없음') return t;
  return `${t}%`;
}

interface FeeRow extends PayrollExpense {
  program?: { id: string; name: string; start_date: string | null; end_date: string | null } | null;
  project?: { id: string; name: string } | null;
}

const CARD_CLASS =
  'bg-white rounded-2xl border border-violet-100 shadow-[0_4px_16px_rgba(124,58,237,0.06)] p-5';

export default function StaffFeeSection({ staffId, selectedProgramId }: Props) {
  const toast = useToast();
  const [rows, setRows] = useState<FeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // 박경수님 2026-05-26 — 강사료 확인서 PDF 다운로드 상태
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  async function handleDownload(row: FeeRow) {
    setDownloadingId(row.id);
    try {
      const exp: PayrollExpenseLite = {
        id: row.id,
        program_id: row.program_id,
        payee_name: row.payee_name,
        subtotal: Number(row.subtotal ?? 0),
        tax_rate_type: row.tax_rate_type,
        tax_amount: Number(row.tax_amount ?? 0),
        net_amount: Number(row.net_amount ?? 0),
      };
      const data = await buildFeeFormFromPayrollExpense(exp, staffId);
      await downloadFeeFormPDF(data);
      toast.success('강사료 확인서 PDF 다운로드가 시작됐어요.');
    } catch (err) {
      console.error('[staff-portal/fee] PDF 실패:', err);
      toast.error('PDF 생성 중 오류가 발생했어요.');
    } finally {
      setDownloadingId(null);
    }
  }

  useEffect(() => {
    if (!staffId) return;
    let cancelled = false;
    setLoading(true);
    setErrorMsg(null);
    void (async () => {
      try {
        const { data, error } = await supabase
          .from('payroll_expenses')
          .select(`
            id, program_id, project_id, expense_type, payee_name,
            unit_price, quantity, subtotal,
            tax_rate_type, tax_amount, net_amount,
            payment_status, paid_at, memo, submitted_at, created_at,
            program:programs!payroll_expenses_program_id_fkey(id, name, start_date, end_date),
            project:projects!payroll_expenses_project_id_fkey(id, name)
          `)
          .eq('staff_pool_id', staffId)
          .is('deleted_at', null)
          .order('created_at', { ascending: false });
        if (cancelled) return;
        if (error) {
          const msg = (error.message ?? '').toLowerCase();
          console.warn('[staff-portal/fee] 조회 경고:', error.message, error.code);
          if (msg.includes('relation') || msg.includes('does not exist')
            || msg.includes('could not find') || msg.includes('schema cache')
            || error.code === 'PGRST205') {
            setErrorMsg('강사료 테이블이 아직 활성화되지 않았어요. 담당 PM에게 문의해 주세요.');
          } else if (msg.includes('row-level security') || msg.includes('permission denied')) {
            setErrorMsg('강사료 조회 권한이 없어요. 담당 PM에게 RLS 정책 적용을 요청해 주세요.');
          } else {
            setErrorMsg(`강사료 내역을 불러올 수 없어요: ${error.message ?? '알 수 없는 오류'}`);
          }
          setRows([]);
          return;
        }
        setRows(((data ?? []) as unknown) as FeeRow[]);
      } catch (err) {
        if (cancelled) return;
        const raw = err instanceof Error ? err.message : String(err);
        console.error('[staff-portal/fee] 예외:', raw);
        setErrorMsg(`예기치 못한 오류: ${raw}`);
        setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [staffId]);

  // 요약 — 총 강사료(subtotal) · 실지급 합계(net_amount) · 지급완료 건수
  const summary = useMemo(() => {
    let totalGross = 0;
    let totalNet = 0;
    let paidCount = 0;
    rows.forEach((r) => {
      totalGross += Number(r.subtotal ?? 0);
      totalNet += Number(r.net_amount ?? (Number(r.subtotal ?? 0) - Number(r.tax_amount ?? 0)));
      if (r.payment_status === 'paid') paidCount += 1;
    });
    return { totalGross, totalNet, paidCount, total: rows.length };
  }, [rows]);

  // 정렬 — 선택 프로그램 행을 맨 위로
  const sortedRows = useMemo(() => {
    if (!selectedProgramId) return rows;
    return [...rows].sort((a, b) => {
      const aHit = a.program_id === selectedProgramId ? 0 : 1;
      const bHit = b.program_id === selectedProgramId ? 0 : 1;
      return aHit - bHit;
    });
  }, [rows, selectedProgramId]);

  if (loading) {
    return (
      <div className={CARD_CLASS}>
        <div className="flex justify-center py-6">
          <Loader2 size={20} className="animate-spin text-violet-400" aria-hidden="true" />
        </div>
      </div>
    );
  }
  if (errorMsg) {
    return (
      <div className={CARD_CLASS}>
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-center">
          ⚠ {errorMsg}
        </p>
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className={CARD_CLASS}>
        <p className="text-sm text-slate-400 italic text-center py-4">
          💰 아직 등록된 강사료 내역이 없어요.<br />
          담당 PM에게 문의해 주세요.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 요약 카드 */}
      <section className={CARD_CLASS}>
        <h2 className="text-sm font-bold text-[#1E1B4B] mb-3 flex items-center gap-1.5">
          <Wallet size={14} className="text-violet-500" aria-hidden="true" />
          강사료 요약
        </h2>
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-violet-50/60 border border-violet-100 p-3 text-center">
            <p className="text-[11px] text-slate-500 mb-1">총 강사료</p>
            <p className="text-base font-bold text-violet-700 tabular-nums">{formatMoney(summary.totalGross)}</p>
          </div>
          <div className="rounded-xl bg-emerald-50/60 border border-emerald-100 p-3 text-center">
            <p className="text-[11px] text-slate-500 mb-1">실지급 합계</p>
            <p className="text-base font-bold text-emerald-700 tabular-nums">{formatMoney(summary.totalNet)}</p>
          </div>
          <div className="rounded-xl bg-amber-50/60 border border-amber-100 p-3 text-center">
            <p className="text-[11px] text-slate-500 mb-1">지급완료 건수</p>
            <p className="text-base font-bold text-amber-700 tabular-nums">
              {summary.paidCount}건 <span className="text-[10px] text-slate-400 font-normal">/ 전체 {summary.total}건</span>
            </p>
          </div>
        </div>
      </section>

      {/* 지급 내역 카드 목록 */}
      <ul className="space-y-2">
        {sortedRows.map((r) => {
          const isSelected = selectedProgramId && r.program_id === selectedProgramId;
          const statusInfo = FEE_STATUS_MAP[r.payment_status] ?? { label: r.payment_status, color: 'bg-slate-100 text-slate-600 border-slate-200' };
          const projectName = r.project?.name;
          const programName = r.program?.name;
          const gross = Number(r.subtotal ?? 0);
          const tax = Number(r.tax_amount ?? 0);
          const net = r.net_amount != null ? Number(r.net_amount) : gross - tax;
          return (
            <li key={r.id}
              className={`rounded-2xl border p-4 shadow-[0_4px_16px_rgba(124,58,237,0.06)] ${
                isSelected ? 'border-violet-400 bg-violet-50' : 'border-violet-100 bg-white'
              }`}>
              <div className="flex items-start justify-between gap-2 flex-wrap mb-2">
                <div className="min-w-0 flex-1">
                  {projectName && (
                    <p className="text-[11px] text-slate-500">{projectName}</p>
                  )}
                  <p className="text-sm font-bold text-[#1E1B4B] truncate">
                    {programName ?? '(프로그램 미지정)'}
                  </p>
                  {isSelected && (
                    <span className="inline-flex items-center gap-0.5 mt-1 px-1.5 py-0.5 rounded-full bg-violet-600 text-white text-[10px] font-bold">
                      <CheckCircle2 size={9} aria-hidden="true" /> 선택된 프로그램
                    </span>
                  )}
                </div>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusInfo.color}`}>
                  {statusInfo.label}
                </span>
              </div>

              <p className="text-[11px] text-slate-500 mb-2">
                지급유형 <span className="text-slate-700 font-semibold">{r.expense_type}</span>
              </p>

              <div className="rounded-xl bg-violet-50/40 border border-violet-100 p-3 text-sm">
                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-600">강사료</span>
                  <span className="font-semibold text-slate-800 tabular-nums">{formatMoney(gross)}</span>
                </div>
                {tax > 0 && (
                  <div className="flex items-center justify-between py-1">
                    <span className="text-slate-600">원천세 ({taxLabel(r.tax_rate_type)})</span>
                    <span className="text-rose-600 tabular-nums">-{formatMoney(tax)}</span>
                  </div>
                )}
                <div className="border-t border-violet-200 my-1.5" />
                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-700 font-semibold">실지급액</span>
                  <span className="font-bold text-violet-700 tabular-nums">{formatMoney(net)}</span>
                </div>
              </div>

              <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-500 flex-wrap">
                {r.paid_at && (
                  <span>지급일 <span className="font-semibold text-emerald-700 tabular-nums">{formatDateKo(r.paid_at)}</span></span>
                )}
                {!r.paid_at && r.payment_status !== 'draft' && (
                  <span>아직 지급 전</span>
                )}
                {r.memo && (
                  <span className="text-slate-400 truncate">메모 · {r.memo}</span>
                )}
              </div>

              {/* 박경수님 2026-05-26 — 강사 본인 강사료 확인서 PDF 다운로드 */}
              <button type="button"
                onClick={() => void handleDownload(r)}
                disabled={downloadingId === r.id}
                className="mt-3 w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-lg border border-violet-300 text-violet-700 text-xs font-semibold hover:bg-violet-50 disabled:opacity-50">
                {downloadingId === r.id
                  ? <Loader2 size={12} className="animate-spin" aria-hidden="true" />
                  : <FileDown size={12} aria-hidden="true" />}
                강사료 확인서 PDF 저장
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
