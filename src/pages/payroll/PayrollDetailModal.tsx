// 외주/급여 항목 상세 팝업 — 박경수님 + SkyClaw STEP-PAYROLL-LIST-REDESIGN PART C (2026-05-28)
// 주민번호·계좌 마스킹 + 🔓 보기 (admin/finance) · 날짜 YY/MM/DD · 상태 한글 라벨 · 다운로드 버튼

import { useEffect, useState } from 'react';
import { FileText, Pencil, CalendarPlus, CalendarCheck, Loader2, Eye, EyeOff, Download } from 'lucide-react';
import { Button, Modal } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { formatMoney } from '../../lib/utils';
import { maskIdNo, PAYROLL_STATUS_LABEL, PAYROLL_STATUS_STYLE } from './payrollUtils';
import { useUserProfile } from '../../hooks/useUserProfile';
import type { PayrollPaymentStatus } from '../../types/database';
import PayrollCommentSection from './PayrollCommentSection';

interface DetailRow {
  id: string; expense_type: string; description: string | null; payee_name: string;
  payee_id_no: string | null; biz_reg_no: string | null;
  bank_name: string | null; bank_account: string | null;
  unit_price: number; quantity: number; subtotal: number;
  tax_amount: number; tax_rate_type: string; net_amount: number;
  payment_status: string; paid_at: string | null; memo: string | null; created_at: string;
}

interface Props {
  open: boolean;
  payrollId: string | null;
  onClose: () => void;
  onEdit: () => void;
  onDownload?: () => void; // 박경수님 + SkyClaw 2026-05-28 — PDF/Excel 다운로드 (선택)
}

/** YY/MM/DD 짧은 날짜 — 박경수님 + SkyClaw 2026-05-28 */
function fmtShortDate(s: string | null | undefined): string {
  if (!s) return '-';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '-';
  const yy = String(d.getFullYear() % 100).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}/${mm}/${dd}`;
}

function maskAccount(acc: string | null): string {
  if (!acc) return '-';
  const digits = acc.replace(/[^0-9]/g, '');
  if (digits.length < 8) return '***';
  return `${digits.slice(0, 3)}-****-${digits.slice(-4)}`;
}

export default function PayrollDetailModal({ open, payrollId, onClose, onEdit, onDownload }: Props) {
  const { isFinance } = useUserProfile();
  const [item, setItem] = useState<DetailRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [showResident, setShowResident] = useState(false);
  const [showAccount, setShowAccount] = useState(false);

  useEffect(() => {
    if (!open || !payrollId) return;
    setLoading(true);
    setShowResident(false); setShowAccount(false);
    void supabase.from('payroll_expenses')
      .select('id, expense_type, description, payee_name, payee_id_no, biz_reg_no, bank_name, bank_account, unit_price, quantity, subtotal, tax_amount, tax_rate_type, net_amount, payment_status, paid_at, memo, created_at')
      .eq('id', payrollId).maybeSingle()
      .then(({ data, error }) => {
        if (error) console.error('[PayrollDetailModal] 조회 실패:', error.message);
        setItem((data as DetailRow | null) ?? null);
        setLoading(false);
      });
  }, [open, payrollId]);

  const statusKey = (item?.payment_status as PayrollPaymentStatus) ?? 'draft';
  const statusLabel = PAYROLL_STATUS_LABEL[statusKey] ?? item?.payment_status ?? '-';
  const statusStyle = PAYROLL_STATUS_STYLE[statusKey] ?? PAYROLL_STATUS_STYLE.draft;

  return (
    <Modal open={open} onClose={onClose} title="" size="lg" hideCloseButton>
      <div className="-m-1">
        <header className="flex items-center justify-between pb-3 border-b border-slate-200">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <FileText size={16} className="text-violet-600" aria-hidden="true" /> 지출 상세
            {item && <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-semibold ml-2 ${statusStyle}`}>{statusLabel}</span>}
          </h3>
          <div className="flex items-center gap-2">
            {onDownload && (
              <Button variant="outline" size="sm" leftIcon={<Download size={12} />} onClick={onDownload}>다운로드</Button>
            )}
            <Button variant="outline" size="sm" leftIcon={<Pencil size={12} />} onClick={onEdit}>수정</Button>
            <button type="button" onClick={onClose} aria-label="닫기"
              className="text-slate-400 hover:text-slate-700 rounded-lg p-1">✕</button>
          </div>
        </header>

        {loading && (
          <div className="flex items-center justify-center py-10 text-sm text-slate-400">
            <Loader2 size={14} className="animate-spin mr-1.5" aria-hidden="true" /> 불러오는 중…
          </div>
        )}

        {!loading && item && (
          <div className="pt-4 space-y-4">
            {/* 정보 그리드 — STEP-PAYROLL-UI-FIX (2026-05-28): null/empty 필드 행 숨김 */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <Row label="항목" value={item.expense_type} />
              {item.payee_name && <Row label="지급처" value={item.payee_name} />}
              {item.description && <Row label="세부항목" value={item.description} />}
              {item.biz_reg_no && <Row label="사업자번호" value={item.biz_reg_no} />}
              {!item.biz_reg_no && item.payee_id_no && (
                <div>
                  <p className="text-[11px] text-slate-400 mb-0.5">주민번호</p>
                  <p className="text-sm text-slate-800 font-mono inline-flex items-center gap-1.5">
                    {showResident && isFinance ? item.payee_id_no : maskIdNo(item.payee_id_no)}
                    {isFinance && (
                      <button type="button" onClick={() => setShowResident((v) => !v)}
                        aria-label={showResident ? '주민번호 가리기' : '주민번호 보기'}
                        className="text-violet-500 hover:text-violet-700">
                        {showResident ? <EyeOff size={12} /> : <Eye size={12} />}
                      </button>
                    )}
                  </p>
                </div>
              )}
              <Row label="단가" value={`${(item.unit_price ?? 0).toLocaleString()}원`} />
              {item.bank_account && (
                <div>
                  <p className="text-[11px] text-slate-400 mb-0.5">계좌번호</p>
                  <p className="text-sm text-slate-800 font-mono inline-flex items-center gap-1.5">
                    {showAccount && isFinance ? item.bank_account : maskAccount(item.bank_account)}
                    {isFinance && (
                      <button type="button" onClick={() => setShowAccount((v) => !v)}
                        aria-label={showAccount ? '계좌 가리기' : '계좌 보기'}
                        className="text-violet-500 hover:text-violet-700">
                        {showAccount ? <EyeOff size={12} /> : <Eye size={12} />}
                      </button>
                    )}
                  </p>
                </div>
              )}
              <Row label="회수" value={`${item.quantity ?? 1}회`} />
              {item.bank_name && <Row label="은행" value={item.bank_name} />}
              <Row label="세전 합계" value={formatMoney(item.subtotal ?? 0)} />
              {item.tax_amount > 0 && <Row label={`세액 (${item.tax_rate_type})`} value={formatMoney(item.tax_amount)} />}
              <Row label="실지급" value={formatMoney(item.net_amount && item.net_amount > 0 ? item.net_amount : (item.subtotal ?? 0))} />
              {item.paid_at && <Row label="지급일" value={fmtShortDate(item.paid_at)} />}
              {item.memo && <Row label="메모" value={item.memo} />}
            </div>

            {/* 등록일 / 처리일 (강조 박스 2개) — 짧은 날짜 형식 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                <p className="text-[11px] text-slate-500 mb-1 flex items-center gap-1">
                  <CalendarPlus size={12} aria-hidden="true" /> 등록일 (지급요청일)
                </p>
                <p className="text-sm font-semibold text-slate-800 tabular-nums">{fmtShortDate(item.created_at)}</p>
              </div>
              <div className={`rounded-xl p-3 border ${item.paid_at ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                <p className={`text-[11px] mb-1 flex items-center gap-1 ${item.paid_at ? 'text-emerald-600' : 'text-amber-600'}`}>
                  <CalendarCheck size={12} aria-hidden="true" /> 처리일 (입금일)
                </p>
                <p className={`text-sm font-semibold tabular-nums ${item.paid_at ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {item.paid_at ? fmtShortDate(item.paid_at) : '미처리'}
                </p>
              </div>
            </div>

            {/* 댓글 섹션 */}
            <PayrollCommentSection payrollId={item.id} />
          </div>
        )}
      </div>
    </Modal>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-slate-400 mb-0.5">{label}</p>
      <p className="text-sm text-slate-800">{value}</p>
    </div>
  );
}
