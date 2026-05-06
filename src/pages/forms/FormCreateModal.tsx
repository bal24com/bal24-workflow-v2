// bal24 v2 — 외부 공개 폼 생성/수정 모달
// 동적 필드 빌더 (이름·전화·이메일 자동 포함, 추가 필드 사용자 정의)

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { Modal, Button, Input } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import type {
  FormFieldSpec, FormFieldType, FormType, Program, PublicForm,
} from '../../types/database';

type Props = {
  open: boolean;
  programs: Pick<Program, 'id' | 'name'>[];
  defaultProgramId?: string;
  form?: PublicForm | null;
  onClose: () => void;
  onSaved: () => void;
};

type FormState = {
  programId: string;
  title: string;
  description: string;
  formType: FormType;
  maxApplicants: string;
  openAt: string;
  closeAt: string;
  isActive: boolean;
  fields: FormFieldSpec[];
};

const DEFAULT_FIELDS: FormFieldSpec[] = [
  { key: 'name',  label: '이름',   type: 'text', required: true },
  { key: 'phone', label: '전화',   type: 'text', required: true },
  { key: 'email', label: '이메일', type: 'text', required: false },
];

const FIELD_TYPE_LABELS: Record<FormFieldType, string> = {
  text: '단문', number: '숫자', select: '선택', textarea: '장문', date: '날짜',
};
const FIELD_TYPE_VALUES: FormFieldType[] = ['text', 'number', 'select', 'textarea', 'date'];

const EMPTY = (programId = ''): FormState => ({
  programId,
  title: '',
  description: '',
  formType: 'application',
  maxApplicants: '',
  openAt: '',
  closeAt: '',
  isActive: true,
  fields: [...DEFAULT_FIELDS],
});

function slugify(label: string): string {
  return label.trim().toLowerCase().replace(/[^a-z0-9가-힣]+/g, '_').slice(0, 30) || `f_${Date.now()}`;
}

function translateError(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes('row-level security')) return '권한이 없어요. 관리자에게 문의해 주세요.';
  return '저장 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.';
}

export default function FormCreateModal({
  open, programs, defaultProgramId, form, onClose, onSaved,
}: Props) {
  const [state, setState] = useState<FormState>(EMPTY(defaultProgramId));
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (form) {
      setState({
        programId: form.program_id,
        title: form.title,
        description: form.description ?? '',
        formType: form.form_type,
        maxApplicants: form.max_applicants != null ? String(form.max_applicants) : '',
        openAt: form.open_at ? form.open_at.slice(0, 16) : '',
        closeAt: form.close_at ? form.close_at.slice(0, 16) : '',
        isActive: form.is_active,
        fields: form.fields?.length ? form.fields : [...DEFAULT_FIELDS],
      });
    } else {
      setState(EMPTY(defaultProgramId));
    }
    setErrorMsg(null);
  }, [open, form, defaultProgramId]);

  const update = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setState((p) => ({ ...p, [k]: v }));
  };

  const addField = () => {
    update('fields', [...state.fields, { key: `field_${Date.now()}`, label: '새 필드', type: 'text', required: false }]);
  };
  const removeField = (idx: number) => {
    if (state.fields.length <= 1) return;
    update('fields', state.fields.filter((_, i) => i !== idx));
  };
  const moveField = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= state.fields.length) return;
    const next = [...state.fields];
    [next[idx], next[target]] = [next[target], next[idx]];
    update('fields', next);
  };
  const updateField = (idx: number, patch: Partial<FormFieldSpec>) => {
    const next = state.fields.map((f, i) => (i === idx ? { ...f, ...patch } : f));
    update('fields', next);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!state.programId) { setErrorMsg('프로그램을 선택해 주세요.'); return; }
    if (!state.title.trim()) { setErrorMsg('제목을 입력해 주세요.'); return; }
    if (state.fields.length === 0) { setErrorMsg('수집 필드를 1개 이상 추가해 주세요.'); return; }
    if (state.openAt && state.closeAt && state.openAt > state.closeAt) {
      setErrorMsg('마감일이 시작일보다 빠를 수 없어요.'); return;
    }

    let max: number | null = null;
    if (state.maxApplicants.trim()) {
      const n = Number(state.maxApplicants);
      if (Number.isNaN(n) || n < 1) { setErrorMsg('모집 인원은 1 이상의 숫자여야 해요.'); return; }
      max = n;
    }

    // key 정규화 + 빈 라벨 검증
    const cleanFields: FormFieldSpec[] = state.fields.map((f, i) => {
      const label = f.label.trim() || `필드 ${i + 1}`;
      const key = f.key && /^[\w-]+$/.test(f.key) ? f.key : slugify(label);
      const opts = f.type === 'select'
        ? (f.options ?? []).map((o) => o.trim()).filter(Boolean)
        : undefined;
      return { key, label, type: f.type, required: !!f.required, options: opts };
    });

    setSubmitting(true);
    try {
      const payload = {
        program_id: state.programId,
        title: state.title.trim(),
        description: state.description.trim() || null,
        form_type: state.formType,
        max_applicants: max,
        open_at: state.openAt ? new Date(state.openAt).toISOString() : null,
        close_at: state.closeAt ? new Date(state.closeAt).toISOString() : null,
        is_active: state.isActive,
        fields: cleanFields,
      };
      const { error } = form
        ? await supabase.from('public_forms').update(payload).eq('id', form.id)
        : await supabase.from('public_forms').insert(payload);
      if (error) throw error;
      onSaved();
      onClose();
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[forms] 저장 실패:', raw);
      setErrorMsg(translateError(raw));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={form ? '폼 수정' : '폼 만들기'}
      description="공개 URL은 저장 후 폼 카드에서 복사할 수 있어요."
      size="lg"
      closeOnBackdrop={!submitting}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submitting}>취소</Button>
          <Button type="submit" form="form-create" variant="primary" loading={submitting}>저장하기</Button>
        </>
      }
    >
      <form id="form-create" onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">프로그램 <span className="text-danger">*</span></label>
            <select value={state.programId} onChange={(e) => update('programId', e.target.value)} disabled={submitting}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20">
              <option value="">선택해 주세요</option>
              {programs.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">폼 유형</label>
            <select value={state.formType} onChange={(e) => update('formType', e.target.value as FormType)} disabled={submitting}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20">
              <option value="application">신청서</option>
              <option value="survey">설문</option>
              <option value="feedback">피드백</option>
            </select>
          </div>
        </div>

        <Input label="제목" required value={state.title} onChange={(e) => update('title', e.target.value)} disabled={submitting} placeholder="예) 2026 봄 청년 리더십 워크샵 신청" />

        <div className="space-y-1.5">
          <label htmlFor="form-desc" className="text-sm font-semibold text-slate-700">설명</label>
          <textarea id="form-desc" rows={2} value={state.description} onChange={(e) => update('description', e.target.value)} disabled={submitting}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 resize-none" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input label="모집 인원" inputMode="numeric" value={state.maxApplicants} onChange={(e) => update('maxApplicants', e.target.value)} disabled={submitting} placeholder="비우면 무제한" />
          <Input type="datetime-local" label="신청 시작" value={state.openAt} onChange={(e) => update('openAt', e.target.value)} disabled={submitting} />
          <Input type="datetime-local" label="신청 마감" value={state.closeAt} onChange={(e) => update('closeAt', e.target.value)} disabled={submitting} />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={state.isActive} onChange={(e) => update('isActive', e.target.checked)} disabled={submitting}
            className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary/30" />
          <span className="font-semibold text-slate-700">활성</span>
          <span className="text-xs text-muted">(꺼두면 외부 접근 시 "신청이 마감되었습니다" 표시)</span>
        </label>

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">수집 필드 ({state.fields.length})</h3>
            <Button type="button" variant="outline" size="sm" leftIcon={<Plus size={12} />} onClick={addField} disabled={submitting}>필드 추가</Button>
          </div>
          <div className="space-y-2">
            {state.fields.map((f, idx) => (
              <div key={idx} className="rounded-xl border border-slate-200 bg-slate-50/40 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">#{idx + 1} (key: {f.key || '–'})</span>
                  <div className="flex items-center gap-0.5">
                    <button type="button" onClick={() => moveField(idx, -1)} disabled={submitting || idx === 0}
                      className="p-1 rounded text-slate-400 hover:text-text disabled:opacity-30" aria-label="위로"><ArrowUp size={12} /></button>
                    <button type="button" onClick={() => moveField(idx, 1)} disabled={submitting || idx === state.fields.length - 1}
                      className="p-1 rounded text-slate-400 hover:text-text disabled:opacity-30" aria-label="아래로"><ArrowDown size={12} /></button>
                    {state.fields.length > 1 && (
                      <button type="button" onClick={() => removeField(idx)} disabled={submitting}
                        className="p-1 rounded text-slate-400 hover:text-danger hover:bg-danger/5" aria-label="삭제"><Trash2 size={12} /></button>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <Input label="라벨" value={f.label} onChange={(e) => updateField(idx, { label: e.target.value })} disabled={submitting} />
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700">유형</label>
                    <select value={f.type} onChange={(e) => updateField(idx, { type: e.target.value as FormFieldType })} disabled={submitting}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20">
                      {FIELD_TYPE_VALUES.map((t) => (<option key={t} value={t}>{FIELD_TYPE_LABELS[t]}</option>))}
                    </select>
                  </div>
                  <label className="flex items-end gap-2 text-sm pb-2">
                    <input type="checkbox" checked={!!f.required} onChange={(e) => updateField(idx, { required: e.target.checked })} disabled={submitting}
                      className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary/30" />
                    <span className="font-semibold text-slate-700">필수</span>
                  </label>
                </div>
                {f.type === 'select' && (
                  <Input
                    label="옵션 (쉼표 구분)"
                    value={(f.options ?? []).join(', ')}
                    onChange={(e) => updateField(idx, { options: e.target.value.split(',').map((s) => s.trim()) })}
                    disabled={submitting}
                    placeholder="예) 초급, 중급, 고급"
                  />
                )}
              </div>
            ))}
          </div>
        </section>

        {errorMsg && (
          <div role="alert" className="rounded-xl bg-danger/10 border border-danger/20 px-4 py-2.5 text-sm text-danger">{errorMsg}</div>
        )}
      </form>
    </Modal>
  );
}
