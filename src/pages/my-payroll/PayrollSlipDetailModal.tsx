// 내 급여명세서 상세 + PDF 다운로드 — 박경수님 + SkyClaw STEP-PAYROLL-MYPAGE (2026-05-28)
// 박경수님 환경 jspdf + html2canvas 조합 (payrollDownload.ts 동일 패턴)

import { useRef, useState } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Download } from 'lucide-react';
import { Button, Modal } from '../../components/ui';
import { useToast } from '../../contexts/ToastContext';
import { formatMoney } from '../../lib/utils';

export interface MySlip {
  id: string;
  base_salary: number;
  national_pension: number; health_insurance: number; long_term_care: number;
  employment_insurance: number; income_tax: number; local_income_tax: number;
  health_adjustment: number; care_adjustment: number; other_deductions: number;
  total_payment: number; total_deduction: number; net_payment: number;
  register: { year: number; month: number; payment_date: string | null } | null;
}

interface Props {
  open: boolean;
  slip: MySlip | null;
  employeeName: string;
  employeeNo: string;
  onClose: () => void;
}

export default function PayrollSlipDetailModal({ open, slip, employeeName, employeeNo, onClose }: Props) {
  const toast = useToast();
  const printRef = useRef<HTMLDivElement | null>(null);
  const [downloading, setDownloading] = useState(false);

  async function handlePdfDownload() {
    if (!printRef.current || !slip) return;
    setDownloading(true);
    try {
      const canvas = await html2canvas(printRef.current, { scale: 2, backgroundColor: '#ffffff' });
      const pdf = new jsPDF('p', 'mm', 'a4');
      const w = pdf.internal.pageSize.getWidth();
      const h = (canvas.height * w) / canvas.width;
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, w, h);
      pdf.save(`급여명세서_${slip.register?.year}년_${slip.register?.month}월_${employeeName}.pdf`);
      toast.success('PDF 다운로드 완료');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      console.error('[PayrollSlipDetailModal] PDF 실패:', msg);
      toast.error('PDF 생성 실패');
    } finally { setDownloading(false); }
  }

  if (!slip) return null;
  const y = slip.register?.year; const m = slip.register?.month;

  return (
    <Modal open={open} onClose={onClose} title={`${y}년 ${m}월 급여명세서`} size="lg"
      footer={<>
        <Button variant="ghost" onClick={onClose}>닫기</Button>
        <Button variant="primary" leftIcon={<Download size={14} />} onClick={() => void handlePdfDownload()} loading={downloading}>PDF 다운로드</Button>
      </>}>
      <div ref={printRef} className="bg-white p-6 space-y-4">
        <header className="text-center border-b border-slate-200 pb-3">
          <h2 className="text-xl font-bold text-slate-900">{y}년 {m}월 급여명세서</h2>
          <p className="text-xs text-slate-600 mt-2">
            소속: 주식회사 밸런스닷 · 지급일: {slip.register?.payment_date ?? '미정'}
          </p>
          <p className="text-sm font-semibold text-slate-700 mt-1">
            성명: {employeeName} {employeeNo && `(사원번호 ${employeeNo})`}
          </p>
        </header>

        <section>
          <h3 className="text-sm font-bold text-slate-700 mb-2 pb-1 border-b border-slate-100">지급 내역</h3>
          <Row label="기본급" value={slip.base_salary} />
          <Row label="지급액계" value={slip.total_payment} bold />
        </section>

        <section>
          <h3 className="text-sm font-bold text-slate-700 mb-2 pb-1 border-b border-slate-100">공제 내역</h3>
          <Row label="국민연금" value={slip.national_pension} muted />
          <Row label="건강보험" value={slip.health_insurance} muted />
          <Row label="장기요양" value={slip.long_term_care} muted />
          <Row label="고용보험" value={slip.employment_insurance} muted />
          <Row label="소득세" value={slip.income_tax} muted />
          <Row label="지방소득세" value={slip.local_income_tax} muted />
          {slip.health_adjustment !== 0 && <Row label="건강보험정산" value={slip.health_adjustment} muted negative={slip.health_adjustment < 0} />}
          {slip.care_adjustment !== 0 && <Row label="요양보험정산" value={slip.care_adjustment} muted negative={slip.care_adjustment < 0} />}
          {slip.other_deductions > 0 && <Row label="기타 공제" value={slip.other_deductions} muted />}
          <Row label="공제액계" value={slip.total_deduction} bold rose />
        </section>

        <section className="border-t-2 border-slate-800 pt-3">
          <div className="flex items-center justify-between">
            <span className="text-base font-bold text-slate-800">차인지급액</span>
            <span className="text-2xl font-bold text-violet-700 tabular-nums">{formatMoney(slip.net_payment)}</span>
          </div>
        </section>
      </div>
    </Modal>
  );
}

interface RowProps { label: string; value: number; bold?: boolean; muted?: boolean; rose?: boolean; negative?: boolean }
function Row({ label, value, bold, muted, rose, negative }: RowProps) {
  const labelCls = muted ? 'text-xs text-slate-500' : bold ? 'text-sm font-bold text-slate-800' : 'text-sm text-slate-700';
  const valCls = `tabular-nums ${bold ? 'font-bold' : ''} ${rose ? 'text-rose-600' : negative ? 'text-emerald-600' : 'text-slate-800'}`;
  return (
    <div className="flex items-center justify-between py-1">
      <span className={labelCls}>{label}</span>
      <span className={`${muted ? 'text-xs' : 'text-sm'} ${valCls}`}>{value < 0 ? '-' : ''}{formatMoney(Math.abs(value))}</span>
    </div>
  );
}

