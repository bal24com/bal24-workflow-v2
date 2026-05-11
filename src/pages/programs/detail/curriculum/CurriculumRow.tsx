// bal24 v2 — 커리큘럼 단일 차시 행 (V7 테이블형)
// STEP-CURRICULUM-FULL — 2행 레이아웃 (행1 헤더 + 행2 content) + 펼침 시 5역할 인력 섹션
// draft state 사용 — onChange는 draft만, [저장] 버튼 클릭 시에만 DB UPDATE.

import { useEffect, useState } from 'react';
import {
  ChevronDown, ChevronRight, GripVertical, Trash2, Save, RotateCcw, Send, ArrowUp, ArrowDown,
} from 'lucide-react';
import DateTimePicker from '../../../../components/ui/DateTimePicker';
import CurriculumRowStaffSection, { type StaffOption } from './CurriculumRowStaffSection';
import { computeDuration, padTime, trimTime, type CurriculumWithStaff } from './curriculumTabUtils';
import type { ProgramCurriculum, InvitationStatus } from '../../../../types/database';

interface InvitationSummary { id: string; name: string; status: InvitationStatus; }

interface Props {
  item: CurriculumWithStaff;
  /** STEP-CURRICULUM-INSTRUCTOR-FIX — 차시별 외부 강사 초대 (instructor_invitations) */
  invitation?: InvitationSummary | null;
  onSave: (patch: Partial<ProgramCurriculum>) => Promise<void>;
  onDelete: () => Promise<void>;
  /** STEP-INSTRUCTOR-INVITE-A — 외부 강사 초대 패널 진입 */
  onRequestInstructor?: () => void;
  /** STEP-CURRICULUM-FULL — 인력 변경 시 부모(CurriculumStaffSection) 갱신 */
  onStaffChanged?: () => void;
  /** STEP-CURRICULUM-FULL — 'actual' 탭에서만 ↑↓ 순서 조정 노출 */
  canReorder?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
  onDragStart: () => void;
  onDragEnter: () => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent) => void;
  isDragging: boolean;
  /** STEP-PROGRAM-ENHANCE-FULL — 부모에서 1회 fetch한 staff_pool 옵션 */
  staffOptions?: StaffOption[];
}

const INVITE_BADGE: Record<InvitationStatus, string> = {
  '대기':   'bg-amber-100 text-amber-700',
  '제출':   'bg-blue-100 text-blue-700',
  '수락':   'bg-emerald-100 text-emerald-700',
  '거절':   'bg-red-100 text-red-600',
  '교체됨': 'bg-slate-100 text-slate-600',
};

interface Draft {
  session_no: number;
  day_label: string | null;    // STEP-PROGRAM-BUNDLE — "1일차"·"5월 7일" 자유 입력
  start_time: string | null;   // 'HH:MM' 또는 null
  end_time: string | null;
  title: string;
  session_date: string | null; // 'YYYY-MM-DD' 또는 null
  venue: string | null;
  content: string | null;
}

function toDraft(c: CurriculumWithStaff): Draft {
  return {
    session_no: c.session_no,
    day_label: c.day_label ?? null,
    start_time: trimTime(c.start_time) || null,
    end_time: trimTime(c.end_time) || null,
    title: c.title,
    session_date: c.session_date ?? null,
    venue: c.venue ?? null,
    content: c.content ?? null,
  };
}

function isEqual(a: Draft, b: Draft): boolean {
  return (
    a.session_no === b.session_no &&
    a.day_label === b.day_label &&
    a.start_time === b.start_time &&
    a.end_time === b.end_time &&
    a.title === b.title &&
    a.session_date === b.session_date &&
    a.venue === b.venue &&
    a.content === b.content
  );
}

export default function CurriculumRow({
  item, invitation, onSave, onDelete, onRequestInstructor, onStaffChanged,
  canReorder, onMoveUp, onMoveDown, isFirst, isLast,
  onDragStart, onDragEnter, onDragEnd, onDragOver, isDragging,
  staffOptions,
}: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => toDraft(item));
  const [saving, setSaving] = useState(false);

  // 외부에서 item이 갱신되면 (저장 후) draft 동기화
  useEffect(() => {
    setDraft(toDraft(item));
  }, [item]);

  const baseline = toDraft(item);
  const dirty = !isEqual(draft, baseline);

  function patchDraft<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  async function handleSave() {
    if (!draft.title.trim()) {
      // toast는 부모가 가지고 있지 않으니 여기서는 호출 X — 입력 검증 minimal
      return;
    }
    setSaving(true);
    try {
      const duration = computeDuration(draft.start_time, draft.end_time);
      const patch: Partial<ProgramCurriculum> = {
        session_no: draft.session_no,
        day_label: draft.day_label,
        start_time: padTime(draft.start_time),
        end_time: padTime(draft.end_time),
        duration,
        title: draft.title.trim(),
        session_date: draft.session_date,
        venue: draft.venue,
        content: draft.content,
      };
      await onSave(patch);
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setDraft(toDraft(item));
  }

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnter={onDragEnter}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      className={`rounded-xl border ${
        isDragging
          ? 'border-violet-300 ring-2 ring-violet-200'
          : dirty
            ? 'border-orange-300 ring-1 ring-orange-100'
            : 'border-violet-100'
      } bg-white overflow-hidden transition-colors`}
    >
      {/* 행1 — 헤더 (번호·일차·시간·주제·invitation·↑↓·펼침·삭제) */}
      <div className="grid grid-cols-[28px_48px_80px_minmax(110px,130px)_minmax(110px,130px)_minmax(0,1fr)_minmax(110px,140px)_auto_28px_28px] items-center gap-2 px-2 py-2">
        <button type="button" aria-label="순서 변경 핸들"
          className="cursor-grab active:cursor-grabbing inline-flex items-center justify-center w-7 h-7 rounded-md text-slate-400 hover:bg-slate-100">
          <GripVertical size={13} aria-hidden="true" />
        </button>
        <input type="number" min={1} value={draft.session_no}
          onChange={(e) => patchDraft('session_no', Number(e.target.value) || draft.session_no)}
          className="h-8 px-2 rounded-md border border-violet-100 bg-white text-xs text-center tabular-nums focus:outline-none focus:border-violet-400" />
        <input type="text" value={draft.day_label ?? ''}
          onChange={(e) => patchDraft('day_label', e.target.value || null)}
          placeholder="1일차"
          className="h-8 px-2 rounded-md border border-violet-100 bg-white text-xs focus:outline-none focus:border-violet-400" />
        <DateTimePicker mode="time" value={draft.start_time}
          onChange={(v) => patchDraft('start_time', v)} placeholder="시작" />
        <DateTimePicker mode="time" value={draft.end_time}
          onChange={(v) => patchDraft('end_time', v)} placeholder="종료" />
        <input type="text" value={draft.title}
          onChange={(e) => patchDraft('title', e.target.value)}
          placeholder="주제·차시명"
          className="h-8 px-2 rounded-md border border-violet-100 bg-white text-xs focus:outline-none focus:border-violet-400" />
        <span className="truncate text-[11px]">
          {invitation ? (
            <span className="inline-flex items-center gap-1">
              <span className="font-semibold text-slate-700 truncate">{invitation.name}</span>
              <span className={`text-[9px] px-1 py-0.5 rounded ${INVITE_BADGE[invitation.status]}`}>{invitation.status}</span>
            </span>
          ) : (
            <span className="text-slate-300 italic">초대 없음</span>
          )}
        </span>
        {/* STEP-CURRICULUM-FULL — actual에서만 ↑↓ 노출 */}
        {canReorder ? (
          <span className="inline-flex items-center">
            <button type="button" onClick={onMoveUp} disabled={isFirst} aria-label="위로"
              className="inline-flex items-center justify-center w-6 h-6 rounded text-slate-400 hover:bg-violet-50 hover:text-violet-700 disabled:opacity-30">
              <ArrowUp size={11} aria-hidden="true" />
            </button>
            <button type="button" onClick={onMoveDown} disabled={isLast} aria-label="아래로"
              className="inline-flex items-center justify-center w-6 h-6 rounded text-slate-400 hover:bg-violet-50 hover:text-violet-700 disabled:opacity-30">
              <ArrowDown size={11} aria-hidden="true" />
            </button>
          </span>
        ) : <span aria-hidden="true" />}
        <button type="button" onClick={() => setOpen((v) => !v)} aria-label={open ? '접기' : '펼치기'}
          className="inline-flex items-center justify-center w-7 h-7 rounded-md text-violet-600 hover:bg-violet-50">
          {open ? <ChevronDown size={13} aria-hidden="true" /> : <ChevronRight size={13} aria-hidden="true" />}
        </button>
        <button type="button" onClick={() => void onDelete()} aria-label="차시 삭제" title="차시 삭제"
          className="inline-flex items-center justify-center w-7 h-7 rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-500">
          <Trash2 size={12} aria-hidden="true" />
        </button>
      </div>

      {/* 행2 — content textarea (항상 노출) */}
      <div className="px-2 pb-1.5">
        <textarea value={draft.content ?? ''} rows={2}
          onChange={(e) => patchDraft('content', e.target.value || null)}
          placeholder="강의 내용·진행 방식 입력"
          className="w-full px-2 py-1.5 rounded-md border border-violet-100 bg-white text-xs focus:outline-none focus:border-violet-400 resize-none leading-relaxed" />
      </div>

      {/* STEP-CURRICULUM-INLINE-ROLE — 행3: 인력 배정 (항상 노출, 4역할 콤보+검색) */}
      <div className="px-2 pb-2">
        <CurriculumRowStaffSection curriculumId={item.id} onChanged={onStaffChanged} staffOptions={staffOptions} />
      </div>

      {/* 펼침 영역 — 날짜·장소·저장 (선택) */}
      {open && (
        <div className="border-t border-violet-100/70 bg-violet-50/20 px-3 py-3 flex flex-col gap-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-500">날짜</label>
              <input
                type="date"
                value={draft.session_date ?? ''}
                onChange={(e) => patchDraft('session_date', e.target.value || null)}
                className="h-8 px-2 rounded-md border border-violet-100 bg-white text-xs focus:outline-none focus:border-violet-400"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-500">장소</label>
              <input
                type="text"
                value={draft.venue ?? ''}
                onChange={(e) => patchDraft('venue', e.target.value || null)}
                placeholder="예) 본관 301호"
                className="h-8 px-2 rounded-md border border-violet-100 bg-white text-xs focus:outline-none focus:border-violet-400"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 pt-2 border-t border-violet-100/70">
            <p className="text-[11px] text-slate-500">
              {dirty ? (
                <span className="inline-flex items-center gap-1 text-orange-600 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500 inline-block" aria-hidden="true" />
                  저장 안 된 변경
                </span>
              ) : (
                <span className="text-slate-400">변경 없음</span>
              )}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleReset}
                disabled={!dirty || saving}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold text-slate-500 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <RotateCcw size={11} aria-hidden="true" />
                되돌리기
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={!dirty || saving || !draft.title.trim()}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Save size={11} aria-hidden="true" />
                {saving ? '저장 중…' : '저장'}
              </button>
            </div>
          </div>

          {/* STEP-CURRICULUM-INLINE-ROLE — 강사 요청 (외부 초대) 버튼만 펼침에 유지 */}
          {onRequestInstructor && (
            <div className="flex justify-end">
              <button type="button" onClick={onRequestInstructor}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-violet-100 text-violet-700 text-[11px] font-bold border border-violet-300 hover:bg-violet-200 transition-colors">
                <Send size={11} aria-hidden="true" />
                외부 강사 초대 요청
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
