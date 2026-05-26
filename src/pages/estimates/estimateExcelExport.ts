// 견적서 엑셀 다운로드 — 박경수님 + SkyClaw STEP-ESTIMATE-ADDON-FULL (2026-05-27)
// 박경수님 환경에 ExcelJS 미설치. 기존 xlsx (SheetJS) 활용 (vendor 추가 X)
// SheetJS 무료판은 컬러·서식 제한적이지만 박경수님 환경 호환 우선.

import * as XLSX from 'xlsx';
import type { EstimateAddonConfig, EstimateAddonResult } from './estimateAddonUtils';

interface EstimateItem {
  category: string;
  name: string;
  unit?: string;
  unitPrice: number;
  quantity: number;
  amount: number;
  note?: string;
}

export function downloadEstimateExcel(
  projectName: string,
  items: EstimateItem[],
  cfg: EstimateAddonConfig,
  result: EstimateAddonResult,
): void {
  const rows: Array<Array<string | number>> = [];
  rows.push(['견  적  서']);
  rows.push([projectName]);
  rows.push([]);
  rows.push(['구분', '항목명', '단위', '단가', '수량', '금액', '비고']);

  for (const it of items) {
    rows.push([it.category, it.name, it.unit ?? '', it.unitPrice, it.quantity, it.amount, it.note ?? '']);
  }
  rows.push([]);
  rows.push(['', '직접비 소계', '', '', '', result.directTotal, '']);

  if (cfg.useOverhead) {
    rows.push(['', cfg.overheadLabel, '', `직접비 × ${cfg.overheadRate}%`, '', result.overheadAmount, '']);
  }
  if (cfg.useTechFee) {
    rows.push(['', cfg.techFeeLabel, '', `직접비 × ${cfg.techFeeRate}%`, '', result.techFeeAmount, '']);
  }
  rows.push(['', '공급가액 합계', '', '', '', result.supplyTotal, '']);

  if (cfg.useVat) {
    rows.push(['', `부가세 (${cfg.vatRate}%)`, '', '', '', result.vatAmount, '']);
  }
  rows.push(['', '합계총액', '', '', '', result.grandTotal, '']);

  if (cfg.finalProposalAmount != null) {
    rows.push(['', '최종 제안금액', '', '', '', cfg.finalProposalAmount, '(VAT 포함)']);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  // 컬럼 너비
  ws['!cols'] = [{ wch: 12 }, { wch: 28 }, { wch: 8 }, { wch: 14 }, { wch: 8 }, { wch: 16 }, { wch: 16 }];
  // 제목 셀 머지 (A1:G1, A2:G2)
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 6 } },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '견적서');

  const safeName = projectName.replace(/[^\w가-힣]/g, '_');
  const today = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `견적서_${safeName}_${today}.xlsx`);
}
