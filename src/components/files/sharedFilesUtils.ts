// bal24 v2 — SharedFilesTab 보조 순수 함수

/** 파일명에서 위험 문자 치환 + 60자 제한 (Storage 호환, ASCII 전용) */
export function sanitizeFileName(name: string): string {
  const dot = name.lastIndexOf('.');
  const hasExt = dot > 0 && dot < name.length - 1;
  const rawBase = hasExt ? name.slice(0, dot) : name;
  const rawExt  = hasExt ? name.slice(dot + 1) : '';

  let base = rawBase
    .replace(/[-￿]+/g, '')   // 비ASCII (한글·이모지 등) 제거
    .replace(/[^a-zA-Z0-9_-]+/g, '_')   // 영숫자·_·- 외 → _
    .replace(/([_-])\1+/g, '$1')         // 같은 문자 연속 → 1개로 압축
    .replace(/^[_-]+|[_-]+$/g, '');      // 앞뒤 _ - 제거

  if (!base) base = 'file';

  const ext = rawExt.replace(/[^a-zA-Z0-9]+/g, '');

  const result = ext ? `${base}.${ext}` : base;
  if (result.length <= 60) return result;
  if (ext) {
    const allow = Math.max(1, 60 - ext.length - 1);
    return `${base.slice(0, allow)}.${ext}`;
  }
  return result.slice(0, 60);
}

/** Storage·DB 에러 메시지를 한글 안내로 번역 */
export function translateUploadError(raw: string, bucket: string): string {
  const m = raw.toLowerCase();
  if (m.includes('bucket not found') || m.includes('not_found')) {
    return `파일 저장소(${bucket})가 없어요. Supabase Dashboard에서 버킷을 먼저 만들어 주세요.`;
  }
  if (m.includes('payload too large') || m.includes('exceeded') || m.includes('file size')) {
    return '파일 용량이 너무 커요. (최대 50MB)';
  }
  if (m.includes('mime type') || m.includes('not allowed') || m.includes('invalid_mime_type')) {
    return '지원하지 않는 파일 형식이에요. (PDF·Office·이미지만 가능)';
  }
  if (m.includes('row-level security') || m.includes('permission denied') || m.includes('unauthorized')) {
    return '파일을 올릴 권한이 없어요. RLS 정책을 확인해 주세요.';
  }
  if (m.includes('jwt') || m.includes('expired') || m.includes('invalid token')) {
    return '로그인 세션이 만료됐어요. 다시 로그인해 주세요.';
  }
  if (m.includes('duplicate') || m.includes('already exists')) {
    return '같은 이름의 파일이 이미 있어요. 잠시 후 다시 시도해 주세요.';
  }
  if (m.includes('대상 id가 없어요')) {
    return raw;
  }
  // 마지막 fallback. 진단을 위해 raw 메시지 첫 80자도 함께 노출.
  const detail = raw ? ` (${raw.slice(0, 80)})` : '';
  return `파일 업로드 중 오류가 발생했어요.${detail}`;
}
