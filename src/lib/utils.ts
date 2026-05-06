// bal24 v2 공통 유틸리티

/** className 안전 결합 (조건부 className) */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

/** ISO 날짜 → 한국어 표기 (예: "2026-05-06" → "2026년 5월 6일") */
export function formatDateKo(iso?: string | null): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
  } catch {
    return iso;
  }
}

/** 숫자 → 한국어 금액 표기 (예: 1500000 → "1,500,000원") */
export function formatMoney(n?: number | null): string {
  if (n == null) return '';
  return `${n.toLocaleString('ko-KR')}원`;
}
