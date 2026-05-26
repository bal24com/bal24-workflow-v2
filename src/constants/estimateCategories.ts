// 견적 및 외주·급여 공통 카테고리 상수 — 박경수님 + SkyClaw STEP-ESTIMATE-UPGRADE-FULL (2026-05-28)
// 4종 표준화 (자유 입력에서 변환): 인건비 / 운영비 / 숙식 및 임차 / 기타

export const ESTIMATE_CATEGORIES = [
  '인건비',
  '운영비',
  '숙식 및 임차',
  '기타',
] as const;
export type EstimateCategory = typeof ESTIMATE_CATEGORIES[number];

/** 카테고리 아이콘 (UI 표시용) */
export const CATEGORY_ICON: Record<EstimateCategory, string> = {
  '인건비':       '👤',
  '운영비':       '📦',
  '숙식 및 임차': '🏨',
  '기타':         '📎',
};

/** 외주·급여 expense_category 동일 값 사용 (aliased) */
export const EXPENSE_CATEGORIES = ESTIMATE_CATEGORIES;
export type ExpenseCategory = EstimateCategory;

/** 자유 입력 한글 → 표준 4종 매핑 (마이그레이션·런타임 폴백 공용) */
export function normalizeCategory(raw: string | null | undefined): EstimateCategory {
  if (!raw) return '기타';
  const t = raw.trim().toLowerCase();
  // 인건비 키워드 (isPersonCategory 기존 패턴 유지)
  if (/(인건비|강사|멘토|운영진|ta|튜터|컨설|촬영|외주)/i.test(t)) return '인건비';
  // 숙식·임차 키워드
  if (/(숙식|숙박|식대|임차|대관|장소|장비대여)/i.test(t)) return '숙식 및 임차';
  // 운영비 키워드 (isOperationType 기존 패턴 + 일반 운영)
  if (/(운영비|운영인건비|버스|교통|재료|소모품|인쇄|디자인|홍보|광고)/i.test(t)) return '운영비';
  // 명시적으로 4종 중 하나면 그대로
  if ((ESTIMATE_CATEGORIES as readonly string[]).includes(raw)) return raw as EstimateCategory;
  return '기타';
}
