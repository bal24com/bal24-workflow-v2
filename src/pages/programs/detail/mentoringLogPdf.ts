// bal24 v2 — STEP-MENTORING-P2-PDF
// 멘토링 일지 PDF 양식 HTML 빌더 + 동적 import 다운로드.
// PDF 양식: [서식 3] 멘토링 상담일지 (사업명 / 멘토 / 일시 / 멘티 / 주제 / 내용 / 사진 / 제출문 / 수신처)

export interface MentoringLogForPdf {
  id: string;
  subject: string | null;
  content: string | null;
  log_date: string | null;          // YYYY-MM-DD
  duration_min: number | null;
  recipient: string | null;
  mentor_signature_url: string | null;
  status: string;
  // 멘토 정보
  mentor_name: string;
  mentor_org: string;
  mentor_position: string;
  // 멘티 목록
  mentee_names: string[];
  // 프로그램
  program_name: string;
  project_name: string;
  // 첨부 이미지 URL (최대 3개)
  image_urls: string[];
}

function formatKoDate(d: string | null | undefined): string {
  if (!d) return '　　년 　월 　일';
  const [y, m, day] = d.split('-');
  return `${y}년 ${m}월 ${day}일`;
}

function escapeHtml(s: string | null | undefined): string {
  if (!s) return '';
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function buildMentoringLogHtml(log: MentoringLogForPdf): string {
  const formattedDate = formatKoDate(log.log_date);
  const menteeStr = log.mentee_names.length > 0 ? log.mentee_names.join(', ') : '—';
  const imagesHtml = log.image_urls.slice(0, 3)
    .map((url) =>
      `<img src="${escapeHtml(url)}" style="max-width:200px;max-height:170px;object-fit:contain;border:1px solid #ddd;border-radius:4px;" />`,
    ).join('');
  const signatureHtml = log.mentor_signature_url
    ? `<img src="${escapeHtml(log.mentor_signature_url)}" style="height:42px;vertical-align:middle;" />`
    : `<span style="font-family:serif;font-size:14px;border-bottom:1px solid #aaa;padding:2px 24px;">${escapeHtml(log.mentor_name)}</span>`;
  const programLine = log.project_name
    ? `${escapeHtml(log.program_name)} — ${escapeHtml(log.project_name)}`
    : escapeHtml(log.program_name);

  return `
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Malgun Gothic', '맑은 고딕', sans-serif;
    font-size: 12px;
    color: #111;
    padding: 30px;
    width: 794px;
  }
  h1 {
    text-align: center;
    font-size: 20px;
    font-weight: 800;
    letter-spacing: 6px;
    margin-bottom: 6px;
  }
  .program-title {
    text-align: center;
    font-size: 13px;
    margin-bottom: 18px;
    color: #444;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 24px;
  }
  th, td {
    border: 1px solid #888;
    padding: 9px 12px;
    vertical-align: top;
  }
  th {
    background: #f5f5f5;
    font-weight: 700;
    width: 90px;
    text-align: center;
    white-space: nowrap;
  }
  .content-cell {
    min-height: 180px;
    line-height: 1.8;
    white-space: pre-wrap;
  }
  .image-cell {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    min-height: 90px;
    align-items: center;
  }
  .submit-section {
    text-align: center;
    margin-top: 28px;
    line-height: 2.4;
    font-size: 13px;
  }
  .recipient-line {
    text-align: left;
    margin-top: 22px;
    font-size: 13px;
    font-weight: 600;
  }
</style>
</head>
<body>
<h1>멘 토 링 상 담 일 지</h1>
<div class="program-title">${programLine}</div>
<table>
  <tr>
    <th>멘 토</th>
    <td>소속: ${escapeHtml(log.mentor_org) || '—'} &nbsp;/&nbsp; 직위: ${escapeHtml(log.mentor_position) || '전문가'} &nbsp;/&nbsp; 성명: ${escapeHtml(log.mentor_name)}</td>
  </tr>
  <tr>
    <th>멘토링 일시</th>
    <td>${formattedDate}${log.duration_min ? ` &nbsp;(${log.duration_min}분)` : ''}</td>
  </tr>
  <tr>
    <th>대상 멘티</th>
    <td>${escapeHtml(menteeStr)}</td>
  </tr>
  <tr>
    <th>주 제</th>
    <td>${escapeHtml(log.subject) || '—'}</td>
  </tr>
  <tr>
    <th>멘토링 내용</th>
    <td class="content-cell">${escapeHtml(log.content)}</td>
  </tr>
  ${log.image_urls.length > 0 ? `
  <tr>
    <th>사 진 첨 부</th>
    <td><div class="image-cell">${imagesHtml}</div></td>
  </tr>` : ''}
</table>
<div class="submit-section">
  위와 같이 [${escapeHtml(log.program_name)}] 멘토링 상담일지를 제출합니다.<br/>
  ${formattedDate}<br/><br/>
  성명 &nbsp;&nbsp; ${signatureHtml}
</div>
<div class="recipient-line">
  ${escapeHtml(log.recipient) || '담당자'} 귀하
</div>
</body>
</html>
`.trim();
}

/** 동적 import 로 html2pdf.js 로드 후 PDF 다운로드. */
export async function downloadMentoringLogPdf(log: MentoringLogForPdf): Promise<void> {
  const html = buildMentoringLogHtml(log);
  const mod = await import('html2pdf.js');
  const html2pdf = mod.default;

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.innerHTML = html;
  document.body.appendChild(container);

  const fileNameParts = ['멘토링일지', log.mentor_name, log.log_date ?? ''].filter(Boolean);
  const fileName = fileNameParts.join('_') + '.pdf';

  try {
    const bodyEl = container.querySelector('body');
    await html2pdf()
      .set({
        margin: [10, 10, 10, 10],
        filename: fileName,
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      })
      .from((bodyEl ?? container) as HTMLElement)
      .save();
  } finally {
    document.body.removeChild(container);
  }
}
