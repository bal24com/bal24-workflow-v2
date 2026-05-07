// bal24 v2 — 외부공유 노출 항목 카탈로그 (Stage 3-B-1)
// 박경수님 명세 13 항목 + audience × stage × item 매트릭스.

import type { ShareAudience, ShareItem, ShareStage } from '../../../../types/database';

export const SHARE_ITEM_LABEL: Record<ShareItem, string> = {
  basic_info: '기본정보 (장소·날짜·준비물)',
  curriculum: '커리큘럼',
  instructors: '강사정보',
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
};

export const SHARE_AUDIENCE_LABEL: Record<ShareAudience, string> = {
  client: '고객(담당자)',
  student: '학생(참여자)',
  expert: '전문가',
};

export const SHARE_STAGE_LABEL: Record<ShareStage, string> = {
  before: '시작 전',
  pre: '사전 (모집·홍보)',
  ready: '준비 (교육 전 안내)',
  progress: '진행 (교육 중)',
  result: '결과 (교육 후)',
};

/** 어떤 단계에 어떤 항목이 노출 가능한지 (코드 hardcoded 매트릭스) */
export const STAGE_ITEMS: Record<ShareAudience, Record<ShareStage, ShareItem[]>> = {
  client: {
    before: [],
    pre:    ['basic_info', 'curriculum', 'instructors', 'materials'],
    ready:  ['basic_info', 'curriculum', 'instructors', 'materials'],
    progress: [],
    result: ['survey_view', 'edit_request', 'feedback_comments'],
  },
  student: {
    before: [],
    pre:    [],
    ready:  [],
    progress: ['checkin'],
    result: ['survey_submit', 'outcome_upload'],
  },
  expert: {
    before: [],
    pre:    ['invite_response'],
    ready:  ['invite_response'],
    progress: ['activity_log'],
    result: ['lecture_certificate'],
  },
};

/** 대상별 전체 항목 목록 (관리자 UI 체크박스용) */
export const ITEMS_BY_AUDIENCE: Record<ShareAudience, ShareItem[]> = {
  client: ['basic_info', 'curriculum', 'instructors', 'materials', 'survey_view', 'edit_request', 'feedback_comments'],
  student: ['checkin', 'survey_submit', 'outcome_upload'],
  expert: ['invite_response', 'activity_log', 'lecture_certificate'],
};

/** 대상×단계 매트릭스 헤더 (UI 안내용) */
export const STAGE_TIPS: Record<ShareAudience, Record<ShareStage, string>> = {
  client: {
    before: '시작 전엔 노출 안 됨',
    pre: '사전·준비 단계에서 노출',
    ready: '사전·준비 단계에서 노출',
    progress: '진행 중엔 별도 노출 없음',
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
};
