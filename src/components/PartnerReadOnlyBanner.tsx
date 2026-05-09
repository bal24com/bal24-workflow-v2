// bal24 v2 — STEP-PARTNER-SIDEBAR PARTNER 담당 외 프로그램 읽기 전용 배너
// PMViewerBanner 와 메시지·아이콘만 다르고 색상은 동일 주황 계열.

import { ShieldAlert } from 'lucide-react';

export default function PartnerReadOnlyBanner() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-50 bg-orange-50 border-b border-orange-200 px-4 py-2 flex items-center gap-2 text-orange-700 text-sm"
    >
      <ShieldAlert size={16} aria-hidden="true" />
      <span>
        <strong>담당 프로그램이 아닙니다</strong>
        {' '}— 읽기 전용으로 표시됩니다.
      </span>
    </div>
  );
}
