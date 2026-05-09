// bal24 v2 — 페이지 상단 안내 배너 (기능·사용법 2~3줄)
// 사용 예:
//   <PageHelpBanner
//     title="이 페이지에서 할 수 있는 것"
//     lines={[
//       '✦ 진행 중 프로젝트·태스크 한눈에',
//       '✦ 빠른 액션 카드로 자주 쓰는 흐름 즉시 시작',
//       '💡 Ctrl + K 로 어디서나 빠른 검색',
//     ]}
//   />
//
// tone: 'tip'(보라) / 'info'(청록) / 'warn'(주황) / 'success'(에메랄드)
// dismissable: true 면 X 버튼으로 닫기 (sessionStorage 키 권장 — 본 컴포넌트는 표시만)

import { Lightbulb, Info, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type PageHelpTone = 'tip' | 'info' | 'warn' | 'success';

interface ToneStyle {
  bg: string;
  border: string;
  text: string;
  iconColor: string;
  Icon: LucideIcon;
}

const TONE_STYLES: Record<PageHelpTone, ToneStyle> = {
  tip: {
    bg: 'bg-violet-50/70',
    border: 'border-violet-100',
    text: 'text-violet-900',
    iconColor: 'text-violet-600',
    Icon: Lightbulb,
  },
  info: {
    bg: 'bg-cyan-50/60',
    border: 'border-cyan-100',
    text: 'text-cyan-900',
    iconColor: 'text-cyan-600',
    Icon: Info,
  },
  warn: {
    bg: 'bg-orange-50/70',
    border: 'border-orange-100',
    text: 'text-orange-900',
    iconColor: 'text-orange-600',
    Icon: AlertTriangle,
  },
  success: {
    bg: 'bg-emerald-50/60',
    border: 'border-emerald-100',
    text: 'text-emerald-900',
    iconColor: 'text-emerald-600',
    Icon: CheckCircle2,
  },
};

interface Props {
  /** 안내 박스 제목 (선택). 없으면 본문만 표시 */
  title?: string;
  /** 본문 — 한 줄당 1개 항목. 2~3줄 권장 (4줄 넘으면 가독성 저하) */
  lines: string[];
  /** 색상 톤. 기본 'tip' (보라) */
  tone?: PageHelpTone;
  /** 추가 클래스 (margin·padding 조정용) */
  className?: string;
}

export default function PageHelpBanner({ title, lines, tone = 'tip', className }: Props) {
  if (!lines || lines.length === 0) return null;
  const s = TONE_STYLES[tone];
  return (
    <div
      role="note"
      className={[
        'rounded-xl border px-4 py-3 flex items-start gap-3',
        s.bg, s.border, s.text,
        className ?? '',
      ].join(' ')}
    >
      <s.Icon size={16} className={`shrink-0 mt-0.5 ${s.iconColor}`} aria-hidden="true" />
      <div className="flex-1 min-w-0 space-y-0.5">
        {title && <p className="text-xs font-bold">{title}</p>}
        <ul className="text-[11px] sm:text-xs leading-relaxed space-y-0.5">
          {lines.map((line, idx) => (
            <li key={idx}>{line}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
