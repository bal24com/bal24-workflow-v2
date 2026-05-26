// bal24 v2 — MentoringLogForm 푸터 (V-1 분리, 박경수님 2026-05-26)
// 취소·임시저장·제출 버튼 3개.

import { Loader2, Save, Send, X } from 'lucide-react';

interface Props {
  saving: boolean;
  isEdit: boolean;
  onCancel: () => void;
  onDraft: () => void;
  onSubmit: () => void;
}

const BTN_PRIMARY =
  'inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-violet-600 ' +
  'rounded-[10px] hover:bg-violet-700 hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:hover:scale-100';

const BTN_GHOST =
  'inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-slate-600 ' +
  'hover:bg-slate-100 rounded-[10px] transition-all duration-200';

export default function MentoringLogFormFooter({ saving, isEdit, onCancel, onDraft, onSubmit }: Props) {
  return (
    <div className="flex items-center justify-end gap-2 pt-1">
      <button type="button" onClick={onCancel} disabled={saving} className={BTN_GHOST}>
        <X size={14} /> 취소
      </button>
      <button type="button" onClick={onDraft} disabled={saving}
        className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-slate-700 border border-slate-300 rounded-[10px] hover:bg-slate-50 transition-all duration-200 disabled:opacity-50">
        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} 임시저장
      </button>
      <button type="button" onClick={onSubmit} disabled={saving} className={BTN_PRIMARY}>
        {saving ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
        {isEdit ? ' 다시 제출하기' : ' 제출하기'}
      </button>
    </div>
  );
}
