// bal24 v2 — PDF 변환 코어 (lib/, 순수 함수)
// 두 입력 모델 지원:
//   - elementToPdfBlob: 미리 렌더된 DOM 캡처 (외부 페이지·보고서 미리보기)
//   - htmlToPdfBlob: 동적 HTML 문자열 (PM 일괄 발급용 — certificateUtils 가 호출)
// jspdf + html2canvas 사용. domain 의존성 없음 (Storage·시퀀스는 certificates/ 에 분리).

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export interface PdfOptions {
  /** 기본 'landscape' (수료증). 'portrait' 는 보고서 등 세로형 + 멀티페이지 자동 분할 */
  orientation?: 'landscape' | 'portrait';
  /** html2canvas scale (기본 2 — 고해상도) */
  scale?: number;
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
  const scale = options?.scale ?? 2;
  try {
    const canvas = await html2canvas(el, {
      scale,
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

/**
 * HTML 문자열 → PDF Blob (PM 발급용 핵심 코어).
 * - 임시 div 를 화면 밖에 렌더 → html2canvas 캡처 → jsPDF.
 * - portrait 기본 (수료증·강의확인서 794×1123 패턴).
 * - finally 블록에서 임시 div 정리.
 */
export async function htmlToPdfBlob(
  html: string,
  options?: PdfOptions,
): Promise<Blob> {
  const orientation = options?.orientation ?? 'portrait';
  const scale = options?.scale ?? 2;

  const container = document.createElement('div');
  container.style.cssText = `
    width:794px; height:1123px; padding:80px;
    background:#fff; font-family: Pretendard, sans-serif;
    position:absolute; left:-9999px; top:0; box-sizing:border-box;
  `;
  container.innerHTML = html;
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale,
      useCORS: true,
      backgroundColor: '#ffffff',
    });
    const pdf = new jsPDF({ orientation, unit: 'px', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, pageW, pageH);
    return pdf.output('blob');
  } finally {
    document.body.removeChild(container);
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
