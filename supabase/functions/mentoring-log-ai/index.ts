// bal24 v2 — STEP-PORTAL-MULTI-FIX PART F (박경수님 2026-05-26)
// 멘토링 일지 AI 자동 생성 Edge Function.
// 파일 업로드(이미지/PDF/문서/텍스트) → 텍스트 추출 → Claude API → 일지 본문 생성.

// @ts-expect-error — Deno 런타임 전용
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
// @ts-expect-error — esm.sh URL import
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.27.0';

declare const Deno: { env: { get: (key: string) => string | undefined } };

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SYSTEM_PROMPT = `당신은 교육 멘토링 전문가입니다.
업로드된 파일(발표자료·사업계획서·메모·이미지 등)을 분석하여
멘토링 상담일지 형식에 맞는 본문을 한국어로 작성합니다.

출력 형식:
- 주제: (한 줄)
- 멘토링 내용:
  □ 핵심 피드백 1
  □ 핵심 피드백 2
  - 세부 내용 또는 근거
- 다음 단계 제안:
  □ 액션 아이템 1
  □ 액션 아이템 2

원칙:
- 간결하고 실무적 (500~800자)
- 추측은 최소화하고 파일에 명시된 내용 우선
- 박경수님 양식의 "주제" / "멘토링 내용" / "다음 멘토링 계획" 채울 수 있도록 구분`;

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const menteeName = (formData.get('mentee_name') as string) || '';
    const programTitle = (formData.get('program_title') as string) || '';
    const sessionCount = (formData.get('session_count') as string) || '1';

    if (!file) {
      return json({ error: '파일을 업로드해 주세요.' }, 400);
    }
    if (file.size > 10 * 1024 * 1024) {
      return json({ error: '파일 크기는 10MB 이하만 처리할 수 있어요.' }, 400);
    }

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      console.error('[mentoring-log-ai] ANTHROPIC_API_KEY 미설정');
      return json({ error: 'AI 키가 등록되지 않았어요. 담당 PM 에게 ANTHROPIC_API_KEY 등록 요청 부탁드려요.' }, 500);
    }
    const client = new Anthropic({ apiKey });

    const isImage = file.type.startsWith('image/');
    let userContent: unknown;

    if (isImage) {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      // btoa(String.fromCharCode(...bytes)) 는 큰 파일에서 stack overflow → 청크 처리
      let binary = '';
      const chunkSize = 0x8000;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
      }
      const base64 = btoa(binary);
      userContent = [
        { type: 'text', text: `멘티: ${menteeName} | 프로그램: ${programTitle} | ${sessionCount}회차 멘토링 일지 본문을 작성해 주세요.` },
        { type: 'image', source: { type: 'base64', media_type: file.type, data: base64 } },
      ];
    } else {
      // PDF/Word/텍스트 → text() 시도. PDF 는 텍스트 추출 안 될 수 있음 (안내).
      let fileContent = '';
      try {
        fileContent = await file.text();
      } catch {
        return json({ error: '이 파일 형식은 텍스트로 변환할 수 없어요. 이미지(png/jpg) 또는 텍스트(.txt/.md) 파일로 다시 시도해 주세요.' }, 400);
      }
      const truncated = fileContent.slice(0, 6000);
      userContent = `파일 내용:\n${truncated}\n\n멘티: ${menteeName} | 프로그램: ${programTitle} | ${sessionCount}회차 멘토링 일지 본문을 작성해 주세요.`;
    }

    const response = await client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContent as never }],
    });

    type AnthropicBlock = { type: string; text?: string };
    const blocks = response.content as AnthropicBlock[];
    const generated = blocks.find((b) => b.type === 'text')?.text ?? '';

    return json({ content: generated }, 200);
  } catch (err) {
    console.error('[mentoring-log-ai] 예외:', err);
    const msg = err instanceof Error ? err.message : '알 수 없는 오류';
    return json({ error: `AI 생성 중 오류가 발생했어요: ${msg}` }, 500);
  }
});

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
