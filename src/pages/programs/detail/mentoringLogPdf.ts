// bal24 v2 — STEP-MENTORING-P2-PDF · 박경수님 2026-05-26 양식 보강
// 멘토링 (컨설팅) 상담일지 PDF 양식 HTML 빌더 + 동적 import 다운로드.
// 양식 구조 (박경수님 PDF 기준).
//   제목: 멘 토 링 (컨설팅) 상 담 일 지
//   표 1행 헤더: [프로그램명] colspan 5
//   멘 토 행 — 소속/직위 | (소속/직위 값) | 성 명 | (성명 값)        ← 4 셀
//   멘 티 행 — 참여팀명 | (팀명 값) colspan 3                          ← 멘티는 rowspan=2
//             참 여 자 | (참여자 이름들) colspan 3
//   멘토링 일시 | (날짜 시간 범위) colspan 4
//   주    제   | (주제) colspan 4
//   멘토링 내용 | (긴 텍스트) colspan 4
//   사진첨부   | (이미지 그리드) colspan 4
//   하단 제출문: 위와 같이 ... 제출합니다. + 날짜 + 성명·서명
//   수신처: 좌측 하단 "OO 귀하"

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
  // 멘티 정보
  mentee_names: string[];
  // 프로그램
  program_name: string;
  project_name: string;
  // 첨부 이미지 URL (최대 3개)
  image_urls: string[];
  // 박경수님 2026-05-26 양식 보강
  team_name: string | null;
  start_time: string | null;        // HH:MM
  end_time: string | null;          // HH:MM
}

function formatKoDate(d: string | null | undefined): string {
  if (!d) return '　　년 　월 　일';
  const [y, m, day] = d.split('-');
  return `${y}년 ${Number(m)}월 ${Number(day)}일`;
}

function formatDateWithTime(date: string | null, start: string | null, end: string | null): string {
  if (!date) return '—';
  const [y, m, d] = date.split('-');
  const dateStr = `${y}.${m}.${d}.`;
  const s = (start ?? '').slice(0, 5);
  const e = (end ?? '').slice(0, 5);
  if (s && e) return `${dateStr} ${s} ~ ${e}`;
  if (s) return `${dateStr} ${s}~`;
  return dateStr;
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
  const datetimeStr = formatDateWithTime(log.log_date, log.start_time, log.end_time);
  const menteeStr = log.mentee_names.length > 0 ? log.mentee_names.join(', ') : '—';
  const teamStr = log.team_name && log.team_name.trim() ? log.team_name : '—';
  const orgPosition = [log.mentor_org, log.mentor_position].filter(Boolean).join(' / ') || '—';

  // 박경수님 2026-05-28 — PDF 백지 진짜 원인 fix.
  // <img> 태그에 crossorigin="anonymous" 없으면 html2canvas 의 useCORS:true 가 효력
  // 발생하지 않고, 외부 이미지로 인해 canvas 가 tainted 됨 → toDataURL 시 SecurityError
  // → PDF 백지. crossorigin 속성 명시해야 Supabase Storage CORS 헤더 정상 협상.
  const imagesHtml = log.image_urls.slice(0, 6)
    .map((url) =>
      `<img src="${escapeHtml(url)}" crossorigin="anonymous" style="width:180px;height:135px;object-fit:cover;border:1px solid #ccc;border-radius:3px;" />`,
    ).join('');

  const signatureHtml = log.mentor_signature_url
    ? `<img src="${escapeHtml(log.mentor_signature_url)}" crossorigin="anonymous" style="height:38px;vertical-align:middle;" />`
    : `<span style="font-family:serif;font-size:13px;padding:2px 16px;border-bottom:1px solid #333;">${escapeHtml(log.mentor_name)} (서명)</span>`;

  const programHeader = log.project_name
    ? `${escapeHtml(log.project_name)} — ${escapeHtml(log.program_name)}`
    : escapeHtml(log.program_name);

  // 사진 행 — 이미지 있을 때만 표시
  const photoRow = log.image_urls.length > 0
    ? `<tr>
         <th rowspan="1">멘토링<br/>사진첨부</th>
         <td colspan="4">
           <div style="display:flex;flex-wrap:wrap;gap:8px;padding:6px 0;">${imagesHtml}</div>
         </td>
       </tr>`
    : '';

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
    font-size: 22px;
    font-weight: 800;
    letter-spacing: 8px;
    margin-bottom: 20px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }
  th, td {
    border: 1px solid #555;
    padding: 8px 10px;
    vertical-align: middle;
    word-break: keep-all;
  }
  th {
    background: #f4f4f4;
    font-weight: 700;
    text-align: center;
    white-space: nowrap;
  }
  th.label {
    width: 80px;
  }
  th.sub-label {
    width: 90px;
  }
  th.value-label {
    width: 80px;
  }
  td.program-header {
    background: #fafafa;
    text-align: center;
    font-weight: 700;
    font-size: 13px;
    padding: 10px;
  }
  td.content-cell {
    vertical-align: top;
    line-height: 1.85;
    white-space: pre-wrap;
    min-height: 200px;
  }
  td.value-cell {
    text-align: left;
    line-height: 1.7;
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
    font-size: 14px;
    font-weight: 700;
  }
</style>
</head>
<body>

<h1>멘 토 링 (컨설팅) 상 담 일 지</h1>

<table>
  <!-- 헤더 — 프로그램명 -->
  <tr>
    <td class="program-header" colspan="5">${programHeader}</td>
  </tr>

  <!-- 멘토 — 4 컬럼 (소속/직위 · 값 · 성명 · 값) -->
  <tr>
    <th class="label" rowspan="1">멘 토</th>
    <th class="sub-label">소속/직위</th>
    <td class="value-cell">${escapeHtml(orgPosition)}</td>
    <th class="value-label">성 명</th>
    <td class="value-cell">${escapeHtml(log.mentor_name)}</td>
  </tr>

  <!-- 멘티 — rowspan 2 (참여팀명 + 참여자) -->
  <tr>
    <th class="label" rowspan="2">멘 티</th>
    <th class="sub-label">참여팀명</th>
    <td class="value-cell" colspan="3">${escapeHtml(teamStr)}</td>
  </tr>
  <tr>
    <th class="sub-label">참 여 자</th>
    <td class="value-cell" colspan="3">${escapeHtml(menteeStr)}</td>
  </tr>

  <!-- 멘토링 일시 -->
  <tr>
    <th class="label">멘토링 일시</th>
    <td class="value-cell" colspan="4">
      ${escapeHtml(datetimeStr)}${log.duration_min ? ` &nbsp;<span style="color:#666;">(${log.duration_min}분)</span>` : ''}
    </td>
  </tr>

  <!-- 멘토링 내용 헤더 (한 칸 강조) -->
  <tr>
    <td class="program-header" colspan="5" style="background:#eef;">멘토링 내용</td>
  </tr>

  <!-- 주제 -->
  <tr>
    <th class="label">주 제</th>
    <td class="value-cell" colspan="4">${escapeHtml(log.subject) || '—'}</td>
  </tr>

  <!-- 멘토링 내용 본문 -->
  <tr>
    <th class="label">멘토링 내용</th>
    <td class="content-cell" colspan="4">${escapeHtml(log.content)}</td>
  </tr>

  ${photoRow}
</table>

<div class="submit-section">
  위와 같이 멘토링 상담일지를 제출합니다.<br/>
  ${formattedDate}<br/><br/>
  성명 &nbsp;&nbsp; ${escapeHtml(log.mentor_name)} &nbsp;&nbsp; ${signatureHtml}
</div>

<div class="recipient-line">
  ${escapeHtml(log.recipient) || '담당자'} 귀하
</div>

</body>
</html>
`.trim();
}

/** 모든 이미지 로드 대기 (CORS 차단·로딩 지연 시 캡쳐 백지 방지). */
function waitForImages(root: HTMLElement, timeoutMs = 8000): Promise<void> {
  const imgs = Array.from(root.querySelectorAll('img'));
  if (imgs.length === 0) return Promise.resolve();
  const waits = imgs.map((img) => {
    if (img.complete && img.naturalWidth > 0) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const done = () => resolve();
      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', done, { once: true });
    });
  });
  const timeout = new Promise<void>((resolve) => setTimeout(() => resolve(), timeoutMs));
  return Promise.race([Promise.all(waits).then(() => undefined), timeout]);
}

/** 박경수님 2026-05-28 — PDF 백지 근본 fix (v4).
 *  검증된 feeFormPDF.ts 패턴 100% 동일 채용 (그쪽은 박경수님 환경에서 정상 동작).
 *  진짜 원인은 container 위치가 아니라 <img> 의 crossorigin 속성 누락이었음 —
 *  buildMentoringLogHtml 에서 fix 완료.
 *
 *  진단 로그 — PDF 백지 재발 시 F12 → Console 에 [PDF] 로 시작하는 단계별 출력 확인 가능. */
export async function downloadMentoringLogPdf(log: MentoringLogForPdf): Promise<void> {
  console.log('[PDF] 시작 — 일지 ID:', log.id, '/ 사진:', log.image_urls.length, '장');
  const fullHtml = buildMentoringLogHtml(log);
  console.log('[PDF] HTML 빌드 완료 — 길이:', fullHtml.length);

  const styleMatch = fullHtml.match(/<style[\s\S]*?<\/style>/);
  const bodyMatch = fullHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/);
  const styleHtml = styleMatch?.[0] ?? '';
  const bodyInner = bodyMatch?.[1] ?? fullHtml;

  const mod = await import('html2pdf.js');
  const html2pdf = mod.default;

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '0';
  container.style.left = '0';
  container.style.width = '794px';
  container.style.opacity = '0';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '-1';
  container.style.background = '#fff';
  container.innerHTML = styleHtml + bodyInner;
  document.body.appendChild(container);
  console.log('[PDF] container 부착 — scrollHeight:', container.scrollHeight);

  const fileNameParts = ['멘토링상담일지', log.mentor_name, log.log_date ?? ''].filter(Boolean);
  const fileName = fileNameParts.join('_') + '.pdf';

  try {
    await waitForImages(container);
    console.log('[PDF] 이미지 로드 완료, html2pdf 실행 중...');
    await html2pdf()
      .set({
        margin: [10, 10, 10, 10],
        filename: fileName,
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true, allowTaint: true, backgroundColor: '#ffffff', logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      })
      .from(container)
      .save();
    console.log('[PDF] 저장 완료:', fileName);
  } catch (err) {
    console.error('[PDF] 오류:', err);
    throw err;
  } finally {
    if (container.parentElement) document.body.removeChild(container);
  }
}
