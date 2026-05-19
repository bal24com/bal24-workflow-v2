// bal24 v2 — STEP-PARTICIPANT-BULK-DELETE
// 다중 선택 일괄 처리 화면 하단 고정 액션 바. count + extraActions + 선택 삭제 + 취소.

import type { ReactNode } from 'react';
import { Loader2, Trash2 } from 'lucide-react';

interface Props {
  count: number;
  busy?: boolean;
  onDelete: () => void;
  onCancel: () => void;
  /** 선택 단위 라벨. 예: '명' / '건' / '개' */
  itemLabel?: string;
  /** 일괄 삭제 외 추가 액션 (일괄 상태 변경 등) */
  extraActions?: ReactNode;
  /** 선택 삭제 버튼 라벨 (기본 '선택 삭제') */
  deleteLabel?: string;
}

export default function BulkActionBar({
  count, busy, onDelete, onCancel, itemLabel = '개', extraActions, deleteLabel = '선택 삭제',
}: Props) {
  if (count === 0) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-xl">
      <span className="text-sm font-semibold tabular-nums">{count}{itemLabel} 선택됨</span>
      {extraActions}
      <button type="button" onClick={onDelete} disabled={busy}
        className="inline-flex items-center gap-1 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-sm px-4 py-1.5 rounded-lg font-medium transition-colors">
        {busy ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} aria-hidden="true" />}
        {deleteLabel}
      </button>
      <button type="button" onClick={onCancel} disabled={busy}
        className="text-slate-300 hover:text-white text-sm px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
        취소
      </button>
    </div>
  );
}
