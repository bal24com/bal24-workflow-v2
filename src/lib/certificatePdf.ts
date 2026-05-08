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

/**
 * DOM element를 PDF로 변환.
 * - element는 외부에서 미리 렌더해둔 hidden 영역 (CertViewPage가 관리)
 * - 결과는 jsPDF Blob → URL 반환 (caller가 a.download 처리)
 */
export async function elementToPdfBlob(el: HTMLElement): Promise<Blob | null> {
  try {
    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
    });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });
    const pageWidth = 297;
    const pageHeight = 210;
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    const yOffset = imgHeight < pageHeight ? (pageHeight - imgHeight) / 2 : 0;
    pdf.addImage(imgData, 'PNG', 0, yOffset, imgWidth, imgHeight);
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
