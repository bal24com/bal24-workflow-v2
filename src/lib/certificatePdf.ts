// bal24 v2 — 수료증·강의확인서 PDF 즉석 생성 (Stage 11-①)
// jspdf + html2canvas — 단순 캔버스 → 이미지 → A4 PDF.

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export interface CertificatePayload {
  /** 수료증 / 강의확인서 */
  title: string;
  institutionName: string;
  recipientName: string;
  programName: string;
  /** 'YYYY-MM-DD' */
  issueDate: string;
  certNumber?: string | null;
  sealImageUrl?: string | null;
  signatureName?: string | null;
  /** 추가 본문 (예: "위 사람은 ..." 문장) */
  bodyText?: string;
}

export interface PdfOptions {
  /** 기본 'landscape' (수료증). 'portrait' 는 보고서 등 세로형 + 멀티페이지 자동 분할 */
  orientation?: 'landscape' | 'portrait';
}

/**
 * DOM element를 PDF로 변환.
 * - landscape: 가로 1페이지 (수료증 패턴, 컨텐츠가 페이지보다 작으면 세로 중앙 정렬)
 * - portrait: 세로 + 컨텐츠가 길면 멀티페이지로 자동 분할 (보고서 패턴)
 * - 실패 시 null 반환 (caller 가 toast 처리)
 */
export async function elementToPdfBlob(
  el: HTMLElement,
  options?: PdfOptions,
): Promise<Blob | null> {
  const orientation = options?.orientation ?? 'landscape';
  try {
    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
    });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation, unit: 'mm', format: 'a4' });

    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgW = pageW;
    const imgH = (canvas.height * imgW) / canvas.width;

    if (orientation === 'portrait' && imgH > pageH) {
      // 멀티페이지 — 한 장씩 yOffset 으로 잘라 붙임
      let yOffset = 0;
      while (yOffset < imgH) {
        if (yOffset > 0) pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, -yOffset, imgW, imgH);
        yOffset += pageH;
      }
    } else {
      const yOffset = imgH < pageH ? (pageH - imgH) / 2 : 0;
      pdf.addImage(imgData, 'PNG', 0, yOffset, imgW, imgH);
    }

    return pdf.output('blob');
  } catch (err) {
    const raw = err instanceof Error ? err.message : '';
    console.error('[certificate-pdf] PDF 생성 실패:', raw);
    return null;
  }
}

/** Blob → 다운로드 트리거 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** 한국어 날짜 표기 — "YYYY년 MM월 DD일" */
export function formatIssueDateKo(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}
