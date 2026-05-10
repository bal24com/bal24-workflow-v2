// bal24 v2 — 프로젝트 다음 행동 안내 (Stage AI-②)
// status 4종 정적 가이드 + AI 추천 버튼 (next-action preset, Haiku 4.5)

import { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { supabase } from '../../../../lib/supabase';
import { useToast } from '../../../../contexts/ToastContext';
import type { ProjectStatus } from '../../../../types/database';

const STAGE_TIPS: Record<ProjectStatus, string[]> = {
  제안: [
    '계약 전 영업·제안서 작성 단계',
    '주관기관 정보·담당자 등록 (고객사 메뉴)',
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
  const toast = useToast();
  const tips = STAGE_TIPS[status];
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);

  async function handleAiClick() {
    setAiLoading(true);
    setAiResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: {
          preset: 'next-action',
          messages: [
            {
              role: 'user',
              content: `현재 프로젝트 상태는 "${status}" 단계입니다. 이 단계에서 우선 처리해야 할 행동 3~5가지를 번호 목록으로 간결하게 안내해 주세요.`,
            },
          ],
        },
      });
      if (error) throw new Error(error.message);
      const body = data as { ok?: boolean; text?: string; error?: string } | null;
      if (!body?.ok) throw new Error(body?.error ?? 'AI 오류');
      setAiResult(body.text ?? '');
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[next-action] AI 호출 실패:', raw);
      toast.error('AI 추천 생성에 실패했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <section className="rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50/40 to-orange-50/40 p-5 shadow-[0_4px_16px_rgba(124,58,237,0.06)] flex flex-col gap-2.5">
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Sparkles size={16} className="text-violet-500" aria-hidden="true" />
          <h3 className="text-sm font-bold text-[#1E1B4B]">다음 행동 안내</h3>
        </div>
        <button
          type="button"
          onClick={() => void handleAiClick()}
          disabled={aiLoading}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-violet-100 bg-violet-50/60 text-[11px] font-semibold text-violet-700 hover:bg-violet-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {aiLoading
            ? <Loader2 size={10} className="animate-spin" aria-hidden="true" />
            : <Sparkles size={10} aria-hidden="true" />}
          {aiLoading ? 'AI 분석 중…' : 'AI 추천'}
        </button>
      </header>

      {aiResult ? (
        <div className="flex flex-col gap-2">
          <div className="rounded-xl bg-white border border-violet-100 p-3 text-[11px] text-slate-700 whitespace-pre-wrap leading-relaxed">
            {aiResult}
          </div>
          <button
            type="button"
            onClick={() => setAiResult(null)}
            className="self-end text-[10px] text-slate-400 hover:text-slate-600 transition-colors"
          >
            닫기
          </button>
        </div>
      ) : (
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
      )}
    </section>
  );
}
