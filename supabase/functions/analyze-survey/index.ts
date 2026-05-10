// bal24 v2 — STEP-CURRICULUM-ATTEND-SURVEY-FULL
// 클라이언트에서 파싱한 엑셀(rows)을 받아 집계 후 satisfaction_surveys INSERT
// 입력: { program_id, file_name, file_url, rows: Record<string, string|number>[] }
// 출력: { total_count, avg_overall, summary_json, comments }

// @ts-nocheck — Deno Edge Function (Node 타입과 격리)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SCORE_MAP: Record<string, number> = {
  '매우 만족': 5, '만족': 4, '보통': 3, '불만족': 2, '매우 불만족': 1,
  '매우 그렇다': 5, '그렇다': 4, '보통이다': 3, '아니다': 2, '전혀 아니다': 1,
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
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

    // 열별 평균 (숫자 열만, '타임스탬프'/'timestamp' 제외)
    const summary_json: Record<string, number> = {};
    const columns = Object.keys(rows[0] ?? {}).filter((c) => {
      const lower = c.toLowerCase();
      return !lower.includes('타임스탬프') && !lower.includes('timestamp');
    });
    for (const col of columns) {
      const vals = numericRows.map((r) => r[col]).filter((v) => typeof v === 'number') as number[];
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

    // DB 저장
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const { error } = await supabase.from('satisfaction_surveys').insert({
      program_id, file_name, file_url,
      total_count: rows.length, avg_overall,
      summary_json, comments,
    });
    if (error) {
      console.error('[analyze-survey] insert 실패:', error.message);
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({
      total_count: rows.length, avg_overall, summary_json, comments,
    }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '알 수 없는 오류';
    console.error('[analyze-survey] 예외:', msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
});
