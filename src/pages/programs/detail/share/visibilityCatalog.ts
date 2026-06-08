// bal24 v2 — 외부공유 노출 항목 카탈로그 (Stage 3-B-1)
// 박경수님 명세 13 항목 + audience × stage × item 매트릭스.

import type { ShareAudience, ShareItem, ShareStage } from '../../../../types/database';

export const SHARE_ITEM_LABEL: Record<ShareItem, string> = {
  basic_info: '기본정보 (장소·날짜·준비물)',
  curriculum: '커리큘럼',
  instructors: '강사·멘토 정보',
  materials: '교재',
  survey_view: '만족도 확인',
  edit_request: '수정요청 버튼',
  feedback_comments: '의견회신 댓글',
  checkin: '출석체크 링크',
  survey_submit: '만족도 응답',
  outcome_upload: '결과물 업로드',
  invite_response: '초대수락/거절',
  activity_log: '활동일지 작성',
  lecture_certificate: '강의확인서 수령',
  // STEP-TAB-RESTRUCTURE-B — progress 단계 보강
  portal_progress: '고객 포털 (진행현황)',
  mypage: '마이페이지',
  // 박경수님 2026-06-02 STEP-SURVEY-MULTI-TARGET
  survey_response: '설문 응답 (수요조사·만족도 등)',
  // 박경수님 2026-06-02 STEP-SURVEY-RESULTS-B
  survey_results_view: '설문 응답 결과 조회',
  // 박경수님 2026-06-02 CLUB-3
  report_view: '결과보고서 열람',
  // 박경수님 2026-06-02 CLUB-10
  club_dashboard: '동아리 전체 진행률',
  // 박경수님 2026-06-02 MERGE-2
  file_download: '파일 다운로드',
  file_upload: '파일 제출',
  approval: '동의·확인',
  tax_invoice: '세금계산서 요청',
  // 박경수님 2026-06-08 — 공통 게시판
  board: '공통 게시판',
};

// 박경수님 2026-06-02 — 4역할 추가. 기존 3종은 호환 fallback (UI 에서는 숨길 수 있음).
export const SHARE_AUDIENCE_LABEL: Record<ShareAudience, string> = {
  // 기존 3종 (호환)
  client:  '고객(담당자)',
  student: '학생(참여자)',
  expert:  '전문가',
  // 신규 4종 (지원기관·수혜기관·참여팀(개인)·강사/멘토)
  supporter:   '지원기관',
  beneficiary: '수혜기관',
  team:        '참여팀(개인)',
  staff:       '강사/멘토',
};

export const SHARE_STAGE_LABEL: Record<ShareStage, string> = {
  before: '시작 전',
  pre: '사전 (모집·홍보)',
  ready: '준비 (교육 전 안내)',
  progress: '진행 (교육 중)',
  result: '결과 (교육 후)',
};

/** 어떤 단계에 어떤 항목이 노출 가능한지 (코드 hardcoded 매트릭스) */
/** STEP-TAB-RESTRUCTURE-B — progress 단계에 portal_progress / mypage 추가 */
/** 박경수님 2026-06-02 — 4역할 추가 (supporter·beneficiary·team·staff) */
export const STAGE_ITEMS: Record<ShareAudience, Record<ShareStage, ShareItem[]>> = {
  // 기존 3종 (호환)
  client: {
    before: [],
    pre:    ['basic_info', 'curriculum', 'instructors', 'materials'],
    ready:  ['basic_info', 'curriculum', 'instructors', 'materials'],
    progress: ['portal_progress'],
    result: ['survey_view', 'edit_request', 'feedback_comments'],
  },
  student: {
    before: [],
    pre:    [],
    ready:  [],
    progress: ['checkin', 'mypage'],
    result: ['survey_submit', 'outcome_upload'],
  },
  expert: {
    before: [],
    pre:    ['invite_response'],
    ready:  ['invite_response'],
    progress: ['activity_log', 'mypage'],
    result: ['lecture_certificate'],
  },
  // 신규 4종 — 박경수님 의도 매핑 (운영사·발주처·교육생·강사 시각)
  // 박경수님 2026-06-02 STEP-SURVEY-MULTI-TARGET — 4역할 모두 모든 단계에 survey_response 추가
  // 박경수님 2026-06-02 CLUB-10/MERGE-2 — club_dashboard·file_download·approval·tax_invoice 추가
  // 박경수님 2026-06-02 CLUB-13 — 통상 과정 매트릭스 재정리.
  //   · club_dashboard 는 단계 탭에서 빼고 supporter·beneficiary 페이지 "종합 현황" 으로 상단 고정.
  //   · 세금계산서(tax_invoice) 는 지원기관 업무 → supporter result 로 이동, beneficiary 에서 제거.
  //   · 진행 단계 file_upload(과정 산출물·사진) 는 실제 파일 업로드로 작동.
  supporter: {
    before: ['survey_results_view'],
    pre:    ['basic_info', 'curriculum', 'survey_results_view'],
    ready:  ['basic_info', 'curriculum', 'instructors', 'survey_results_view'],
    // 박경수님 2026-06-07 — 지원기관은 진행 중 프로그램 전반(커리큘럼·출석·산출물) 확인
    progress: ['basic_info', 'curriculum', 'instructors', 'portal_progress', 'checkin', 'outcome_upload', 'report_view', 'survey_results_view'],
    // 박경수님 2026-06-08 — 모든 탭 상단에 기본정보·커리큘럼 노출
    result: ['basic_info', 'curriculum', 'report_view', 'survey_results_view', 'survey_view', 'feedback_comments', 'tax_invoice'],
  },
  beneficiary: {
    before: [],
    // 박경수님 2026-06-08 — 설문(수요조사)은 '준비' 단계에만 노출
    pre:    ['basic_info', 'curriculum', 'instructors', 'materials', 'approval'],
    ready:  ['basic_info', 'curriculum', 'instructors', 'materials', 'survey_response', 'approval'],
    // 박경수님 2026-06-02 CLUB-14 — 학교도 진행 중 강사진·중간보고 확인
    // 박경수님 2026-06-08 — 진행·결과 탭에도 기본정보·커리큘럼 노출 + 설문은 제거(준비에만)
    // 박경수님 2026-06-08 — 멘토 매칭 확정 결과는 진행 단계에서 확인 (survey_results_view)
    progress: ['basic_info', 'curriculum', 'survey_results_view', 'portal_progress', 'instructors', 'report_view', 'feedback_comments', 'file_upload'],
    result: ['basic_info', 'curriculum', 'survey_view', 'edit_request', 'file_upload'],
  },
  team: {
    before: [],
    // 박경수님 2026-06-08 — 설문(수요조사)은 '준비' 단계에만 노출
    pre:    ['basic_info'],
    ready:  ['basic_info', 'survey_response', 'file_download'],
    // 박경수님 2026-06-08 — 진행 단계에서 멘토 매칭 확정 결과 확인
    progress: ['basic_info', 'survey_results_view', 'checkin', 'file_upload'],
    result: ['survey_submit', 'outcome_upload', 'file_upload'],
  },
  staff: {
    before: [],
    pre:    ['invite_response'],
    ready:  ['invite_response', 'curriculum', 'file_download'],
    progress: ['activity_log', 'survey_response', 'file_upload'],
    result: ['lecture_certificate', 'survey_response'],
  },
};

/** 대상별 전체 항목 목록 (관리자 UI 체크박스용) */
export const ITEMS_BY_AUDIENCE: Record<ShareAudience, ShareItem[]> = {
  client: ['basic_info', 'curriculum', 'instructors', 'materials', 'portal_progress', 'survey_view', 'edit_request', 'feedback_comments'],
  student: ['checkin', 'mypage', 'survey_submit', 'outcome_upload'],
  expert: ['invite_response', 'activity_log', 'mypage', 'lecture_certificate'],
  // 박경수님 2026-06-02 CLUB-13 — club_dashboard 는 상단 고정으로 분리(목록 제외), 세금계산서는 지원기관만
  supporter:   ['basic_info', 'curriculum', 'instructors', 'portal_progress', 'checkin', 'outcome_upload', 'survey_view', 'feedback_comments', 'survey_results_view', 'report_view', 'tax_invoice'],
  beneficiary: ['basic_info', 'curriculum', 'instructors', 'materials', 'portal_progress', 'survey_view', 'edit_request', 'feedback_comments', 'survey_response', 'file_download', 'file_upload', 'approval'],
  team:        ['basic_info', 'checkin', 'survey_submit', 'outcome_upload', 'survey_response', 'file_download', 'file_upload'],
  staff:       ['invite_response', 'curriculum', 'activity_log', 'lecture_certificate', 'survey_response', 'file_download', 'file_upload'],
};

/** 대상×단계 매트릭스 헤더 (UI 안내용) */
export const STAGE_TIPS: Record<ShareAudience, Record<ShareStage, string>> = {
  // 기존 3종 (호환)
  client: {
    before: '시작 전엔 노출 안 됨',
    pre: '사전·준비 단계에서 노출',
    ready: '사전·준비 단계에서 노출',
    progress: '진행 중 고객 포털에서 진행현황 확인',
    result: '결과 단계에서 노출',
  },
  student: {
    before: '시작 전엔 노출 안 됨',
    pre: '사전엔 노출 없음',
    ready: '준비엔 노출 없음',
    progress: '진행 중 출석체크 링크 노출',
    result: '결과 단계에서 응답·업로드',
  },
  expert: {
    before: '시작 전엔 노출 안 됨',
    pre: '사전부터 초대수락/거절 가능',
    ready: '준비 중에도 응답 가능',
    progress: '진행 중 활동일지 작성',
    result: '결과 단계에서 강의확인서',
  },
  // 박경수님 2026-06-02 — 신규 4종
  supporter: {
    before: '시작 전엔 노출 안 됨',
    pre: '사전·준비 단계 안내',
    ready: '강사 정보 추가 노출',
    progress: '진행 현황 확인',
    result: '만족도·의견 확인',
  },
  beneficiary: {
    before: '시작 전엔 노출 안 됨',
    pre: '사전·준비 단계 안내',
    ready: '교재·강사 정보 노출',
    progress: '진행 현황 + 의견 회신',
    result: '만족도·수정 요청 가능',
  },
  team: {
    before: '시작 전엔 노출 안 됨',
    pre: '사전엔 노출 없음',
    ready: '기본 정보 확인',
    progress: '진행 중 출석·마이페이지',
    result: '결과 단계에서 응답·업로드',
  },
  staff: {
    before: '시작 전엔 노출 안 됨',
    pre: '사전부터 초대수락/거절',
    ready: '커리큘럼 사전 확인',
    progress: '진행 중 활동일지·마이페이지',
    result: '결과 단계에서 강의확인서',
  },
};
