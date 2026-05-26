// bal24 v2 — STEP-CONSORTIUM-FORM-AI-AUTOFILL (박경수님 2026-05-27)
// 컨소시엄 등록 폼 — 업로드 문서 텍스트에서 컨소시엄 필드를 AI로 추출.
// mentoring-log-ai 와 같은 esm.sh + std/http 패턴 사용.

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

const SYSTEM_PROMPT = `너는 사업 문서에서 컨소시엄 정보를 추출하는 전문가야.
항상 유효한 JSON만 반환해. 다른 텍스트·코드블록은 절대 포함하지 마.`;

const EXTRACT_PROMPT = (doc: string) => `아래 문서를 분석하여 컨소시엄 등록에 필요한 정보를 JSON 으로 추출해.

[문서 내용]
${doc.slice(0, 8000)}

[추출 규칙]
- 없는 정보는 null 로 반환
- 날짜는 YYYY-MM-DD 형식
- 금액은 숫자만 (원 단위, 쉼표 제거)
- 참여사는 배열로 (최대 10개)
- role 은 반드시 "총괄" 또는 "참여" 둘 중 하나
- share_rate 는 숫자(0~100), 없으면 null

[출력 JSON 형식]
{
  "name": "컨소시엄명 또는 사업명",
  "start_date": "YYYY-MM-DD 또는 null",
  "end_date": "YYYY-MM-DD 또는 null",
  "total_budget": 숫자 또는 null,
  "description": "사업 개요 요약 (목표·배경·기대효과 포함, 300자 이내)",
  "lead_org_name": "주관기관(의뢰기관)명 또는 null",
  "operator_name": "운영사(총괄)명 또는 null",
  "members": [
    {
      "org_name": "참여사명",
      "role": "총괄 또는 참여",
      "share_rate": 숫자 또는 null,
      "responsibilities": "담당업무 또는 null",
      "contact_name": "담당자명 또는 null",
      "contact_phone": "연락처 또는 null",
      "contact_email": "이메일 또는 null"
    }
  ]
}

JSON 만 반환하고 다른 텍스트는 포함하지 마.`;

interface AnthropicResp {
  content: Array<{ type: string; text?: string }>;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { documentText } = (await req.json()) as { documentText?: string };
    if (!documentText || !documentText.trim()) {
      return json({ error: '문서 내용이 비어 있어요.' }, 400);
    }
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      console.error('[consortium-autofill] ANTHROPIC_API_KEY 미등록');
      return json({ error: 'AI 키가 등록되지 않았어요. 관리자에게 문의해 주세요.' }, 500);
    }

    const client = new Anthropic({ apiKey });
    const response = (await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: EXTRACT_PROMPT(documentText) }],
    })) as AnthropicResp;

    const block = response.content[0];
    if (!block || block.type !== 'text' || !block.text) {
      return json({ error: 'AI 응답 형식이 올바르지 않아요.' }, 502);
    }

    const match = block.text.match(/\{[\s\S]*\}/);
    if (!match) {
      console.error('[consortium-autofill] JSON 추출 실패:', block.text.slice(0, 200));
      return json({ error: 'AI 응답을 해석할 수 없어요.' }, 502);
    }

    let extracted: unknown;
    try {
      extracted = JSON.parse(match[0]);
    } catch (parseErr) {
      const raw = parseErr instanceof Error ? parseErr.message : '';
      console.error('[consortium-autofill] JSON parse 실패:', raw);
      return json({ error: 'AI 응답 형식이 올바르지 않아요.' }, 502);
    }

    return json(extracted, 200);
  } catch (err) {
    const raw = err instanceof Error ? err.message : '';
    console.error('[consortium-autofill] 오류:', raw);
    return json({ error: '문서 분석 중 오류가 발생했어요.' }, 500);
  }
});
