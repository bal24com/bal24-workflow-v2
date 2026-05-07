// bal24 v2 — 커리큘럼 단일 차시 행 (V7 테이블형)
// 헤더: 일차·시작·종료·주제·강사 / 펼침: 강사 추가·멘토 추가·설명·매칭 정보.

import { useState } from 'react';
import {
  ChevronDown, ChevronRight, GripVertical, Trash2, UserPlus, Users,
} from 'lucide-react';
import DateTimePicker from '../../../../components/ui/DateTimePicker';
import StaffMatchRow from './StaffMatchRow';
import { computeDuration, padTime, trimTime, type CurriculumWithStaff } from './curriculumTabUtils';
import type { ProgramCurriculum, CurriculumStaffRole } from '../../../../types/database';

interface Props {
  item: CurriculumWithStaff;
  onUpdate: (patch: Partial<ProgramCurriculum>) => Promise<void>;
  onDelete: () => Promise<void>;
  onOpenMatch: (defaultRole: CurriculumStaffRole) => void;
  onDeleteStaff: (staffId: string) => Promise<void>;
  onDragStart: () => void;
  onDragEnter: () => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent) => void;
  isDragging: boolean;
}

export default function CurriculumRow({
  item, onUpdate, onDelete, onOpenMatch, onDeleteStaff,
  onDragStart, onDragEnter, onDragEnd, onDragOver, isDragging,
}: Props) {
  const [open, setOpen] = useState(false);
  const firstInstructor = item.staff.find((s) => s.role === '강사' || s.role === 'FT');

  async function changeStart(next: string | null) {
    const t = next ? padTime(next) : null;
    const newDuration = computeDuration(next, trimTime(item.end_time)) ?? item.duration ?? null;
    await onUpdate({ start_time: t, duration: newDuration });
  }
  async function changeEnd(next: string | null) {
    const t = next ? padTime(next) : null;
    const newDuration = computeDuration(trimTime(item.start_time), next) ?? item.duration ?? null;
    await onUpdate({ end_time: t, duration: newDuration });
  }

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnter={onDragEnter}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      className={`rounded-xl border ${
        isDragging ? 'border-violet-300 ring-2 ring-violet-200' : 'border-violet-100'
      } bg-white overflow-hidden`}
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
          value={item.session_no}
          onChange={(e) => void onUpdate({ session_no: Number(e.target.value) || item.session_no })}
          className="h-8 px-2 rounded-md border border-violet-100 bg-white text-xs text-center tabular-nums focus:outline-none focus:border-violet-400"
        />

        <DateTimePicker
          mode="time"
          value={trimTime(item.start_time) || null}
          onChange={(v) => void changeStart(v)}
          placeholder="시작"
        />

        <DateTimePicker
          mode="time"
          value={trimTime(item.end_time) || null}
          onChange={(v) => void changeEnd(v)}
          placeholder="종료"
        />

        <input
          type="text"
          value={item.title}
          onChange={(e) => void onUpdate({ title: e.target.value })}
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
                value={item.session_date ?? ''}
                onChange={(e) => void onUpdate({ session_date: e.target.value || null })}
                className="h-8 px-2 rounded-md border border-violet-100 bg-white text-xs focus:outline-none focus:border-violet-400"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-500">장소</label>
              <input
                type="text"
                value={item.venue ?? ''}
                onChange={(e) => void onUpdate({ venue: e.target.value || null })}
                placeholder="예) 본관 301호"
                className="h-8 px-2 rounded-md border border-violet-100 bg-white text-xs focus:outline-none focus:border-violet-400"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-500">설명</label>
            <textarea
              value={item.content ?? ''}
              onChange={(e) => void onUpdate({ content: e.target.value || null })}
              placeholder="차시 내용·진행 방식 등"
              className="px-2 py-1.5 rounded-md border border-violet-100 bg-white text-xs focus:outline-none focus:border-violet-400 min-h-[64px] leading-relaxed"
            />
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
