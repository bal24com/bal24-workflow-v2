// 외주/급여 엑셀·PDF 다운로드 (박경수님 + SkyClaw 요청 / V-1 분리)

import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { PayrollRow } from './payrollUtils';

const today = () => new Date().toISOString().slice(0, 10);

function taxLabel(r: PayrollRow): string {
  if (r.tax_rate_type === '10') return '부가세 10%';
  if (r.tax_rate_type === '3.3') return '원천세 3.3%';
  if (r.tax_rate_type === '8.8') return '원천세 8.8%';
  if (r.tax_rate_type === '면세') return '면세';
  return '-';
}

export function downloadPayrollExcel(rows: PayrollRow[]): void {
  const xlsxRows = rows.map((r) => ({
    프로젝트: r.project?.name ?? '',
    항목: r.expense_type ?? '',
    '성명/내용': r.payee_name ?? '',
    프로그램: r.program?.name ?? '',
    '단가×회수': `${Number(r.unit_price ?? 0).toLocaleString()}×${r.quantity ?? 0}`,
    세전금액: Number(r.subtotal ?? 0),
    세액: Number(r.tax_amount ?? 0),
    세목: taxLabel(r),
    실지급: Number(r.net_amount ?? r.subtotal ?? 0),
    지급일: r.paid_at ?? '',
    상태: r.payment_status ?? '',
  }));
  const ws = XLSX.utils.json_to_sheet(xlsxRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '외주급여');
  XLSX.writeFile(wb, `외주급여_${today()}.xlsx`);
}

export async function downloadPayrollPdf(elementId: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const el = document.getElementById(elementId);
  if (!el) return { ok: false, reason: 'PDF 대상 테이블 요소를 찾지 못했어요.' };
  try {
    const canvas = await html2canvas(el, { scale: 1.5, backgroundColor: '#ffffff' });
    const pdf = new jsPDF('l', 'mm', 'a4');
    const w = pdf.internal.pageSize.getWidth();
    const h = (canvas.height * w) / canvas.width;
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, w, h);
    pdf.save(`외주급여_${today()}.pdf`);
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : 'PDF 생성 실패' };
  }
}
