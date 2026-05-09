// bal24 v2 — PM 뷰어 모드 상단 sticky 배너 (STEP-PM-VIEWER)
// usePMViewer 와 함께 사용. 토큰 페이지에서 PM/ADMIN 로그인 상태일 때만 노출.

import { Eye } from 'lucide-react';

interface PMViewerBannerProps {
  /** 표시할 뷰어 이름 (없으면 기본 'PM') */
  viewerName?: string;
}

export default function PMViewerBanner({ viewerName }: PMViewerBannerProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-50 bg-orange-50 border-b border-orange-200 px-4 py-2 flex items-center gap-2 text-orange-700 text-sm"
    >
      <Eye size={16} aria-hidden="true" />
      <span>
        <strong>{viewerName || 'PM'} 뷰어 모드</strong>
        {' '}— 읽기 전용입니다. 데이터를 수정할 수 없습니다.
      </span>
    </div>
  );
}
