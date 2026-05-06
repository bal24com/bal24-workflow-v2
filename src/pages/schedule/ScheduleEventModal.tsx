// bal24 v2 — 일정 등록·수정 모달 (STEP 17)
// schedule_events 테이블 INSERT / UPDATE / DELETE 처리

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Trash2 } from 'lucide-react';
import { Modal, Button, Input } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import type { ScheduleCategory, ScheduleEvent } from '../../types/database';
import { SOURCE_COLOR } from './scheduleUtils';

const CATEGORY_OPTIONS: { value: ScheduleCategory; label: string }[] = [
  { value: 'meeting', label: '미팅' },
  { value: 'deadline', label: '마감' },
  { value: 'external', label: '외부 일정' },
  { value: 'personal', label: '개인 일정' },
  { value: 'etc', label: '기타' },
];

const COLOR_PRESETS = [
  '#7C3AED', // violet
  '#F97316', // orange
  '#06B6D4', // cyan
  '#10B981', // emerald
  '#EF4444', // red
  '#64748B', // slate
];

interface ProjectOption {
  id: string;
  name: string;
}

interface ProgramOption {
  id: string;
  name: string;
}

interface Props {
  open: boolean;
  /** 날짜 셀 클릭 시 pre-fill */
  defaultDate?: string;
  /** 수정 대상. null이면 신규 등록 */
  editTarget?: ScheduleEvent | null;
  projects: ProjectOption[];
  programs: ProgramOption[];
  onClose: () => void;
  onSaved: () => void;
}

interface FormState {
  title: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  category: ScheduleCategory;
  color: string;
  projectId: string;
  programId: string;
  description: string;
}

const today = (): string => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

const EMPTY = (defaultDate?: string): FormState => ({
  title: '',
  eventDate: defaultDate ?? today(),
  startTime: '',
  endTime: '',
  allDay: false,
  category: 'etc',
  color: SOURCE_COLOR.custom,
  projectId: '',
  programId: '',
  description: '',
});

function translateError(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes('row-level security')) return '권한이 없어요. 관리자에게 문의해 주세요.';
  if (m.includes('foreign key')) return '연결된 프로젝트 또는 프로그램이 유효하지 않아요.';
  return '저장 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.';
}

export default function ScheduleEventModal({
  open,
  defaultDate,
  editTarget,
  projects,
  programs,
  onClose,
  onSaved,
}: Props) {
  const [form, setForm] = useState<FormState>(EMPTY(defaultDate));
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (editTarget) {
      setForm({
        title: editTarget.title,
        eventDate: editTarget.event_date,
        startTime: editTarget.start_time?.slice(0, 5) ?? '',
        endTime: editTarget.end_time?.slice(0, 5) ?? '',
        allDay: editTarget.all_day,
        category: editTarget.category,
        color: editTarget.color ?? SOURCE_COLOR.custom,
        projectId: editTarget.project_id ?? '',
        programId: editTarget.program_id ?? '',
        description: editTarget.description ?? '',
      });
    } else {
      setForm(EMPTY(defaultDate));
    }
    setErrorMsg(null);
  }, [open, editTarget, defaultDate]);

  const update = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((p) => ({ ...p, [k]: v }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!form.title.trim()) {
      setErrorMsg('일정 제목을 입력해 주세요.');
      return;
    }
    if (!form.eventDate) {
      setErrorMsg('날짜를 선택해 주세요.');
      return;
    }
    if (!form.allDay && form.startTime && form.endTime && form.startTime > form.endTime) {
      setErrorMsg('종료 시간이 시작 시간보다 빠를 수 없어요.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        title: form.title.trim(),
        event_date: form.eventDate,
        start_time: form.allDay ? null : form.startTime || null,
        end_time: form.allDay ? null : form.endTime || null,
        all_day: form.allDay,
        category: form.category,
        color: form.color,
        project_id: form.projectId || null,
        program_id: form.programId || null,
        description: form.description.trim() || null,
        updated_at: new Date().toISOString(),
      };

      const { error } = editTarget
        ? await supabase.from('schedule_events').update(payload).eq('id', editTarget.id)
        : await supabase.from('schedule_events').insert(payload);

      if (error) throw error;
      onSaved();
      onClose();
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[schedule] 일정 저장 실패:', raw);
      setErrorMsg(translateError(raw));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!editTarget) return;
    if (!window.confirm(`"${editTarget.title}" 일정을 삭제할까요? 이 작업은 되돌릴 수 없어요.`)) return;

    setDeleting(true);
    setErrorMsg(null);
    try {
      const { error } = await supabase.from('schedule_events').delete().eq('id', editTarget.id);
      if (error) throw error;
      onSaved();
      onClose();
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[schedule] 일정 삭제 실패:', raw);
      setErrorMsg('삭제 중 오류가 발생했어요.');
    } finally {
      setDeleting(false);
    }
  };

  const busy = submitting || deleting;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editTarget ? '일정 수정' : '일정 등록'}
      description="프로젝트/프로그램을 연결하면 해당 페이지에서도 참조할 수 있어요."
      size="md"
      closeOnBackdrop={!busy}
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          {editTarget ? (
            <Button
              type="button"
              variant="outline"
              onClick={handleDelete}
              loading={deleting}
              className="!border-rose-200 !text-rose-600 hover:!bg-rose-50"
            >
              <Trash2 size={16} className="mr-1.5" aria-hidden="true" />
              삭제
            </Button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose} disabled={busy}>
              취소
            </Button>
            <Button type="submit" form="schedule-form" variant="primary" loading={submitting}>
              저장하기
            </Button>
          </div>
        </div>
      }
    >
      <form id="schedule-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Input
          label="제목"
          required
          value={form.title}
          onChange={(e) => update('title', e.target.value)}
          disabled={busy}
          placeholder="예) 클라이언트 미팅"
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input
            type="date"
            label="날짜"
            required
            value={form.eventDate}
            onChange={(e) => update('eventDate', e.target.value)}
            disabled={busy}
          />
          <Input
            type="time"
            label="시작"
            value={form.startTime}
            onChange={(e) => update('startTime', e.target.value)}
            disabled={busy || form.allDay}
            helperText={form.allDay ? '종일 일정' : undefined}
          />
          <Input
            type="time"
            label="종료"
            value={form.endTime}
            onChange={(e) => update('endTime', e.target.value)}
            disabled={busy || form.allDay}
          />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.allDay}
            onChange={(e) => update('allDay', e.target.checked)}
            disabled={busy}
            className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary/30"
          />
          <span className="font-semibold text-slate-700">종일 일정</span>
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">유형</label>
            <select
              value={form.category}
              onChange={(e) => update('category', e.target.value as ScheduleCategory)}
              disabled={busy}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">색상</label>
            <div className="flex items-center gap-2 py-1">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => update('color', c)}
                  disabled={busy}
                  aria-label={`색상 ${c}`}
                  className={`h-8 w-8 rounded-full border-2 transition ${
                    form.color === c ? 'border-slate-900 scale-110' : 'border-white shadow-sm'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">연결 프로젝트 (선택)</label>
            <select
              value={form.projectId}
              onChange={(e) => update('projectId', e.target.value)}
              disabled={busy}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              <option value="">— 없음 —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">연결 프로그램 (선택)</label>
            <select
              value={form.programId}
              onChange={(e) => update('programId', e.target.value)}
              disabled={busy}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              <option value="">— 없음 —</option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-slate-700">메모</label>
          <textarea
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            disabled={busy}
            rows={3}
            placeholder="추가 메모를 입력해 주세요."
            className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
          />
        </div>

        {errorMsg && (
          <div role="alert" className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-2.5 text-sm text-rose-700">
            {errorMsg}
          </div>
        )}
      </form>
    </Modal>
  );
}
