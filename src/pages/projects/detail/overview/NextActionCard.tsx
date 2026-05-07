// bal24 v2 — 프로젝트 개요 · 다음 행동 안내 (V7 AI 다음 행동 패널의 정적 버전)
// status 4종 분기. callClaude 호출 X — STEP-AI-PREP 완료 후 동적 안내로 전환 예정.

import { Sparkles } from 'lucide-react';
import type { ProjectStatus } from '../../../../types/database';

const STAGE_TIPS: Record<ProjectStatus, string[]> = {
  제안: [
    '계약 전 영업·제안서 작성 단계',
    '거래처 정보·담당자 등록 (고객사 메뉴)',
    '제안서·견적서 초안 준비',
    '담당자(PM)·참여 인력 가배정',
  ],
  진행: [
    '계약 체결 후 실행 단계',
    '태스크 등록·담당자 배정',
    '주요 일정·미팅 캘린더 등록',
    '프로그램(교육·캠프·행사) 운영 시작',
  ],
  정산: [
    '결과 정리·정산 단계',
    '지출 집행·세금계산서 발행 점검',
    '결과보고서 초안 작성',
    '잔여 미지급 항목 확인',
  ],
  종료: [
    '프로젝트 클로즈',
    '모든 정산·증빙 마감 확인',
    '최종 결과보고서 검토·발송',
    '교훈 정리 (다음 유사 프로젝트 참고)',
  ],
};

export default function NextActionCard({ status }: { status: ProjectStatus }) {
  const tips = STAGE_TIPS[status];

  return (
    <section className="rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50/40 to-orange-50/40 p-5 shadow-[0_4px_16px_rgba(124,58,237,0.06)] flex flex-col gap-2.5">
      <header className="flex items-center gap-1.5">
        <Sparkles size={16} className="text-violet-500" aria-hidden="true" />
        <h3 className="text-sm font-bold text-[#1E1B4B]">다음 행동 안내</h3>
      </header>

      <ul className="flex flex-col gap-1.5">
        {tips.map((t, i) => (
          <li
            key={t}
            className={`flex items-start gap-1.5 text-[11px] leading-relaxed ${
              i === 0 ? 'font-bold text-[#1E1B4B]' : 'text-slate-600'
            }`}
          >
            <span aria-hidden="true" className="text-violet-400 shrink-0">
              {i === 0 ? '📌' : '·'}
            </span>
            <span className="flex-1">{t}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
