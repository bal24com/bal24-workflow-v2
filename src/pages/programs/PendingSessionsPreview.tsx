// bal24 v2 — STEP-CURRICULUM-INSTRUCTOR-FIX 자동채우기 후 차시 미리보기 (저장 전 확인)

import type { ExtractedSession } from '../../lib/programAutoFill';

interface Props {
  sessions: ExtractedSession[];
  onClear: () => void;
}

export default function PendingSessionsPreview({ sessions, onClear }: Props) {
  if (sessions.length === 0) return null;
  return (
    <div className="border border-violet-200 rounded-xl overflow-hidden">
      <div className="bg-violet-100 px-3 py-1.5 flex items-center justify-between">
        <span className="text-xs font-semibold text-violet-700">
          📋 추출된 차시 {sessions.length}개 — 저장 시 함께 등록돼요
        </span>
        <button type="button" onClick={onClear}
          className="text-[11px] text-violet-500 hover:text-violet-700 hover:underline">
          초기화
        </button>
      </div>
      <div className="divide-y divide-violet-100 max-h-40 overflow-y-auto">
        {sessions.map((s, i) => (
          <div key={i} className="grid grid-cols-[40px_minmax(80px,100px)_1fr] items-center gap-2 px-3 py-1.5 text-xs">
            <span className="text-violet-600 font-bold tabular-nums">{i + 1}차시</span>
            <span className="text-slate-400 tabular-nums">
              {s.start_time && s.end_time ? `${s.start_time}~${s.end_time}` : '—'}
            </span>
            <span className="text-slate-700 truncate">{s.title || '(제목 없음)'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
