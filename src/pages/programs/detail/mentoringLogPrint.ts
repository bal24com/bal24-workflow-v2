// 박경수님 2026-05-29 — 멘토링 일지 새 창 인쇄 함수 (mentoringLogPdf.ts V-1 슬림화 분리).
// html2canvas 우회 패턴 — 새 창 + 브라우저 인쇄 → 사용자가 "PDF 로 저장" 선택.

import { buildMentoringLogHtml, type MentoringLogForPdf } from './mentoringLogPdf';

/** 한 일지를 새 창에 띄우고 즉시 인쇄 대화상자 호출. */
export function printMentoringLogViaNewWindow(log: MentoringLogForPdf): void {
  console.log('[PDF-PRINT] 시작 — 일지 ID:', log.id, '/ 사진:', log.image_urls.length, '장');
  const html = buildMentoringLogHtml(log);
  const win = window.open('', '_blank', 'width=900,height=1100,scrollbars=yes');
  if (!win) {
    console.error('[PDF-PRINT] 팝업 차단됨');
    throw new Error('팝업이 차단됐어요. 브라우저 주소창 우측의 차단 아이콘을 눌러 허용 후 다시 시도해 주세요.');
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  const imgCount = log.image_urls.length;
  const waitMs = imgCount > 5 ? 1500 : 800;
  setTimeout(() => {
    try {
      win.focus();
      win.print();
      console.log('[PDF-PRINT] 인쇄 대화상자 호출 완료');
    } catch (err) {
      console.error('[PDF-PRINT] window.print 실패:', err);
    }
  }, waitMs);
}

/** 여러 일지를 한 번에 인쇄 (멘토별 일지 모음 또는 전체 일지 일괄용).
 *  새 창 1번 → 인쇄 대화상자 1번 → 사용자가 "PDF 로 저장" 선택 → PDF 1개 파일. */
export function printMultipleMentoringLogs(logs: MentoringLogForPdf[]): void {
  if (logs.length === 0) {
    throw new Error('인쇄할 일지가 없어요.');
  }
  console.log('[PDF-PRINT-MULTI] 시작 — 일지', logs.length, '건');
  const bodyParts: string[] = [];
  let styleHtml = '';
  for (let i = 0; i < logs.length; i++) {
    const html = buildMentoringLogHtml(logs[i]);
    if (i === 0) {
      const m = html.match(/<style[\s\S]*?<\/style>/);
      if (m) styleHtml = m[0];
    }
    const m = html.match(/<body[^>]*>([\s\S]*?)<\/body>/);
    if (m) {
      const isLast = i === logs.length - 1;
      bodyParts.push(
        `<div style="${isLast ? '' : 'page-break-after: always;'}">${m[1]}</div>`,
      );
    }
  }
  const finalHtml = `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">${styleHtml}<style>@page{size:A4;margin:10mm;}body{margin:0;}</style></head><body>${bodyParts.join('')}</body></html>`;

  const win = window.open('', '_blank', 'width=900,height=1100,scrollbars=yes');
  if (!win) {
    console.error('[PDF-PRINT-MULTI] 팝업 차단됨');
    throw new Error('팝업이 차단됐어요. 브라우저 주소창 우측의 차단 아이콘을 눌러 허용 후 다시 시도해 주세요.');
  }
  win.document.open();
  win.document.write(finalHtml);
  win.document.close();
  const waitMs = Math.min(800 + logs.length * 300, 3000);
  setTimeout(() => {
    try {
      win.focus();
      win.print();
      console.log('[PDF-PRINT-MULTI] 인쇄 대화상자 호출');
    } catch (err) {
      console.error('[PDF-PRINT-MULTI] window.print 실패:', err);
    }
  }, waitMs);
}
