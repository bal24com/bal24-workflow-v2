// bal24 v2 — STEP-V9-QUICKWIN QW-4 (박경수님 2026-05-28)
// 강의 일지 AI 초안 생성 Edge Function.
// mentoring-log-ai 패턴 복사 + 시스템 프롬프트 교체.
// 입력: { session_title, session_no, keywords?, photo_count? } JSON
// 출력: { draft: "..." }

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

const SYSTEM_PROMPT = `당신은 교육 강사의 강의 일지 초안을 작성하는 AI 어시스턴트입니다.
강의 제목·차시·키워드를 바탕으로 자연스럽고 전문적인 강의 일지 본문을 한국어로 작성하세요.

원칙:
- 500자 내외 (너무 짧지도 길지도 않게)
- 실무적·구체적 (강의 진행 흐름·학생 반응·다음 차시 준비 포함)
- 사실 기반 추측은 최소화, 일반화된 표현 활용
- 마지막에 "[강사 검토 후 보강 필요]" 한 줄 안내 추가 가능

출력 형식: { "draft": "본문 텍스트" } JSON 객체.
부가 설명·이모지 없이 draft 필드만 채워서 반환.`;

interface RequestBody {
  session_title?: string;
  session_no?: number | string;
  session_date?: string;
  keywords?: string;
  photo_count?: number;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = (await req.json()) as RequestBody;
    const sessionTitle = (body.session_title ?? '').trim();
    const sessionNo = body.session_no != null ? String(body.session_no) : '';
    const sessionDate = (body.session_date ?? '').trim();
    const keywords = (body.keywords ?? '').trim();
    const photoCount = body.photo_count ?? 0;

    if (!sessionTitle) {
      return json({ error: '강의 제목이 비어 있어요.' }, 400);
    }

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      console.error('[curriculum-log-ai] ANTHROPIC_API_KEY 미설정');
      return json({
        error: 'AI 키가 등록되지 않았어요. 담당 PM 에게 ANTHROPIC_API_KEY 등록 요청 부탁드려요.',
      }, 500);
    }
    const client = new Anthropic({ apiKey });

    const userPrompt = [
      sessionNo ? `차시: ${sessionNo}차시` : '',
      `강의 제목: ${sessionTitle}`,
      sessionDate ? `강의 날짜: ${sessionDate}` : '',
      keywords ? `키워드: ${keywords}` : '',
      photoCount > 0 ? `첨부 사진: ${photoCount}장 (수업 현장 사진)` : '',
      '',
      '위 정보를 바탕으로 강의 일지 본문(draft)을 작성해 주세요.',
    ].filter(Boolean).join('\n');

    const response = await client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    type AnthropicBlock = { type: string; text?: string };
    const blocks = response.content as AnthropicBlock[];
    const raw = blocks.find((b) => b.type === 'text')?.text ?? '';

    // Claude 가 JSON 으로 잘 안 감싸는 경우 — { "draft": "..." } 파싱 시도, 실패 시 원문 사용.
    let draft = raw.trim();
    const jsonMatch = draft.match(/\{[\s\S]*"draft"\s*:\s*"([\s\S]*?)"\s*\}/);
    if (jsonMatch?.[1]) {
      try {
        const parsed = JSON.parse(draft) as { draft?: string };
        if (parsed?.draft) draft = parsed.draft;
      } catch {
        // JSON 파싱 실패 — regex 그룹 사용
        draft = jsonMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
      }
    }

    return json({ draft }, 200);
  } catch (err) {
    console.error('[curriculum-log-ai] 예외:', err);
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
