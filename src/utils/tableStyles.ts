// 표 밀착 디자인 공통 스타일 — 박경수님 + SkyClaw STEP-TABLE-COMPACT-REDESIGN (2026-05-28)
// 견적 표·외주/급여 표·강사 포털 표 등에서 공용. 행 하단선 + 짝수 행 옅은 배경.

/** 행 베이스 — 하단선 + hover */
export const TR_BASE = 'border-b border-slate-100 transition-colors hover:bg-violet-50/30';
/** 홀수 행 (인덱스 0 부터 짝수번째 시각적 위치) */
export const TR_ODD  = 'bg-white';
/** 짝수 행 — 옅은 슬레이트 배경 */
export const TR_EVEN = 'bg-slate-50/60';

/** 행 배경 자동 선택 헬퍼 — (인덱스, 선택여부, locked여부) */
export function rowBg(idx: number, opts: { selected?: boolean; locked?: boolean } = {}): string {
  if (opts.locked) return 'bg-emerald-50/30';
  if (opts.selected) return 'bg-violet-50/40';
  return idx % 2 === 0 ? TR_ODD : TR_EVEN;
}

/** 헤더 셀 — 라인만 (보라 배경 X), 슬레이트 텍스트 */
export const TH_BASE = [
  'border-b-2 border-slate-200',
  'py-2 px-3',
  'text-left text-xs font-semibold text-slate-500',
  'whitespace-nowrap bg-white',
].join(' ');

/** 셀 베이스 — py-1.5 컴팩트 */
export const TD_BASE = 'py-1.5 px-2 text-sm align-middle';

/** 인라인 입력 — 테두리 제거, focus 시만 표시 */
export const INPUT_INLINE = [
  'w-full bg-transparent border-0 outline-none',
  'text-sm text-slate-800',
  'py-0.5 px-1 rounded',
  'focus:bg-white focus:ring-1 focus:ring-violet-300 focus:border-violet-400 focus:border',
  'placeholder:text-slate-300',
].join(' ');

/** 숫자 입력 — 오른쪽 정렬 + tabular */
export const INPUT_NUMBER = `${INPUT_INLINE} text-right tabular-nums`;
