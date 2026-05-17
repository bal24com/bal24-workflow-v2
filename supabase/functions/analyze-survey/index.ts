// bal24 v2 — STEP-PROGRAM-UX-B
// 클라이언트에서 파싱한 엑셀(rows)을 받아 집계 + Anthropic AI 종합 분석 후 satisfaction_surveys INSERT
// 입력: { program_id, file_name, file_url, rows: Record<string, string|number>[] }
// 출력: { total_count, avg_overall, summary_json, comments, ai_analysis }

// @ts-nocheck — Deno Edge Function (Node 타입과 격리)

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SCORE_MAP: Record<string, number> = {
  '매우 만족': 5, '만족': 4, '보통': 3, '불만족': 2, '매우 불만족': 1,
  '매우 그렇다': 5, '그렇다': 4, '보통이다': 3, '아니다': 2, '전혀 아니다': 1,
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

interface AiAnalysis {
  overall: string;
  strengths: string[];
  improvements: string[];
  keywords: string[];
  recommendation: string;
}

async function runAiAnalysis(
  averages: Record<string, number>,
  freeTexts: string[],
  apiKey: string,
): Promise<AiAnalysis | null> {
  const prompt = `다음은 교육 프로그램 만족도 조사 결과입니다.

[항목별 평균 점수]
${Object.entries(averages).map(([k, v]) => `- ${k}: ${v.toFixed(2)}점`).join('\n')}

[자유 서술 의견 (상위 20개)]
${freeTexts.slice(0, 20).join('\n')}

위 데이터를 분석하여 다음 항목을 JSON으로 응답하세요.
{
  "overall": "종합 평가 3~5문장",
  "strengths": ["잘된 점1", "잘된 점2", "잘된 점3"],
  "improvements": ["개선점1", "개선점2", "개선점3"],
  "keywords": ["키워드1", "키워드2", "키워드3", "키워드4", "키워드5"],
  "recommendation": "향후 운영 제언 1문단"
}
JSON만 응답하고 마크다운 코드블록 없이 순수 JSON만 반환하세요.`;

  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      console.error('[analyze-survey] Anthropic HTTP', res.status, t);
      return null;
    }
    const data = await res.json() as { content?: Array<{ type: string; text?: string }> };
    const text = data.content?.find((c) => c.type === 'text')?.text ?? '';
    const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    try {
      const parsed = JSON.parse(cleaned) as AiAnalysis;
      if (typeof parsed.overall !== 'string') return null;
      return parsed;
    } catch {
      const i = cleaned.indexOf('{');
      if (i >= 0) {
        try { return JSON.parse(cleaned.slice(i)) as AiAnalysis; } catch { return null; }
      }
      return null;
    }
  } catch (err) {
    console.error('[analyze-survey] AI 호출 실패:', err instanceof Error ? err.message : String(err));
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    // SECURITY-EDGE-FUNCTION-AUTH — 로그인 사용자만 호출 허용 (anon JWT 차단)
    const authHeader = req.headers.get('Authorization') ?? '';
    const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!jwt) {
      return new Response(JSON.stringify({ error: '로그인이 필요해요.' }), { status: 401, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }
    const supaAnon = Deno.env.get('SUPABASE_ANON_KEY');
    const supaUrl = Deno.env.get('SUPABASE_URL');
    if (!supaAnon || !supaUrl) {
      console.error('[analyze-survey] SUPABASE_URL / SUPABASE_ANON_KEY secret 미설정');
      return new Response(JSON.stringify({ error: '서버 설정 오류예요.' }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }
    const authClient = createClient(supaUrl, supaAnon, { global: { headers: { Authorization: `Bearer ${jwt}` } } });
    const { data: userData, error: userErr } = await authClient.auth.getUser(jwt);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: '로그인 인증에 실패했어요.' }), { status: 401, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    const { program_id, file_name, file_url, rows } = await req.json();
    if (!program_id || !Array.isArray(rows) || rows.length === 0) {
      return new Response(JSON.stringify({ error: '응답 데이터가 비어 있어요.' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    // 한글 점수 텍스트 → 숫자 변환
    const numericRows = (rows as Record<string, string | number>[]).map((row) => {
      const out: Record<string, number | string> = {};
      for (const [k, v] of Object.entries(row)) {
        if (typeof v === 'number') out[k] = v;
        else if (typeof v === 'string' && SCORE_MAP[v.trim()]) out[k] = SCORE_MAP[v.trim()];
        else out[k] = v;
      }
      return out;
    });

    // STEP-SURVEY-FIX — 타임스탬프/응답시간/제출시간 헤더 자동 제외 (한글·영문 변형)
    const TS_KEYWORDS = ['타임스탬프', 'timestamp', '제출 시간', '제출시간', '응답 시간', '응답시간', '작성일', '응답일자', '응답 일자', 'time', 'date'];
    const isTimestampHeader = (c: string): boolean => {
      const lower = c.toLowerCase().trim();
      return TS_KEYWORDS.some((k) => lower.includes(k.toLowerCase()));
    };

    // 열별 평균 (xlsx 원본 컬럼 순서 유지, 1~5 범위 숫자만 집계)
    const summary_json: Record<string, number> = {};
    const columns = Object.keys(rows[0] ?? {}).filter((c) => !isTimestampHeader(c));
    for (const col of columns) {
      const vals = numericRows.map((r) => r[col])
        .filter((v): v is number => typeof v === 'number' && v >= 1 && v <= 5);
      if (vals.length > 0) {
        summary_json[col] = Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100;
      }
    }

    // 전반적 만족도 (열 이름에 '전반' 포함)
    const overallKey = columns.find((c) => c.includes('전반'));
    const avg_overall = overallKey ? (summary_json[overallKey] ?? null) : null;

    // 자유서술 (마지막 열, 비어있지 않은 것만)
    const lastCol = columns[columns.length - 1];
    const isNumericCol = lastCol && Object.prototype.hasOwnProperty.call(summary_json, lastCol);
    const comments: string[] = isNumericCol ? [] : (rows as Record<string, string | number>[])
      .map((r) => r[lastCol])
      .filter((v) => v != null && String(v).trim() && String(v).toLowerCase() !== 'nan')
      .map((v) => String(v).trim());

    // STEP-PROGRAM-UX-B — Anthropic 종합 분석 (실패해도 수치 분석은 정상 반환)
    let ai_analysis: AiAnalysis | null = null;
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (apiKey && Object.keys(summary_json).length > 0) {
      ai_analysis = await runAiAnalysis(summary_json, comments, apiKey);
    } else if (!apiKey) {
      console.warn('[analyze-survey] ANTHROPIC_API_KEY 미설정 — AI 분석 건너뜀');
    }

    // DB 저장
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const { error } = await supabase.from('satisfaction_surveys').insert({
      program_id, file_name, file_url,
      total_count: rows.length, avg_overall,
      summary_json, comments,
      ai_analysis,
      ai_overall: ai_analysis?.overall ?? null,
      ai_analyzed_at: ai_analysis ? new Date().toISOString() : null,
    });
    if (error) {
      console.error('[analyze-survey] insert 실패:', error.message);
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({
      total_count: rows.length, avg_overall, summary_json, comments, ai_analysis,
    }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '알 수 없는 오류';
    console.error('[analyze-survey] 예외:', msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
});
