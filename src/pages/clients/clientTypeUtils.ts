// 기관 유형 상수 및 배지 스타일 정의.
// 박경수님 2026-05-28 STEP-CLIENT-TYPE-TAG — 4종 (주관기관·수혜기관·참여사·거래처).

export const CLIENT_TYPES = ['주관기관', '수혜기관', '참여사', '거래처'] as const;
export type ClientTypeLabel = typeof CLIENT_TYPES[number];

interface BadgeMeta {
  label: ClientTypeLabel;
  className: string;
}

export const CLIENT_TYPE_BADGE: Record<ClientTypeLabel, BadgeMeta> = {
  주관기관: { label: '주관기관', className: 'bg-violet-100 text-violet-700' },
  수혜기관: { label: '수혜기관', className: 'bg-blue-100 text-blue-700' },
  참여사:   { label: '참여사',   className: 'bg-orange-100 text-orange-700' },
  거래처:   { label: '거래처',   className: 'bg-slate-100 text-slate-600' },
};

export function getClientTypeBadge(type: string | null | undefined): BadgeMeta {
  if (!type) return CLIENT_TYPE_BADGE['거래처'];
  return CLIENT_TYPE_BADGE[type as ClientTypeLabel] ?? CLIENT_TYPE_BADGE['거래처'];
}
