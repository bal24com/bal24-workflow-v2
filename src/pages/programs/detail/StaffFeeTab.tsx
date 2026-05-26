// bal24 v2 — STEP-STAFF-FEE-TAX 지급 기준 탭
// 합계 요약 3 카드 + 강사·활동 카드 그리드 + 상태 변경 + 등록/수정 모달.

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Loader2, Plus, Pencil, Trash2, Receipt, Users2, AlertCircle, ExternalLink, FileDown, Download,
} from 'lucide-react';
import { Button, Card, CardContent } from '../../../components/ui';
import EmptyState from '../../../components/EmptyState';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';
import {
  fetchStaffFees, updatePaymentStatus, deleteStaffFee,
  markStaffFeeAsPaid, cancelStaffFeePayment,
  convertStaffFeesToPayroll, // STEP-ACCOUNTING-FOLLOWUP7-Phase2.5
} from './staffFeeUtils';
import {
  FEE_TYPE_LABEL, TAX_TYPE_LABEL, PAYMENT_STATUS_BADGE, PAYMENT_STATUS_FLOW,
} from '../../../types/staffFee';
import type { StaffFee } from '../../../types/staffFee';
import StaffFeeFormModal from './StaffFeeFormModal';
import { buildFeeFormFromStaffFee } from '../../../utils/feeFormPDF';
import { useFeeDownload } from '../../../hooks/useFeeDownload';

interface Props {
  programId: string;
}

interface SummaryCardProps {
  label: string;
  value: string;
  emoji: string;
  highlight?: boolean;
}

function SummaryCard({ label, value, emoji, highlight }: SummaryCardProps) {
  return (
    <Card className={`h-full ${highlight ? 'border-rose-200 bg-rose-50/50' : ''}`}>
      <CardContent className="p-4 space-y-1">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
          <span aria-hidden="true">{emoji}</span>
          {label}
        </div>
        <p className={`text-lg font-bold tabular-nums ${highlight ? 'text-rose-600' : 'text-[#1E1B4B]'}`}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

export default function StaffFeeTab({ programId }: Props) {
  const toast = useToast();
  const [fees, setFees] = useState<StaffFee[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalTarget, setModalTarget] = useState<StaffFee | null | 'new'>(null);
  // 박경수님 2026-05-26 — 강사료 PDF 다운로드 (공용 훅)
  const { downloadingId, batchProgress, downloadOne, downloadMany } = useFeeDownload();
  const { user } = useAuth();

  const refresh = useCallback(async () => {
    setLoading(true);
    const list = await fetchStaffFees(programId);
    setFees(list);
    setLoading(false);
  }, [programId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await refresh();
      if (cancelled) return;
    })();
    return () => { cancelled = true; };
  }, [refresh]);

  // 요약
  const summary = useMemo(() => {
    const targets = new Set<string>();
    let gross = 0;
    let net = 0;
    let pending = 0;
    fees.forEach((f) => {
      const key = f.expert_id ?? f.profile_id ?? f.id;
      targets.add(key);
      gross += f.gross_amount;
      net += f.net_amount;
      if (f.payment_status === '미지급') pending += 1;
    });
    return {
      targetCount: targets.size,
      grossSum: gross,
      netSum: net,
      pendingCount: pending,
      totalCount: fees.length,
    };
  }, [fees]);

  // STEP-STAFF-FEE-EXPENSES-LINK — 상태 변경 분기 처리
  // 신고완료 → 지급완료: expenses 자동 생성 (markStaffFeeAsPaid)
  // 지급완료 → 미지급: expenses 삭제 + 롤백 (cancelStaffFeePayment)
  // 그 외: 단순 상태 변경 (updatePaymentStatus)
  async function handleStatusFlow(fee: StaffFee) {
    const idx = PAYMENT_STATUS_FLOW.indexOf(fee.payment_status);
    const next = PAYMENT_STATUS_FLOW[(idx + 1) % PAYMENT_STATUS_FLOW.length];

    // 지급완료 진입 → expenses 자동 생성
    if (next === '지급완료') {
      if (!window.confirm('지급 완료로 변경하면 지출 내역이 자동 등록돼요. 진행할까요?')) return;
      const result = await markStaffFeeAsPaid(fee, user?.id ?? null);
      if (!result.success) {
        toast.error(result.error ?? '지급 처리에 실패했어요.');
        return;
      }
      toast.success('지급 완료 처리됐어요. 지출 내역이 자동 등록됐어요.');
      await refresh();
      return;
    }

    // 지급완료 → 미지급 (사이클 회귀) → expenses 삭제 + 롤백
    if (fee.payment_status === '지급완료' && next === '미지급') {
      if (!window.confirm('지급을 취소하면 연동된 지출 내역도 삭제돼요. 진행할까요?')) return;
      const result = await cancelStaffFeePayment(fee);
      if (!result.success) {
        toast.error(result.error ?? '지급 취소에 실패했어요.');
        return;
      }
      toast.success('지급을 취소하고 지출 내역을 삭제했어요.');
      await refresh();
      return;
    }

    // 그 외: 단순 상태 변경
    const ok = await updatePaymentStatus(fee.id, next);
    if (!ok) {
      toast.error('상태 변경에 실패했어요.');
      return;
    }
    toast.success(`상태를 '${next}' 로 변경했어요.`);
    await refresh();
  }

  async function handleDelete(fee: StaffFee) {
    if (!window.confirm(`"${fee.expert_name ?? fee.profile_name ?? '항목'}"의 지급 기준을 삭제할까요?`)) return;
    const ok = await deleteStaffFee(fee.id);
    if (!ok) {
      toast.error('삭제에 실패했어요.');
      return;
    }
    toast.success('지급 기준을 삭제했어요.');
    await refresh();
  }

  // 박경수님 2026-05-26 — 강사료 확인서 PDF (공용 훅 사용)
  async function handleDownloadOne(fee: StaffFee) {
    await downloadOne(fee.id, () => buildFeeFormFromStaffFee(fee, programId));
  }

  async function handleDownloadAll() {
    if (fees.length === 0) { toast.error('내려받을 강사료 항목이 없어요.'); return; }
    if (!window.confirm(`강사 ${fees.length}명의 강사료 확인서를 순차 다운로드할까요?`)) return;
    await downloadMany(fees.map((f) => ({
      id: f.id, dataBuilder: () => buildFeeFormFromStaffFee(f, programId),
    })));
  }

  // STEP-ACCOUNTING-FOLLOWUP7-Phase2.5 — 외주/급여(payroll_expenses)로 일괄 변환
  async function handleConvertToPayroll() {
    if (fees.length === 0) { toast.error('변환할 항목이 없어요.'); return; }
    if (!window.confirm(`강사료 ${fees.length}건을 외주/급여로 일괄 생성할까요? 외주/급여 페이지에서 실집행 정보(지급일·계좌·증빙) 를 채워나가시면 돼요.`)) return;
    const res = await convertStaffFeesToPayroll(fees, programId);
    if (res.error) { toast.error(res.error); return; }
    toast.success(`${res.inserted}건을 외주/급여로 변환했어요.`);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-500">
        <Loader2 size={20} className="animate-spin text-violet-400 mr-2" aria-hidden="true" />
        <span className="text-sm">불러오는 중…</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <header className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-base font-bold text-[#1E1B4B] flex items-center gap-1.5">
          <Receipt size={18} className="text-violet-600" aria-hidden="true" />
          강사료 지급 기준
        </h2>
        <div className="flex items-center gap-2 flex-wrap">
          {/* 박경수님 2026-05-26 — 강사료 확인서 일괄 다운로드 */}
          {fees.length > 0 && (
            <Button variant="outline" size="sm"
              leftIcon={batchProgress ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              disabled={!!batchProgress}
              onClick={() => void handleDownloadAll()}>
              {batchProgress
                ? `다운로드 중 (${batchProgress.current}/${batchProgress.total})`
                : `강사료 일괄 다운로드 (${fees.length}명)`}
            </Button>
          )}
          {/* STEP-ACCOUNTING-FOLLOWUP7-Phase2.5 — 강사료 → 외주/급여 일괄 변환 */}
          {fees.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => void handleConvertToPayroll()}>
              외주/급여로 변환 ({fees.length})
            </Button>
          )}
          <Button variant="primary" size="sm" leftIcon={<Plus size={14} />} onClick={() => setModalTarget('new')}>
            지급 기준 추가
          </Button>
        </div>
      </header>

      {/* 요약 카드 3 */}
      <ul className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <li><SummaryCard label="지급 대상" value={`${summary.targetCount}명`} emoji="👥" /></li>
        <li><SummaryCard label="지급 합계" value={`${summary.grossSum.toLocaleString()}원`} emoji="💰" /></li>
        <li><SummaryCard label="실수령 합계" value={`${summary.netSum.toLocaleString()}원`} emoji="💳" /></li>
        <li><SummaryCard label="미지급" value={`${summary.pendingCount}건`} emoji="⏳" highlight={summary.pendingCount > 0} /></li>
      </ul>

      {/* 본문 */}
      {fees.length === 0 ? (
        <EmptyState
          emoji="🧾"
          title="등록된 지급 기준이 없어요"
          description="우측 상단 '지급 기준 추가' 버튼으로 등록해 보세요."
        />
      ) : (
        <ul className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {fees.map((f) => {
            const name = f.expert_name ?? f.profile_name ?? '이름 미상';
            const isInternal = !!f.profile_id;
            const badge = PAYMENT_STATUS_BADGE[f.payment_status];
            return (
              <li key={f.id}>
                <Card className="h-full hover:border-violet-300 transition-colors">
                  <CardContent className="p-4 space-y-3">
                    {/* 상단 — 이름 + 활동 */}
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                          <Users2 size={11} aria-hidden="true" />
                          {isInternal ? '내부 직원' : '외부 전문가'} · {FEE_TYPE_LABEL[f.fee_type]}
                        </div>
                        <p className="text-sm font-bold text-[#1E1B4B] truncate">{name}</p>
                        {f.description && (
                          <p className="text-[11px] text-slate-500 mt-0.5 truncate">{f.description}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleStatusFlow(f)}
                        title="클릭하여 다음 상태로 변경"
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${badge.color} hover:opacity-80 transition-opacity`}
                      >
                        {badge.label}
                      </button>
                    </div>

                    {/* 금액 */}
                    <div className="rounded-xl bg-violet-50/60 p-2.5 text-xs space-y-1">
                      {f.input_mode === 'unit' ? (
                        <div className="flex justify-between text-slate-600">
                          <span>단가 × 회수</span>
                          <span className="tabular-nums">
                            {Number(f.unit_price).toLocaleString()}원 × {Number(f.quantity)}회
                          </span>
                        </div>
                      ) : (
                        <div className="flex justify-between text-slate-600">
                          <span>입력 방식</span>
                          <span>총액 직접</span>
                        </div>
                      )}
                      <div className="flex justify-between text-slate-700">
                        <span>합계</span>
                        <span className="tabular-nums font-semibold">{f.gross_amount.toLocaleString()}원</span>
                      </div>
                      <div className="flex justify-between text-rose-600">
                        <span>원천세 ({TAX_TYPE_LABEL[f.tax_type]})</span>
                        <span className="tabular-nums">▲ {f.tax_amount.toLocaleString()}원</span>
                      </div>
                      <div className="flex justify-between border-t border-violet-200 pt-1 font-bold text-violet-700">
                        <span>실수령</span>
                        <span className="tabular-nums">{f.net_amount.toLocaleString()}원</span>
                      </div>
                      {f.paid_at && (
                        <p className="text-[10px] text-slate-400 text-right">지급일 {f.paid_at}</p>
                      )}
                      {f.expense_id && (
                        <a
                          href="/expense"
                          className="inline-flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full hover:bg-emerald-100 transition-colors"
                          title="지출 페이지로 이동"
                        >
                          <ExternalLink size={10} aria-hidden="true" />
                          지출 연동됨
                        </a>
                      )}
                    </div>

                    {/* 액션 */}
                    <div className="flex items-center gap-1 justify-end">
                      {/* 박경수님 2026-05-26 — 강사료 확인서 PDF */}
                      <button
                        type="button"
                        onClick={() => void handleDownloadOne(f)}
                        disabled={downloadingId === f.id || !!batchProgress}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-violet-700 border border-violet-200 hover:bg-violet-50 disabled:opacity-50"
                      >
                        {downloadingId === f.id
                          ? <Loader2 size={12} className="animate-spin" aria-hidden="true" />
                          : <FileDown size={12} aria-hidden="true" />}
                        강사료 PDF
                      </button>
                      <button
                        type="button"
                        onClick={() => setModalTarget(f)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-slate-600 hover:bg-slate-100"
                      >
                        <Pencil size={12} aria-hidden="true" />
                        수정
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(f)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-rose-500 hover:bg-rose-50"
                      >
                        <Trash2 size={12} aria-hidden="true" />
                        삭제
                      </button>
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {/* 합계 행 (총건수≥1일 때만) */}
      {fees.length > 0 && (
        <div className="rounded-xl border border-violet-100 bg-white p-4 text-sm">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 inline-flex items-center gap-1">
            <AlertCircle size={11} aria-hidden="true" />
            합계 (총 {summary.totalCount}건)
          </p>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <p className="text-slate-500">지급 합계</p>
              <p className="font-bold tabular-nums text-[#1E1B4B]">{summary.grossSum.toLocaleString()}원</p>
            </div>
            <div>
              <p className="text-slate-500">원천세 합계</p>
              <p className="font-bold tabular-nums text-rose-600">
                {(summary.grossSum - summary.netSum).toLocaleString()}원
              </p>
            </div>
            <div>
              <p className="text-slate-500">실수령 합계</p>
              <p className="font-bold tabular-nums text-violet-700">{summary.netSum.toLocaleString()}원</p>
            </div>
          </div>
        </div>
      )}

      {/* 모달 */}
      {modalTarget !== null && (
        <StaffFeeFormModal
          open={true}
          programId={programId}
          fee={modalTarget === 'new' ? null : modalTarget}
          onClose={() => setModalTarget(null)}
          onSaved={() => { void refresh(); }}
        />
      )}
    </div>
  );
}

