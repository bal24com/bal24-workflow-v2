// bal24 v2 — AI 응답 처리 공용 유틸 (V7 차용 + V2 표준)

/**
 * AI 응답에서 JSON 부분만 추출.
 * - ```json … ``` 펜스 우선
 * - 없으면 첫 { 부터 마지막 } 까지
 * - 둘 다 실패 시 null
 */
export function extractJson<T = unknown>(text: string): T | null {
  if (!text) return null;
  // 1) 코드 펜스
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim()) as T;
    } catch {
      // continue
    }
  }
  // 2) 첫 { 부터 마지막 } 또는 [ ... ]
  const trimmed = text.trim();
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      return JSON.parse(trimmed) as T;
    } catch {
      // continue
    }
  }
  // 3) 중괄호 검색
  const objMatch = text.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try {
      return JSON.parse(objMatch[0]) as T;
    } catch {
      // continue
    }
  }
  // 4) 대괄호 검색
  const arrMatch = text.match(/\[[\s\S]*\]/);
  if (arrMatch) {
    try {
      return JSON.parse(arrMatch[0]) as T;
    } catch {
      // continue
    }
  }
  return null;
}

/**
 * 큰 텍스트를 chunk 단위로 분할 — 다중 호출 분산용.
 * 줄 경계에서 가능하면 자른다.
 */
export function splitIntoChunks(text: string, chunkSize = 8000): string[] {
  if (!text) return [];
  if (text.length <= chunkSize) return [text];
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    let end = Math.min(i + chunkSize, text.length);
    // 마지막이 아닌 경우 줄바꿈에 맞춰 자르기
    if (end < text.length) {
      const slice = text.slice(i, end);
      const lastNewline = slice.lastIndexOf('\n');
      if (lastNewline > chunkSize * 0.6) {
        end = i + lastNewline;
      }
    }
    chunks.push(text.slice(i, end));
    i = end;
  }
  return chunks;
}
