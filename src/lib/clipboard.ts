// bal24 v2 — 클립보드 복사 공통 유틸
// 1차: navigator.clipboard.writeText (HTTPS·focus·permission 필요)
// 2차: document.execCommand('copy') fallback (HTTP·iframe·권한 미허용 환경)
// 3차: 둘 다 실패하면 false 반환 — 호출부에서 사용자 안내 처리

export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;

  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    const raw = err instanceof Error ? err.message : '';
    console.error('[clipboard] navigator.clipboard 실패 → execCommand fallback:', raw);
  }

  try {
    const el = document.createElement('textarea');
    el.value = text;
    el.setAttribute('readonly', '');
    el.style.position = 'fixed';
    el.style.top = '0';
    el.style.left = '0';
    el.style.opacity = '0';
    el.style.pointerEvents = 'none';
    document.body.appendChild(el);
    el.focus();
    el.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(el);
    return ok;
  } catch (err) {
    const raw = err instanceof Error ? err.message : '';
    console.error('[clipboard] execCommand fallback 실패:', raw);
    return false;
  }
}
