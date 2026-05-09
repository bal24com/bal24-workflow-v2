// bal24 v2 — 전체 페이지 자동 캡처 스크립트 (Playwright)
//
// 사용법:
//   1. 패키지 설치 (최초 1회):     npm i -D playwright
//   2. 브라우저 다운로드 (최초 1회): npx playwright install chromium
//   3. 환경변수 또는 .env.capture:
//        BAL24_BASE_URL = https://bal24-workflow-v2.netlify.app  (또는 http://localhost:5173)
//        BAL24_EMAIL    = park8451@gmail.com
//        BAL24_PASSWORD = (admin 비밀번호)
//   4. 실행:                      node scripts/capture-screens.mjs
//
// 결과:
//   screenshots/YYYY-MM-DD/01-home.png 같은 형식으로 풀페이지 PNG 저장.
//   외부 토큰 라우트(/my/:token 등)는 자동 skip — 토큰이 사람마다 달라서.

import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// ─── 환경변수 로드 (.env.capture 파일도 지원) ──────────────────
function loadDotEnv() {
  const path = '.env.capture';
  if (!existsSync(path)) return;
  const text = readFileSync(path, 'utf8');
  text.split('\n').forEach((line) => {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
    if (!m) return;
    if (!process.env[m[1]]) process.env[m[1]] = m[2];
  });
}
loadDotEnv();

const BASE_URL = process.env.BAL24_BASE_URL ?? 'https://bal24-workflow-v2.netlify.app';
const EMAIL = process.env.BAL24_EMAIL ?? '';
const PASSWORD = process.env.BAL24_PASSWORD ?? '';

if (!EMAIL || !PASSWORD) {
  console.error('❌ BAL24_EMAIL / BAL24_PASSWORD 환경변수 또는 .env.capture 파일이 필요해요.');
  process.exit(1);
}

// ─── 캡처할 라우트 목록 (인증 필요) ────────────────────────────
// 외부 토큰 라우트(/my/:token 등)는 제외 — 토큰이 사람마다 다르므로 별도 캡처 권장.
const ROUTES = [
  // 운영
  { path: '/home',          label: '01-홈' },
  { path: '/schedule',      label: '02-일정' },
  { path: '/projects',      label: '03-프로젝트' },
  { path: '/consortium',    label: '04-컨소시엄' },
  { path: '/programs',      label: '05-프로그램' },
  { path: '/clients',       label: '06-고객사' },
  { path: '/experts',       label: '07-전문가' },
  { path: '/shares',        label: '08-공유' },
  { path: '/attendance',    label: '09-출석체크' },
  { path: '/certificates',  label: '10-수료증' },
  { path: '/activity-logs', label: '11-일지' },
  { path: '/forms',         label: '12-폼관리' },
  { path: '/applications',  label: '13-신청관리' },
  { path: '/recruit-manage',label: '14-모집공고' },
  { path: '/portals',       label: '15-포털' },

  // 재무
  { path: '/income',        label: '16-수입' },
  { path: '/expense',       label: '17-지출' },
  { path: '/receipts',      label: '18-증빙' },
  { path: '/settlements',   label: '19-정산' },
  { path: '/reports',       label: '20-리포트' },

  // 기타
  { path: '/members',       label: '21-팀원' },
  { path: '/ai',            label: '22-AI' },
];

// ─── 메인 ──────────────────────────────────────────────────────
async function main() {
  const today = new Date().toISOString().slice(0, 10);
  const outDir = join('screenshots', today);
  await mkdir(outDir, { recursive: true });

  console.log(`🚀 BAL24 캡처 시작 — ${BASE_URL}`);
  console.log(`📁 저장 폴더: ${outDir}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2, // 레티나 품질
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
  });
  const page = await context.newPage();

  try {
    // ① 로그인
    console.log('🔑 로그인 중…');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });

    // 이메일 / 비밀번호 input 찾기 (placeholder/type 기반)
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    await emailInput.fill(EMAIL);
    await passwordInput.fill(PASSWORD);

    // 시작하기 / 로그인 버튼 클릭
    const submitButton = page.locator('button[type="submit"], button:has-text("시작하기"), button:has-text("로그인")').first();
    await submitButton.click();

    // 홈으로 이동 대기
    await page.waitForURL(/\/(home|partner-home)/, { timeout: 10000 });
    console.log('✅ 로그인 성공');

    // ② 라우트 순회 + 캡처
    let success = 0;
    let fail = 0;
    for (const route of ROUTES) {
      const url = `${BASE_URL}${route.path}`;
      const file = join(outDir, `${route.label}.png`);
      try {
        process.stdout.write(`  📸 ${route.label.padEnd(20)} `);
        await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
        // 콘텐츠 로드 안정화 (스피너 사라지는 시간)
        await page.waitForTimeout(800);
        await page.screenshot({ path: file, fullPage: true });
        console.log('✓');
        success += 1;
      } catch (err) {
        console.log(`✗ (${err instanceof Error ? err.message.slice(0, 60) : ''})`);
        fail += 1;
      }
    }

    console.log(`\n🎉 완료 — 성공 ${success} / 실패 ${fail}`);
    console.log(`📂 ${outDir}`);
  } catch (err) {
    console.error('❌ 캡처 실패:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main();
