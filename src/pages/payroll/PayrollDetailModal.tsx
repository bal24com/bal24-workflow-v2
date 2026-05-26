// 외주/급여 항목 상세 팝업 — 박경수님 + SkyClaw STEP-PAYROLL-DETAIL-COMMENT (2026-05-28)
// 정보 + 등록일/처리일 강조 + [수정] 버튼 + 댓글 섹션.
// 박경수님 환경 컬럼 매핑: sub_type→description / recipient_name→payee_name / status→payment_status

import { useEffect, useState } from 'react';
import { FileText, Pencil, CalendarPlus, CalendarCheck, Loader2 } from 'lucide-react';
import { Button, Modal } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { formatMoney } from '../../lib/utils';
import { maskIdNo } from './payrollUtils';
import PayrollCommentSection from './PayrollCommentSection';

interface DetailRow {
  id: string;
  expense_type: string;
  description: string | null;
  payee_name: string;
  payee_id_no: string | null;
  biz_reg_no: string | null;
  bank_name: string | null;
  bank_account: string | null;
  unit_price: number;
  quantity: number;
  subtotal: number;
  tax_amount: number;
  tax_rate_type: string;
  net_amount: number;
  payment_status: string;
  paid_at: string | null;
  memo: string | null;
  created_at: string;
}

interface Props {
  open: boolean;
  payrollId: string | null;
  onClose: () => void;
  onEdit: () => void;
}

export default function PayrollDetailModal({ open, payrollId, onClose, onEdit }: Props) {
  const [item, setItem] = useState<DetailRow | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !payrollId) return;
    setLoading(true);
    void supabase.from('payroll_expenses')
      .select('id, expense_type, description, payee_name, payee_id_no, biz_reg_no, bank_name, bank_account, unit_price, quantity, subtotal, tax_amount, tax_rate_type, net_amount, payment_status, paid_at, memo, created_at')
      .eq('id', payrollId).maybeSingle()
      .then(({ data, error }) => {
        if (error) console.error('[PayrollDetailModal] 조회 실패:', error.message);
        setItem((data as DetailRow | null) ?? null);
        setLoading(false);
      });
  }, [open, payrollId]);

  return (
    <Modal open={open} onClose={onClose} title="" size="lg" hideCloseButton>
      <div className="-m-1">
        <header className="flex items-center justify-between pb-3 border-b border-slate-200">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <FileText size={16} className="text-violet-600" aria-hidden="true" /> 지출 상세
          </h3>
          <div className="flex items-center gap-2">
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
            {/* 정보 그리드 */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <Row label="항목" value={item.expense_type} />
              <Row label="세항목" value={item.description ?? '-'} />
              <Row label="지급처" value={item.payee_name || '-'} />
              <Row label={item.biz_reg_no ? '사업자번호' : '주민번호'}
                value={item.biz_reg_no || (item.payee_id_no ? maskIdNo(item.payee_id_no) : '-')} />
              <Row label="단가" value={`${(item.unit_price ?? 0).toLocaleString()}원`} />
              <Row label="회수" value={`${item.quantity ?? 1}회`} />
              <Row label="세전 합계" value={formatMoney(item.subtotal ?? 0)} />
              <Row label={`세액 (${item.tax_rate_type})`} value={item.tax_amount ? formatMoney(item.tax_amount) : '-'} />
              <Row label="실지급" value={formatMoney(item.net_amount && item.net_amount > 0 ? item.net_amount : (item.subtotal ?? 0))} highlight />
              <Row label="상태" value={item.payment_status ?? '-'} />
              <Row label="은행" value={item.bank_name && item.bank_account ? `${item.bank_name} ${item.bank_account}` : '-'} />
              <Row label="메모" value={item.memo ?? '-'} />
            </div>

            {/* 등록일 / 처리일 (강조 박스 2개) */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                <p className="text-[11px] text-slate-500 mb-1 flex items-center gap-1">
                  <CalendarPlus size={12} aria-hidden="true" /> 등록일 (지급요청일)
                </p>
                <p className="text-sm font-semibold text-slate-800">
                  {item.created_at ? new Date(item.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }) : '-'}
                </p>
              </div>
              <div className={`rounded-xl p-3 border ${item.paid_at ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                <p className={`text-[11px] mb-1 flex items-center gap-1 ${item.paid_at ? 'text-emerald-600' : 'text-amber-600'}`}>
                  <CalendarCheck size={12} aria-hidden="true" /> 처리일 (입금일)
                </p>
                <p className={`text-sm font-semibold ${item.paid_at ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {item.paid_at
                    ? new Date(item.paid_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
                    : '미처리'}
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

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-[11px] text-slate-400 mb-0.5">{label}</p>
      <p className={`text-sm ${highlight ? 'font-bold text-violet-700' : 'text-slate-800'}`}>{value}</p>
    </div>
  );
}
