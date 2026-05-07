// bal24 v2 — 커리큘럼 단일 차시 행 (V7 테이블형)
// 헤더: 일차·시작·종료·주제·강사 / 펼침: 강사 추가·멘토 추가·설명·매칭 정보.
// draft state 사용 — onChange는 draft만, [저장] 버튼 클릭 시에만 DB UPDATE.

import { useEffect, useState } from 'react';
import {
  ChevronDown, ChevronRight, GripVertical, Trash2, UserPlus, Users, Save, RotateCcw,
} from 'lucide-react';
import DateTimePicker from '../../../../components/ui/DateTimePicker';
import StaffMatchRow from './StaffMatchRow';
import { computeDuration, padTime, trimTime, type CurriculumWithStaff } from './curriculumTabUtils';
import type { ProgramCurriculum, CurriculumStaffRole } from '../../../../types/database';

interface Props {
  item: CurriculumWithStaff;
  onSave: (patch: Partial<ProgramCurriculum>) => Promise<void>;
  onDelete: () => Promise<void>;
  onOpenMatch: (defaultRole: CurriculumStaffRole) => void;
  onDeleteStaff: (staffId: string) => Promise<void>;
  onDragStart: () => void;
  onDragEnter: () => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent) => void;
  isDragging: boolean;
}

interface Draft {
  session_no: number;
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
    a.start_time === b.start_time &&
    a.end_time === b.end_time &&
    a.title === b.title &&
    a.session_date === b.session_date &&
    a.venue === b.venue &&
    a.content === b.content
  );
}

export default function CurriculumRow({
  item, onSave, onDelete, onOpenMatch, onDeleteStaff,
  onDragStart, onDragEnter, onDragEnd, onDragOver, isDragging,
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

  const firstInstructor = item.staff.find((s) => s.role === '강사' || s.role === 'FT');

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
      {/* 테이블 행 */}
      <div className="grid grid-cols-[28px_56px_minmax(120px,140px)_minmax(120px,140px)_minmax(0,1fr)_minmax(140px,180px)_28px_28px] items-center gap-2 px-2 py-2">
        <button
          type="button"
          aria-label="순서 변경 핸들"
          className="cursor-grab active:cursor-grabbing inline-flex items-center justify-center w-7 h-7 rounded-md text-slate-400 hover:bg-slate-100"
        >
          <GripVertical size={13} aria-hidden="true" />
        </button>

        <input
          type="number"
          min={1}
          value={draft.session_no}
          onChange={(e) => patchDraft('session_no', Number(e.target.value) || draft.session_no)}
          className="h-8 px-2 rounded-md border border-violet-100 bg-white text-xs text-center tabular-nums focus:outline-none focus:border-violet-400"
        />

        <DateTimePicker
          mode="time"
          value={draft.start_time}
          onChange={(v) => patchDraft('start_time', v)}
          placeholder="시작"
        />

        <DateTimePicker
          mode="time"
          value={draft.end_time}
          onChange={(v) => patchDraft('end_time', v)}
          placeholder="종료"
        />

        <input
          type="text"
          value={draft.title}
          onChange={(e) => patchDraft('title', e.target.value)}
          placeholder="주제·차시명"
          className="h-8 px-2 rounded-md border border-violet-100 bg-white text-xs focus:outline-none focus:border-violet-400"
        />

        <span className="truncate text-xs text-slate-600">
          {firstInstructor ? (
            <span className="inline-flex items-center gap-1">
              <span className="text-violet-600">🎤</span>
              {firstInstructor.name}
              {item.staff.length > 1 && (
                <span className="text-[10px] text-slate-400 ml-1">+{item.staff.length - 1}</span>
              )}
            </span>
          ) : (
            <span className="text-slate-400 italic">강사 미지정</span>
          )}
        </span>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? '접기' : '펼치기'}
          className="inline-flex items-center justify-center w-7 h-7 rounded-md text-violet-600 hover:bg-violet-50"
        >
          {open ? <ChevronDown size={13} aria-hidden="true" /> : <ChevronRight size={13} aria-hidden="true" />}
        </button>

        <button
          type="button"
          onClick={() => void onDelete()}
          aria-label="차시 삭제"
          title="차시 삭제"
          className="inline-flex items-center justify-center w-7 h-7 rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-500"
        >
          <Trash2 size={12} aria-hidden="true" />
        </button>
      </div>

      {/* 펼침 영역 */}
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

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-500">설명</label>
            <textarea
              value={draft.content ?? ''}
              onChange={(e) => patchDraft('content', e.target.value || null)}
              placeholder="차시 내용·진행 방식 등"
              className="px-2 py-1.5 rounded-md border border-violet-100 bg-white text-xs focus:outline-none focus:border-violet-400 min-h-[64px] leading-relaxed"
            />
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

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold text-slate-600">매칭 인력 ({item.staff.length})</p>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onOpenMatch('강사')}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-violet-50 text-violet-700 text-[11px] font-bold border border-violet-200 hover:bg-violet-100 transition-colors"
                >
                  <UserPlus size={11} aria-hidden="true" />
                  강사 추가
                </button>
                <button
                  type="button"
                  onClick={() => onOpenMatch('멘토')}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-orange-50 text-orange-700 text-[11px] font-bold border border-orange-200 hover:bg-orange-100 transition-colors"
                >
                  <Users size={11} aria-hidden="true" />
                  멘토 추가
                </button>
              </div>
            </div>

            {item.staff.length === 0 ? (
              <p className="text-[11px] text-slate-400 italic">매칭된 인력이 없어요.</p>
            ) : (
              item.staff.map((row) => (
                <StaffMatchRow key={row.id} row={row} onDelete={() => void onDeleteStaff(row.id)} />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
