// bal24 v2 — programs.modules ↔ ProgramDetailPage 탭 매핑 + 동적 계산 (STEP-PROGRAM-MODULE-RENDER)
// modules 배열을 받아 표시할 탭 목록 + placeholder 여부를 결정한다.

/** ProgramDetailPage 의 기존 TabKey 와 동일하게 유지 */
export type TabKey =
  | 'overview' | 'curriculum' | 'staff' | 'attendance'
  | 'survey'   | 'files'      | 'report' | 'share'
  | 'mentoring';

/**
 * module ID → TabKey 매핑.
 * - 같은 탭으로 매핑되는 모듈 (alias): participants → staff (Q6-A)
 * - 미구현 모듈 → null (탭은 표시하되 placeholder 본문)
 */
export const MODULE_TO_TAB: Record<string, TabKey | null> = {
  overview:                'overview',
  files:                   'files',
  report:                  'report',
  curriculum:              'curriculum',
  staff:                   'staff',
  participants:            'staff',     // Q6-A: staff alias
  attendance:              'attendance',
  survey:                  'survey',
  mentoring:               'mentoring', // STEP-MENTORING: 실제 탭 구현 완료
  // 미구현 (placeholder 표시)
  domestic_travel:         null,
  flight:                  null,
  overseas_travel:         null,
  event_schedule:          null,
  promotion:               null,
  checklist:               null,
  recruitment:             null,
  seller:                  null,
  booth:                   null,
  experience:              null,
  sns:                     null,
  content_plan:            null,
  deliverable:             null,
  approval:                null,
  environment_analysis:    null,
  demand_survey:           null,
  feasibility:             null,
  community_participation: null,
  field_management:        null,
};

/** 미구현 모듈을 탭으로 표시할 때 보여줄 한글 라벨 */
export const MODULE_LABEL: Record<string, string> = {
  domestic_travel:         '국내 이동',
  flight:                  '항공',
  overseas_travel:         '해외 이동',
  event_schedule:          '행사 일정',
  promotion:               '홍보물',
  checklist:               '체크리스트',
  recruitment:             '모집·선발',
  seller:                  '셀러',
  booth:                   '부스',
  experience:              '체험',
  sns:                     'SNS',
  content_plan:            '콘텐츠 계획',
  deliverable:             '산출물',
  approval:                '발주처 승인',
  environment_analysis:    '환경 분석',
  demand_survey:           '수요조사',
  feasibility:             '타당성 검토',
  community_participation: '주민참여',
  field_management:        '현장관리',
};

/** Q3-A: overview·files 는 modules 와 무관하게 항상 표시 */
export const ALWAYS_VISIBLE_TABS: TabKey[] = ['overview', 'files'];

/** share 탭은 modules 와 무관하게 항상 마지막 슬롯 (외부 공유 PM 도구) */
export const SHARE_TAB_ALWAYS = true;

export interface VisibleTab {
  /** 구현된 탭은 TabKey, 미구현 placeholder 는 module ID 문자열 */
  key: TabKey | string;
  label: string;
  /** true 면 본문에 "준비 중" UI 표시 */
  isPlaceholder: boolean;
}

const TAB_LABELS: Record<TabKey, string> = {
  overview:   '개요',
  curriculum: '커리큘럼',
  staff:      '강사·교육생',
  attendance: '출석·일지',
  survey:     '결과·만족도',
  files:      '파일',
  report:     '결과보고서',
  share:      '외부 공유',
  mentoring:  '멘토링',
};

export function getTabLabel(key: TabKey): string {
  return TAB_LABELS[key];
}

/**
 * programs.modules 배열을 받아 표시할 탭 목록을 반환한다.
 *
 * Q1-B: modules 가 null/빈 배열 → 모든 탭 표시 (전체 가시성)
 * Q2-B: 고정 순서 (FIXED_ORDER) + modules 에 없는 것만 숨김
 * Q3-A: overview·files 항상 표시 (modules 무관)
 * Q4-A: 미구현 모듈도 탭 표시 (placeholder)
 *
 * 주의: share 탭은 이 함수 결과에 포함되지 않는다 (호출자가 별도 추가).
 */
export function resolveVisibleTabs(modules: string[] | null | undefined): VisibleTab[] {
  const showAll = !modules || modules.length === 0;

  // 고정 순서 — share 는 호출자가 별도 처리
  const FIXED_ORDER: TabKey[] = [
    'overview', 'curriculum', 'staff', 'attendance', 'mentoring', 'survey', 'report', 'files',
  ];

  const result: VisibleTab[] = [];

  // 1) 고정 순서 탭 처리 (구현된 탭만)
  for (const tabKey of FIXED_ORDER) {
    const isAlways = ALWAYS_VISIBLE_TABS.includes(tabKey);
    if (showAll || isAlways) {
      result.push({ key: tabKey, label: TAB_LABELS[tabKey], isPlaceholder: false });
      continue;
    }
    const hasModule = modules!.some((m) => MODULE_TO_TAB[m] === tabKey);
    if (hasModule) {
      result.push({ key: tabKey, label: TAB_LABELS[tabKey], isPlaceholder: false });
    }
  }

  // 2) 미구현 모듈 placeholder 탭 추가 (showAll 모드는 placeholder 미표시 — 노이즈 방지)
  if (!showAll) {
    for (const moduleId of modules!) {
      const mappedTab = MODULE_TO_TAB[moduleId];
      if (mappedTab === null && MODULE_LABEL[moduleId]) {
        const alreadyAdded = result.some((t) => t.key === moduleId);
        if (!alreadyAdded) {
          result.push({ key: moduleId, label: MODULE_LABEL[moduleId], isPlaceholder: true });
        }
      }
    }
  }

  return result;
}
