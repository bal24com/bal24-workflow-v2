// bal24 v2 — 출석 세션 등록/수정 모달

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Modal, Button, Input } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import type { AttendanceSession, Program } from '../../types/database';

type Props = {
  open: boolean;
  programs: Pick<Program, 'id' | 'name'>[];
  /** 기본 프로그램 (목록 페이지에서 필터된 것) */
  defaultProgramId?: string;
  /** 기존 세션 수정용. null이면 신규 등록 */
  session?: AttendanceSession | null;
  onClose: () => void;
  onSaved: () => void;
};

type FormState = {
  programId: string;
  curriculumId: string;
  title: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
  location: string;
  tokenExpiresAt: string;
  checkInOpen: boolean;
};

const today = () => new Date().toISOString().slice(0, 10);

const EMPTY = (programId = ''): FormState => ({
  programId,
  curriculumId: '',
  title: '',
  sessionDate: today(),
  startTime: '',
  endTime: '',
  location: '',
  tokenExpiresAt: '',
  checkInOpen: true,
});

function translateError(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes('row-level security')) return '권한이 없어요. 관리자에게 문의해 주세요.';
  if (m.includes('foreign key')) return '연결된 프로그램이 유효하지 않아요.';
  return '저장 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.';
}

export default function AttendanceFormModal({
  open, programs, defaultProgramId, session, onClose, onSaved,
}: Props) {
  const [form, setForm] = useState<FormState>(EMPTY(defaultProgramId));
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (session) {
      setForm({
        programId: session.program_id,
        curriculumId: session.curriculum_id ?? '',
        title: session.title,
        sessionDate: session.session_date,
        startTime: session.start_time?.slice(0, 5) ?? '',
        endTime: session.end_time?.slice(0, 5) ?? '',
        location: session.location ?? '',
        tokenExpiresAt: session.token_expires_at?.slice(0, 16) ?? '',
        checkInOpen: session.check_in_open,
      });
    } else {
      setForm(EMPTY(defaultProgramId));
    }
    setErrorMsg(null);
  }, [open, session, defaultProgramId]);

  const update = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((p) => ({ ...p, [k]: v }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!form.programId) { setErrorMsg('프로그램을 선택해 주세요.'); return; }
    if (!form.title.trim()) { setErrorMsg('세션 제목을 입력해 주세요.'); return; }
    if (!form.sessionDate) { setErrorMsg('날짜를 선택해 주세요.'); return; }
    if (form.startTime && form.endTime && form.startTime > form.endTime) {
      setErrorMsg('종료 시간이 시작 시간보다 빠를 수 없어요.'); return;
    }

    setSubmitting(true);
    try {
      const payload = {
        program_id: form.programId,
        curriculum_id: form.curriculumId || null,
        title: form.title.trim(),
        session_date: form.sessionDate,
        start_time: form.startTime || null,
        end_time: form.endTime || null,
        location: form.location.trim() || null,
        token_expires_at: form.tokenExpiresAt ? new Date(form.tokenExpiresAt).toISOString() : null,
        check_in_open: form.checkInOpen,
      };

      const { error } = session
        ? await supabase.from('attendance_sessions').update(payload).eq('id', session.id)
        : await supabase.from('attendance_sessions').insert(payload);

      if (error) throw error;
      onSaved();
      onClose();
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[attendance] 세션 저장 실패:', raw);
      setErrorMsg(translateError(raw));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={session ? '출석 세션 수정' : '출석 세션 등록'}
      description="QR/링크는 저장 후 자동 발급돼요."
      size="md"
      closeOnBackdrop={!submitting}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submitting}>취소</Button>
          <Button type="submit" form="attendance-form" variant="primary" loading={submitting}>저장하기</Button>
        </>
      }
    >
      <form id="attendance-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-slate-700">프로그램 <span className="text-danger">*</span></label>
          <select
            value={form.programId}
            onChange={(e) => update('programId', e.target.value)}
            disabled={submitting}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          >
            <option value="">선택해 주세요</option>
            {programs.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
          </select>
        </div>

        <Input label="커리큘럼 회차 ID (선택)" value={form.curriculumId} onChange={(e) => update('curriculumId', e.target.value)} disabled={submitting} placeholder="UUID 직접 입력 — 추후 select로 교체 예정" helperText="비워두면 회차 연결 없이 저장돼요." />

        <Input label="세션 제목" required value={form.title} onChange={(e) => update('title', e.target.value)} disabled={submitting} placeholder="예) 3회차 오전 출석" />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input type="date" label="날짜" required value={form.sessionDate} onChange={(e) => update('sessionDate', e.target.value)} disabled={submitting} />
          <Input type="time" label="시작" value={form.startTime} onChange={(e) => update('startTime', e.target.value)} disabled={submitting} />
          <Input type="time" label="종료" value={form.endTime} onChange={(e) => update('endTime', e.target.value)} disabled={submitting} />
        </div>

        <Input label="장소" value={form.location} onChange={(e) => update('location', e.target.value)} disabled={submitting} placeholder="예) 본관 3층 강의실 A" />

        <Input type="datetime-local" label="토큰 만료 시각 (선택)" value={form.tokenExpiresAt} onChange={(e) => update('tokenExpiresAt', e.target.value)} disabled={submitting} helperText="비워두면 무제한" />

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.checkInOpen}
            onChange={(e) => update('checkInOpen', e.target.checked)}
            disabled={submitting}
            className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary/30"
          />
          <span className="font-semibold text-slate-700">체크인 링크 활성</span>
          <span className="text-xs text-muted">(꺼두면 외부 링크로 출석 안 됨)</span>
        </label>

        {errorMsg && (
          <div role="alert" className="rounded-xl bg-danger/10 border border-danger/20 px-4 py-2.5 text-sm text-danger">{errorMsg}</div>
        )}
      </form>
    </Modal>
  );
}
