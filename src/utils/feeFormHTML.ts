// bal24 v2 — STEP-FEE-FORM-DOWNLOAD (박경수님 2026-05-26)
// 강사료 지급확인서 HTML 양식 빌더. feeFormPDF.ts 에서 사용.

export interface FeeFormSession {
  sessionNo: number;
  date?: string | null;
  title?: string | null;
  fee?: number | null;
}

export interface FeeFormData {
  // 강사 정보
  staffName: string;
  affiliation?: string | null;       // 소속 (= staff_pool.organization)
  position?: string | null;          // 직함
  residentNumber?: string | null;    // 주민번호 (= staff_pool.id_number)
  bankAccount?: string | null;       // 계좌번호
  // 프로그램 정보
  programTitle: string;
  programStartDate?: string | null;
  programEndDate?: string | null;
  programLocation?: string | null;
  // 지급 정보
  amount: number;
  taxRate?: number | null;
  taxLabel?: string | null;
  taxAmount?: number | null;
  netAmount?: number | null;
  // 차시 내역
  sessions?: FeeFormSession[];
  // 메타
  issuedDate?: string;
}

function fmt(v: number | null | undefined): string {
  if (v == null) return '-';
  return `${Math.round(Number(v)).toLocaleString('ko-KR')}원`;
}

function escapeHtml(s: string | null | undefined): string {
  if (!s) return '';
  return s
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function formatKoDate(d: string | null | undefined): string {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  if (!y || !m || !day) return d;
  return `${y}년 ${Number(m)}월 ${Number(day)}일`;
}

function formatPeriod(start: string | null | undefined, end: string | null | undefined): string {
  const s = formatKoDate(start);
  const e = formatKoDate(end);
  if (s && e) {
    if (s === e) return s;
    return `${s} ~ ${e}`;
  }
  return s || e || '—';
}

/** 주민번호 뒷자리 마스킹 — 보안 표준. */
export function maskResidentNumber(rn: string | null | undefined): string {
  if (!rn) return '-';
  const clean = rn.replace(/-/g, '');
  if (clean.length < 7) return rn;
  return `${clean.slice(0, 6)}-${clean[6]}******`;
}

/** 강사료 지급확인서 HTML 빌더 (A4 세로 양식). */
export function buildFeeFormHTML(data: FeeFormData): string {
  const issuedDate = data.issuedDate ?? new Date().toLocaleDateString('ko-KR');
  const period = formatPeriod(data.programStartDate, data.programEndDate);
  const orgPos = [data.affiliation, data.position].filter(Boolean).join(' / ') || '—';
  const taxLabel = data.taxLabel ?? (data.taxRate != null ? `${(data.taxRate * 100).toFixed(1)}%` : '—');
  const amount = Number(data.amount ?? 0);
  const taxAmount = data.taxAmount != null
    ? Number(data.taxAmount)
    : (data.taxRate != null ? Math.round(amount * data.taxRate) : 0);
  const netAmount = data.netAmount != null
    ? Number(data.netAmount)
    : amount - taxAmount;

  const sessionsHtml = (data.sessions && data.sessions.length > 0)
    ? `
      <h3 class="section-title">강의 차시 내역</h3>
      <table class="sessions">
        <thead>
          <tr>
            <th style="width:60px;">차시</th>
            <th style="width:120px;">날짜</th>
            <th>제목</th>
            <th style="width:120px;text-align:right;">단가</th>
          </tr>
        </thead>
        <tbody>
          ${data.sessions.map((s) => `
            <tr>
              <td class="center tabular">${s.sessionNo ?? '-'}</td>
              <td class="center tabular">${escapeHtml(formatKoDate(s.date))}</td>
              <td>${escapeHtml(s.title) || '—'}</td>
              <td class="right tabular">${s.fee != null ? fmt(s.fee) : '-'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>`
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
    background: #fff;
  }
  .top-bar {
    display: flex; justify-content: space-between; align-items: center;
    font-size: 11px; color: #555;
    border-bottom: 1px solid #ddd; padding-bottom: 6px; margin-bottom: 18px;
  }
  h1.title {
    text-align: center; font-size: 22px; font-weight: 800;
    letter-spacing: 10px; margin: 8px 0 18px;
  }
  .meta-block { margin-bottom: 14px; font-size: 12.5px; line-height: 1.85; }
  .meta-block .label { display: inline-block; width: 60px; font-weight: 700; color: #444; }
  .section-title {
    font-size: 13px; font-weight: 700; color: #1E1B4B;
    background: #f4f4f4; padding: 6px 10px;
    border-left: 4px solid #7C3AED; margin: 14px 0 8px;
  }
  table { width: 100%; border-collapse: collapse; }
  table.info th, table.info td {
    border: 1px solid #aaa; padding: 7px 10px; vertical-align: middle;
  }
  table.info th {
    background: #f7f7f7; width: 90px; text-align: center; font-weight: 700;
  }
  table.sessions th, table.sessions td { border: 1px solid #aaa; padding: 6px 8px; }
  table.sessions th { background: #f7f7f7; font-weight: 700; text-align: center; }
  .center { text-align: center; }
  .right { text-align: right; }
  .tabular { font-variant-numeric: tabular-nums; }
  .payment { margin-top: 6px; width: 100%; border-collapse: collapse; }
  .payment td { padding: 7px 10px; border-bottom: 1px solid #ddd; }
  .payment td.k { width: 60%; color: #444; }
  .payment td.v { text-align: right; font-variant-numeric: tabular-nums; }
  .payment tr.tax td.v { color: #b91c1c; }
  .payment tr.total td {
    border-top: 2px solid #555; border-bottom: 2px solid #555;
    font-weight: 800; font-size: 14px;
  }
  .footer-confirm { margin-top: 30px; text-align: center; line-height: 2.2; font-size: 13px; }
  .footer-confirm .stamp-line { margin-top: 14px; }
  .footer-confirm .stamp-line .seal {
    display: inline-block; width: 40px; height: 40px;
    border: 2px solid #b91c1c; border-radius: 50%; color: #b91c1c;
    font-weight: 700; line-height: 36px; text-align: center;
    margin-left: 6px; font-size: 11px;
  }
  .footer-confirm .staff-sign { margin-top: 18px; font-size: 12px; color: #444; }
</style>
</head>
<body>

<div class="top-bar">
  <span><strong>WorkFlow</strong> · (주)밸런스닷</span>
  <span>발행일 ${escapeHtml(issuedDate)}</span>
</div>

<h1 class="title">강 사 료 지 급 확 인 서</h1>

<div class="meta-block">
  <p><span class="label">사업명</span>${escapeHtml(data.programTitle)}</p>
  <p><span class="label">기 간</span>${escapeHtml(period)}</p>
  ${data.programLocation ? `<p><span class="label">장 소</span>${escapeHtml(data.programLocation)}</p>` : ''}
</div>

<h3 class="section-title">강사 정보</h3>
<table class="info">
  <tr>
    <th>성 명</th>
    <td>${escapeHtml(data.staffName)}</td>
    <th>소속/직함</th>
    <td>${escapeHtml(orgPos)}</td>
  </tr>
  <tr>
    <th>주민번호</th>
    <td>${escapeHtml(maskResidentNumber(data.residentNumber))}</td>
    <th>계좌번호</th>
    <td>${escapeHtml(data.bankAccount) || '—'}</td>
  </tr>
</table>

${sessionsHtml}

<h3 class="section-title">지급 내역</h3>
<table class="payment">
  <tr>
    <td class="k">강 사 료</td>
    <td class="v">${fmt(amount)}</td>
  </tr>
  <tr class="tax">
    <td class="k">원천징수세액 (${escapeHtml(taxLabel)})</td>
    <td class="v">- ${fmt(taxAmount)}</td>
  </tr>
  <tr class="total">
    <td class="k">실 지 급 액</td>
    <td class="v">${fmt(netAmount)}</td>
  </tr>
</table>

<div class="footer-confirm">
  위와 같이 강사료를 지급함을 확인합니다.<br/><br/>
  ${escapeHtml(issuedDate)}<br/>
  <div class="stamp-line">
    (주)밸런스닷 대표이사
    <span class="seal">인</span>
  </div>
  <p class="staff-sign">강사 확인 : ___________________________  (서명 또는 날인)</p>
</div>

</body>
</html>
`.trim();
}
