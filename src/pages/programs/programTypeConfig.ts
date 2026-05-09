// bal24 v2 — 프로그램 유형 14종 상수 + 이모지·컬러·설명
// STEP-PROGRAM-TYPE-TS: 한글 → 영문 enum 마이그레이션. 한글 라벨은 PROGRAM_TYPE_LABELS 매핑.

import { PROGRAM_TYPE_VALUES, PROGRAM_TYPE_LABELS } from '../../constants/programTypes';
import type { ProgramTypeKey } from '../../constants/programTypes';

export { PROGRAM_TYPE_VALUES as PROGRAM_TYPES };
export type ExtendedProgramType = ProgramTypeKey;

export interface ProgramTypeConfig {
  type: ExtendedProgramType;
  /** 한글 라벨 (PROGRAM_TYPE_LABELS 매핑) */
  label: string;
  emoji: string;
  color: string;       // Tailwind border + bg 클래스
  description: string; // 드롭다운 카드 설명
}

export const PROGRAM_TYPE_CONFIG: ProgramTypeConfig[] = [
  { type: 'education',    label: PROGRAM_TYPE_LABELS.education,    emoji: '📚', color: 'border-violet-300 bg-violet-50',   description: '커리큘럼·강사·출석·만족도' },
  { type: 'support_grant',label: PROGRAM_TYPE_LABELS.support_grant,emoji: '💰', color: 'border-amber-300 bg-amber-50',     description: '지원금·보조금 평가형 선발' },
  { type: 'mentoring',    label: PROGRAM_TYPE_LABELS.mentoring,    emoji: '🤝', color: 'border-cyan-300 bg-cyan-50',       description: '멘토 매칭·세션·제출물·피드백' },
  { type: 'event',        label: PROGRAM_TYPE_LABELS.event,        emoji: '🎉', color: 'border-orange-300 bg-orange-50',   description: '행사 일정·출연진·홍보·체크리스트' },
  { type: 'experience',   label: PROGRAM_TYPE_LABELS.experience,   emoji: '🎨', color: 'border-pink-300 bg-pink-50',       description: '체험 프로그램·예약·참가자' },
  { type: 'market',       label: PROGRAM_TYPE_LABELS.market,       emoji: '🛍', color: 'border-yellow-300 bg-yellow-50',  description: '셀러·부스·운영실적' },
  { type: 'marketing',    label: PROGRAM_TYPE_LABELS.marketing,    emoji: '📱', color: 'border-sky-300 bg-sky-50',         description: 'SNS·콘텐츠 계획·발행실적' },
  { type: 'delivery',     label: PROGRAM_TYPE_LABELS.delivery,     emoji: '📦', color: 'border-gray-300 bg-gray-50',       description: '산출물·버전관리·발주처 승인' },
  { type: 'planning',     label: PROGRAM_TYPE_LABELS.planning,     emoji: '📋', color: 'border-indigo-300 bg-indigo-50',   description: '과업목록·산출물·회의록' },
  { type: 'recruitment',  label: PROGRAM_TYPE_LABELS.recruitment,  emoji: '📝', color: 'border-emerald-300 bg-emerald-50', description: '지원서·선발·결과' },
  { type: 'fieldwork',    label: PROGRAM_TYPE_LABELS.fieldwork,    emoji: '✈️', color: 'border-blue-300 bg-blue-50',       description: '국내이동·항공·해외이동' },
  { type: 'report',       label: PROGRAM_TYPE_LABELS.report,       emoji: '📊', color: 'border-green-300 bg-green-50',     description: '보고서·증빙·성과품' },
  { type: 'research',     label: PROGRAM_TYPE_LABELS.research,     emoji: '🔍', color: 'border-blue-300 bg-blue-50',       description: '환경분석·수요조사·타당성검토' },
  { type: 'general',      label: PROGRAM_TYPE_LABELS.general,      emoji: '⚙️', color: 'border-slate-300 bg-slate-50',     description: '기본 탭 구성' },
];

const FALLBACK = PROGRAM_TYPE_CONFIG[PROGRAM_TYPE_CONFIG.length - 1];

/** 유형 키로 이모지·컬러·설명 조회. 미매칭 시 'general' 반환. */
export function getProgramTypeConfig(type: string | null | undefined): ProgramTypeConfig {
  if (!type) return FALLBACK;
  return PROGRAM_TYPE_CONFIG.find((c) => c.type === type) ?? FALLBACK;
}

/** 모듈 옵션 — ProgramTemplateSelector 의 체크박스 목록 */
export const MODULE_OPTIONS = [
  { id: 'overview',               label: '개요' },
  { id: 'participants',           label: '참여자' },
  { id: 'files',                  label: '파일' },
  { id: 'report',                 label: '결과보고서' },
  { id: 'curriculum',             label: '커리큘럼' },
  { id: 'staff',                  label: '강사' },
  { id: 'attendance',             label: '출석·일지' },
  { id: 'survey',                 label: '만족도' },
  { id: 'mentoring',              label: '멘토링' },
  { id: 'domestic_travel',        label: '국내 이동' },
  { id: 'flight',                 label: '항공·탑승수속' },
  { id: 'overseas_travel',        label: '해외 이동' },
  { id: 'event_schedule',         label: '행사 일정' },
  { id: 'promotion',              label: '홍보물' },
  { id: 'checklist',              label: '운영 체크리스트' },
  { id: 'recruitment',            label: '모집·선발' },
  { id: 'seller',                 label: '셀러 관리' },
  { id: 'booth',                  label: '부스 배치' },
  { id: 'experience',             label: '체험 프로그램' },
  { id: 'sns',                    label: 'SNS 운영' },
  { id: 'content_plan',           label: '콘텐츠 계획' },
  { id: 'deliverable',            label: '산출물' },
  { id: 'approval',               label: '발주처 승인' },
  { id: 'environment_analysis',   label: '환경·여건 분석' },
  { id: 'demand_survey',          label: '수요조사·설문' },
  { id: 'feasibility',            label: '타당성 검토' },
  { id: 'community_participation', label: '주민참여' },
  { id: 'field_management',       label: '현장관리' },
] as const;

export type ModuleId = typeof MODULE_OPTIONS[number]['id'];

export function getModuleLabel(id: string): string {
  return MODULE_OPTIONS.find((m) => m.id === id)?.label ?? id;
}
