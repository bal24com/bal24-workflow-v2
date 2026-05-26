// 견적서 엑셀 다운로드 (정식 양식) — 박경수님 + SkyClaw STEP-ESTIMATE-EXCEL-UX (2026-05-27)
// xlsx (SheetJS) 활용. 섹션 1~7 구성: 타이틀·헤더정보·공급자정보·항목테이블·합계·특이사항.

import * as XLSX from 'xlsx';
import type { EstimateAddonConfig, EstimateAddonResult } from './estimateAddonUtils';

// 공급자 정보 — (주)밸런스닷
const COMPANY_INFO = {
  name: '주식회사 밸런스닷',
  bizNo: '883-87-03232',
  address: '전북특별자치도 전주시 덕진구 오공로 43-13, 1동 5층 501호',
  tel: '070-7773-2341',
  email: 'park8451@gmail.com',
  ceo: '박경수',
} as const;

interface EstimateItem {
  category: string;
  name: string;
  unit?: string;
  unitPrice: number;
  quantity: number;
  amount: number;
  note?: string;
}

interface ExportParams {
  title: string;
  clientName: string;
  items: EstimateItem[];
  cfg: EstimateAddonConfig;
  result: EstimateAddonResult;
  createdAt?: string;
}

function todayIso(): string { return new Date().toISOString().slice(0, 10); }
function fileNameDate(): string { return todayIso().replace(/-/g, ''); }

export function downloadEstimateExcel(params: ExportParams): void {
  const { title, clientName, items, cfg, result, createdAt } = params;
  const dateStr = createdAt ?? todayIso();
  const finalAmount = cfg.finalProposalAmount ?? result.roundedTotal;
  const receiver = clientName.trim() ? `${clientName} 귀하` : '담당자 귀하';

  // ── aoa 구성 ─────────────────────────────────────
  const aoa: Array<Array<string | number>> = [];

  // [1] 타이틀
  aoa.push(['견  적  서', '', '', '', '', '']);
  aoa.push([]);

  // [2] 헤더 정보
  aoa.push(['수  신', receiver, '', '', '', '']);
  aoa.push(['제  목', title, '', '', '', '']);
  aoa.push(['견적금액', `${finalAmount.toLocaleString()}원 (VAT ${cfg.useVat ? '포함' : '별도'})`, '', '', '', '']);
  aoa.push(['견적일자', `${dateStr} (견적일로부터 7일간 유효)`, '', '', '', '']);
  aoa.push([]);

  // [3] 공급자 정보 박스
  aoa.push(['[공급자 정보]', '', '', '', '', '']);
  aoa.push(['회사명', COMPANY_INFO.name, '', '대표자', COMPANY_INFO.ceo, '']);
  aoa.push(['사업자', COMPANY_INFO.bizNo, '', '전  화', COMPANY_INFO.tel, '']);
  aoa.push(['소재지', COMPANY_INFO.address, '', '', '', '']);
  aoa.push(['이메일', COMPANY_INFO.email, '', '', '', '']);
  aoa.push([]);

  // [4] 항목 테이블 헤더
  const headerRow = aoa.push(['항목', '세부내용', '수량', '단가', '금액', '비고']);

  // [5] 항목 데이터
  for (const it of items) {
    aoa.push([it.category, it.name, it.quantity, it.unitPrice, it.amount, it.note ?? '']);
  }
  aoa.push([]);

  // [6] 합계 요약
  aoa.push(['', '', '', '직접비 소계', result.directTotal, '']);
  if (cfg.useOverhead) aoa.push(['', '', '', `${cfg.overheadLabel} (${cfg.overheadRate}%)`, result.overheadAmount, '']);
  if (cfg.useTechFee)  aoa.push(['', '', '', `${cfg.techFeeLabel} (${cfg.techFeeRate}%)`, result.techFeeAmount, '']);
  aoa.push(['', '', '', '공급가액', result.supplyTotal, '']);
  aoa.push(['', '', '', `부 가 세 (${cfg.useVat ? cfg.vatRate + '%' : '미적용'})`, cfg.useVat ? result.vatAmount : '-', '']);
  aoa.push(['', '', '', '견적금액 (부가세 포함)', result.grandTotal, '']);
  aoa.push(['', '', '', '최종 제안금액 (만단위 절사)', finalAmount, '']);
  aoa.push([]);

  // [7] 특이사항
  aoa.push(['특이사항', '', '', '', '', '']);
  aoa.push(['', '', '', '', '', '']);

  // ── 워크시트 생성 ────────────────────────────────
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // 컬럼 너비
  ws['!cols'] = [{ wch: 12 }, { wch: 30 }, { wch: 8 }, { wch: 15 }, { wch: 15 }, { wch: 12 }];

  // 머지 셀
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } },  // 타이틀
    { s: { r: 2, c: 1 }, e: { r: 2, c: 5 } },  // 수신
    { s: { r: 3, c: 1 }, e: { r: 3, c: 5 } },  // 제목
    { s: { r: 4, c: 1 }, e: { r: 4, c: 5 } },  // 견적금액
    { s: { r: 5, c: 1 }, e: { r: 5, c: 5 } },  // 견적일자
    { s: { r: 7, c: 0 }, e: { r: 7, c: 5 } },  // [공급자 정보]
    { s: { r: 9, c: 1 }, e: { r: 9, c: 2 } },  // 사업자번호 영역
    { s: { r: 10, c: 1 }, e: { r: 10, c: 5 } }, // 소재지
    { s: { r: 11, c: 1 }, e: { r: 11, c: 5 } }, // 이메일
    // 특이사항 영역은 동적 row 번호라 마지막에 추가 (headerRow + 항목 + 합계 등)
    { s: { r: aoa.length - 2, c: 0 }, e: { r: aoa.length - 2, c: 5 } },
    { s: { r: aoa.length - 1, c: 1 }, e: { r: aoa.length - 1, c: 5 } },
  ];

  // 숫자 셀 포맷 (#,##0) — 항목 단가/금액 + 합계 영역
  const headerRowIdx = headerRow - 1; // 0-based
  const itemStart = headerRowIdx + 1;
  const itemEnd = itemStart + items.length - 1;
  for (let r = itemStart; r <= itemEnd; r += 1) {
    const cellD = XLSX.utils.encode_cell({ r, c: 3 });
    const cellE = XLSX.utils.encode_cell({ r, c: 4 });
    if (ws[cellD]) ws[cellD].z = '#,##0';
    if (ws[cellE]) ws[cellE].z = '#,##0';
  }
  // 합계 영역도 숫자 포맷
  const sumStart = itemEnd + 2;
  const sumEnd = aoa.length - 3;
  for (let r = sumStart; r <= sumEnd; r += 1) {
    const cellE = XLSX.utils.encode_cell({ r, c: 4 });
    if (ws[cellE] && typeof ws[cellE].v === 'number') ws[cellE].z = '#,##0';
  }

  // 워크북 생성 + 다운로드
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '견적서');

  const safeName = title.replace(/[^\w가-힣]/g, '_');
  XLSX.writeFile(wb, `견적서_${safeName}_${fileNameDate()}.xlsx`);
}
