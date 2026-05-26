// bal24 v2 — STEP-CONSORTIUM-FORM-AI-AUTOFILL (박경수님 2026-05-27)
// 컨소시엄 등록 폼 — 파일 업로드 → 텍스트 추출 → Edge Function 호출 → 결과 반환 훅.

import { useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { fileToText, classifyFile } from '../../../lib/fileToText';

export interface AutoFillMember {
  org_name: string;
  role: '총괄' | '참여';
  share_rate: number | null;
  responsibilities: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
}

export interface AutoFillResult {
  name: string | null;
  start_date: string | null;
  end_date: string | null;
  total_budget: number | null;
  description: string | null;
  lead_org_name: string | null;
  operator_name: string | null;
  members: AutoFillMember[];
}

export function useConsortiumAutoFill() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  const analyze = async (file: File): Promise<AutoFillResult | null> => {
    setIsAnalyzing(true);
    setAnalyzeError(null);
    try {
      const kind = classifyFile(file);
      if (kind === 'image') {
        setAnalyzeError('이미지 파일은 아직 지원하지 않아요. PDF·Word·텍스트로 업로드해 주세요.');
        return null;
      }
      if (kind === 'unknown') {
        setAnalyzeError('지원하지 않는 파일 형식이에요. PDF·Word·TXT 로 업로드해 주세요.');
        return null;
      }

      const doc = await fileToText(file);
      if (!doc || !doc.text.trim()) {
        setAnalyzeError('문서에서 텍스트를 추출할 수 없어요.');
        return null;
      }

      const { data, error } = await supabase.functions.invoke('consortium-autofill', {
        body: { documentText: doc.text },
      });
      if (error) {
        console.error('[useConsortiumAutoFill] Edge Function 오류:', error.message);
        setAnalyzeError('AI 분석 중 오류가 발생했어요.');
        return null;
      }
      // Edge Function 이 4xx/5xx 로 응답 시 data 에 error 필드만 들어옴
      if (data && typeof data === 'object' && 'error' in data && typeof (data as { error: unknown }).error === 'string') {
        setAnalyzeError((data as { error: string }).error);
        return null;
      }
      return data as AutoFillResult;
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[useConsortiumAutoFill] 처리 오류:', raw);
      setAnalyzeError(raw || '파일을 처리하는 중 오류가 발생했어요.');
      return null;
    } finally {
      setIsAnalyzing(false);
    }
  };

  return { analyze, isAnalyzing, analyzeError, setAnalyzeError };
}
