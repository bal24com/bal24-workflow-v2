// bal24 v2 — STEP-V9-QUICKWIN QW-4 (박경수님 2026-05-28)
// 일지 AI 초안 생성 범용 버튼 — 멘토링·강의 일지 공용.
// Edge Function 이름 + 페이로드 + 콜백만 받아 어디서든 재사용 가능.

import { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';

interface Props {
  /** 호출할 Supabase Edge Function 이름. 예: 'mentoring-log-ai' | 'curriculum-log-ai' */
  edgeFunctionName: string;
  /** Edge Function 에 보낼 JSON payload. */
  payload: Record<string, unknown>;
  /** 응답 draft 텍스트를 부모 폼에 주입할 콜백. */
  onDraftGenerated: (draft: string) => void;
  /** 버튼 라벨. 기본값 "✨ AI 초안". */
  label?: string;
  /** 외부에서 비활성화 (저장 중 등). */
  disabled?: boolean;
  /** 응답 JSON 안의 텍스트 필드명. 기본 'draft' (mentoring-log-ai 는 'content' 이라 별도 지정). */
  responseField?: string;
}

export default function AiDraftButton({
  edgeFunctionName, payload, onDraftGenerated,
  label = '✨ AI 초안', disabled, responseField = 'draft',
}: Props) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  async function handleGenerate() {
    if (loading || disabled) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(edgeFunctionName, {
        body: payload,
      });
      if (error) {
        console.error('[AiDraftButton] Edge Function 오류:', error);
        toast.error('AI 초안 생성 중 오류가 발생했어요.');
        return;
      }
      const result = (data ?? {}) as Record<string, unknown>;
      const text = (result[responseField] as string) ?? '';
      if (!text.trim()) {
        toast.error('AI 가 빈 결과를 반환했어요. 다시 시도해 주세요.');
        return;
      }
      onDraftGenerated(text);
      toast.success('AI 초안이 생성됐어요.');
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[AiDraftButton] 예외:', raw);
      toast.error('AI 초안 생성 중 오류가 발생했어요.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleGenerate()}
      disabled={loading || disabled}
      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-violet-200
                 bg-violet-100 text-violet-700 text-xs font-semibold
                 hover:bg-violet-200 disabled:opacity-50 transition-colors"
    >
      {loading ? (
        <>
          <Loader2 size={11} className="animate-spin" aria-hidden="true" />
          생성 중…
        </>
      ) : (
        <>
          <Sparkles size={11} aria-hidden="true" />
          {label}
        </>
      )}
    </button>
  );
}
