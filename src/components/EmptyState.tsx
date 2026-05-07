// bal24 v2 — 공통 빈 상태(Empty State) 컴포넌트
// 박경수님 디자인 시스템 통일 패턴 (5xl 이모티콘 + #1E1B4B 시멘틱)
// 단계 2에서 각 페이지 빈 상태에 점진 적용.

import type { ReactNode } from 'react';

interface Props {
  /** 큰 이모티콘 (5xl) */
  emoji: string;
  /** "아직 등록된 X이(가) 없어요." 형태의 한글 메시지 */
  title: string;
  /** 보조 안내 문구 */
  description?: string;
  /** 우측에 표시할 액션 (보통 [+ 등록] 버튼) */
  action?: ReactNode;
}

export default function EmptyState({ emoji, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="text-5xl mb-4" aria-hidden="true">{emoji}</div>
      <p className="text-[#1E1B4B] font-semibold text-lg mb-1">{title}</p>
      {description && <p className="text-slate-400 text-sm mb-6">{description}</p>}
      {action}
    </div>
  );
}
