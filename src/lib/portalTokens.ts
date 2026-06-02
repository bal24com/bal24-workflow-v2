// 박경수님 2026-05-30 STEP-PORTAL-BULK-REGISTER — 포털 토큰·PIN 생성 공용 유틸.

/** 기관별 고유 접근 토큰 (UUID v4). */
export function generateToken(): string {
  return crypto.randomUUID();
}

/** 4자리 숫자 PIN. */
export function generatePin(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}
