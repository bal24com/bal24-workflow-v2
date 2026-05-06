// bal24 v2 — 통합 일지 등록/수정 모달
// 14 필드 + 파일 첨부 (ActivityFileSection 분리)

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Modal, Button, Input } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import {
  LOG_TYPE_LABELS,
  LOG_TYPE_VALUES,
  calcDurationHours,
} from './activityLogTypes';
import type {
  ActivityFile,
  ActivityLog,
  ActivityLogType,
  Program,
  Project,
  StaffPool,
} from '../../types/database';
import ActivityFileSection from './ActivityFileSection';

type Props = {
  open: boolean;
  programs: Pick<Program, 'id' | 'name'>[];
  projects: Pick<Project, 'id' | 'name'>[];
  experts: Pick<StaffPool, 'id' | 'name'>[];
  defaultLogType: ActivityLogType;
  defaultProgramId?: string;
  log?: ActivityLog | null;
  onClose: () => void;
  onSaved: () => void;
};

type FormState = {
  logType: ActivityLogType;
  programId: string;
  projectId: string;
  expertId: string;
  title: string;
  activityDate: string;
  startTime: string;
  endTime: string;
  durationHours: string;
  location: string;
  attendeeCount: string;
  content: string;
  outcome: string;
  issues: string;
  nextPlan: string;
};

const today = () => new Date().toISOString().slice(0, 10);

const EMPTY = (logType: ActivityLogType, programId = ''): FormState => ({
  logType, programId, projectId: '', expertId: '',
  title: '', activityDate: today(), startTime: '', endTime: '', durationHours: '',
  location: '', attendeeCount: '',
  content: '', outcome: '', issues: '', nextPlan: '',
});

function translateError(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes('row-level security')) return '권한이 없어요. 관리자에게 문의해 주세요.';
  if (m.includes('foreign key')) return '연결된 항목이 유효하지 않아요.';
  return '저장 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.';
}

export default function ActivityLogFormModal({
  open, programs, projects, experts, defaultLogType, defaultProgramId, log, onClose, onSaved,
}: Props) {
  const [form, setForm] = useState<FormState>(EMPTY(defaultLogType, defaultProgramId));
  const [files, setFiles] = useState<ActivityFile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (log) {
      setForm({
        logType: log.log_type,
        programId: log.program_id ?? '',
        projectId: log.project_id ?? '',
        expertId: log.expert_id ?? '',
        title: log.title,
        activityDate: log.activity_date,
        startTime: log.start_time?.slice(0, 5) ?? '',
        endTime: log.end_time?.slice(0, 5) ?? '',
        durationHours: log.duration_hours != null ? String(log.duration_hours) : '',
        location: log.location ?? '',
        attendeeCount: log.attendee_count != null ? String(log.attendee_count) : '',
        content: log.content ?? '',
        outcome: log.outcome ?? '',
        issues: log.issues ?? '',
        nextPlan: log.next_plan ?? '',
      });
      setFiles(log.file_urls ?? []);
    } else {
      setForm(EMPTY(defaultLogType, defaultProgramId));
      setFiles([]);
    }
    setErrorMsg(null);
  }, [open, log, defaultLogType, defaultProgramId]);

  const update = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((p) => {
      const next = { ...p, [k]: v };
      if ((k === 'startTime' || k === 'endTime') && !p.durationHours.trim()) {
        const calc = calcDurationHours(next.startTime, next.endTime);
        if (calc != null) next.durationHours = String(calc);
      }
      return next;
    });
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!form.title.trim()) { setErrorMsg('제목을 입력해 주세요.'); return; }
    if (!form.activityDate) { setErrorMsg('활동 날짜를 선택해 주세요.'); return; }

    let duration: number | null = null;
    if (form.durationHours.trim()) {
      const n = Number(form.durationHours);
      if (Number.isNaN(n) || n < 0) { setErrorMsg('활동 시간은 0 이상의 숫자여야 해요.'); return; }
      duration = n;
    }
    let attendeeCount: number | null = null;
    if (form.attendeeCount.trim()) {
      const n = Number(form.attendeeCount);
      if (Number.isNaN(n) || n < 0) { setErrorMsg('참석인원은 0 이상의 숫자여야 해요.'); return; }
      attendeeCount = n;
    }

    setSubmitting(true);
    try {
      const payload = {
        program_id: form.programId || null,
        project_id: form.projectId || null,
        expert_id: form.expertId || null,
        log_type: form.logType,
        title: form.title.trim(),
        activity_date: form.activityDate,
        start_time: form.startTime || null,
        end_time: form.endTime || null,
        duration_hours: duration,
        location: form.location.trim() || null,
        attendee_count: attendeeCount,
        content: form.content.trim() || null,
        outcome: form.outcome.trim() || null,
        issues: form.issues.trim() || null,
        next_plan: form.nextPlan.trim() || null,
        file_urls: files,
      };
      const { error } = log
        ? await supabase.from('activity_logs').update(payload).eq('id', log.id)
        : await supabase.from('activity_logs').insert(payload);
      if (error) throw error;
      onSaved();
      onClose();
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[activity-log] 저장 실패:', raw);
      setErrorMsg(translateError(raw));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={log ? '일지 수정' : '일지 등록'}
      description="제목·활동 날짜는 필수예요."
      size="lg"
      closeOnBackdrop={!submitting}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submitting}>취소</Button>
          <Button type="submit" form="activity-log-form" variant="primary" loading={submitting}>저장하기</Button>
        </>
      }
    >
      <form id="activity-log-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">로그 유형 <span className="text-danger">*</span></label>
            <select
              value={form.logType}
              onChange={(e) => update('logType', e.target.value as ActivityLogType)}
              disabled={submitting}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              {LOG_TYPE_VALUES.map((t) => (<option key={t} value={t}>{LOG_TYPE_LABELS[t]}</option>))}
            </select>
          </div>
          <Input type="date" label="활동 날짜" required value={form.activityDate} onChange={(e) => update('activityDate', e.target.value)} disabled={submitting} />
        </div>

        <Input label="제목" required value={form.title} onChange={(e) => update('title', e.target.value)} disabled={submitting} placeholder="예) 3회차 멘토링 진행" />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <SelectField label="프로그램" value={form.programId} onChange={(v) => update('programId', v)} options={programs} disabled={submitting} />
          <SelectField label="프로젝트" value={form.projectId} onChange={(v) => update('projectId', v)} options={projects} disabled={submitting} />
          <SelectField label="전문가" value={form.expertId} onChange={(v) => update('expertId', v)} options={experts} disabled={submitting} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input type="time" label="시작" value={form.startTime} onChange={(e) => update('startTime', e.target.value)} disabled={submitting} />
          <Input type="time" label="종료" value={form.endTime} onChange={(e) => update('endTime', e.target.value)} disabled={submitting} />
          <Input
            label="활동 시간"
            inputMode="decimal"
            value={form.durationHours}
            onChange={(e) => update('durationHours', e.target.value)}
            disabled={submitting}
            placeholder="자동 계산"
            helperText="시각 입력 시 자동 계산. 수동 입력 가능."
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="장소" value={form.location} onChange={(e) => update('location', e.target.value)} disabled={submitting} />
          <Input label="참석인원" inputMode="numeric" value={form.attendeeCount} onChange={(e) => update('attendeeCount', e.target.value)} disabled={submitting} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <TextareaField id="al-content" label="활동 내용" value={form.content} onChange={(v) => update('content', v)} disabled={submitting} />
          <TextareaField id="al-outcome" label="성과 및 결과" value={form.outcome} onChange={(v) => update('outcome', v)} disabled={submitting} />
          <TextareaField id="al-issues" label="특이사항" value={form.issues} onChange={(v) => update('issues', v)} disabled={submitting} />
          <TextareaField id="al-next" label="다음 계획" value={form.nextPlan} onChange={(v) => update('nextPlan', v)} disabled={submitting} />
        </div>

        <ActivityFileSection
          files={files}
          onChange={setFiles}
          pathPrefix={form.programId || 'misc'}
          disabled={submitting}
          enablePaste={open}
        />

        {errorMsg && (
          <div role="alert" className="rounded-xl bg-danger/10 border border-danger/20 px-4 py-2.5 text-sm text-danger">{errorMsg}</div>
        )}
      </form>
    </Modal>
  );
}

function SelectField({
  label, value, onChange, options, disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { id: string; name: string }[];
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-semibold text-slate-700">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20">
        <option value="">선택 없음</option>
        {options.map((o) => (<option key={o.id} value={o.id}>{o.name}</option>))}
      </select>
    </div>
  );
}

function TextareaField({
  id, label, value, onChange, disabled,
}: { id: string; label: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-slate-700">{label}</label>
      <textarea
        id={id}
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60 resize-none"
      />
    </div>
  );
}
