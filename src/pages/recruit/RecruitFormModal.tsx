// bal24 v2 — 모집 공고 등록·수정 모달 (STEP 11 옵션 B)

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Modal, Button, Input } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';
import { RECRUIT_TYPE_LABEL, type RecruitForm, type RecruitType } from '../../types/application';
import type { Program } from '../../types/database';

interface Props {
  editTarget?: RecruitForm;
  onClose: () => void;
  onSaved: () => void;
}

interface FormState {
  programId: string;
  recruitType: RecruitType;
  title: string;
  description: string;
  requirements: string;
  benefits: string;
  deadline: string;
  maxCount: string;
}

const EMPTY: FormState = {
  programId: '',
  recruitType: 'instructor',
  title: '',
  description: '',
  requirements: '',
  benefits: '',
  deadline: '',
  maxCount: '',
};

export default function RecruitFormModal({ editTarget, onClose, onSaved }: Props) {
  const isEdit = Boolean(editTarget);
  const toast = useToast();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [programs, setPrograms] = useState<Pick<Program, 'id' | 'name'>[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from('programs')
        .select('id, name')
        .order('created_at', { ascending: false });
      if (cancelled) return;
      if (error) console.error('[recruit-form] 프로그램 조회 실패:', error.message);
      setPrograms((data as Pick<Program, 'id' | 'name'>[] | null) ?? []);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (editTarget) {
      setForm({
        programId: editTarget.program_id,
        recruitType: editTarget.recruit_type,
        title: editTarget.title,
        description: editTarget.description ?? '',
        requirements: editTarget.requirements ?? '',
        benefits: editTarget.benefits ?? '',
        deadline: editTarget.deadline ?? '',
        maxCount: editTarget.max_count != null ? String(editTarget.max_count) : '',
      });
    } else {
      setForm(EMPTY);
    }
  }, [editTarget]);

  const update = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((p) => ({ ...p, [k]: v }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.programId) {
      toast.error('연결할 프로그램을 선택해 주세요.');
      return;
    }
    if (!form.title.trim()) {
      toast.error('공고 제목을 입력해 주세요.');
      return;
    }

    setSubmitting(true);
    try {
      const maxCountNum = form.maxCount.trim() ? Number(form.maxCount) : null;
      if (maxCountNum != null && (Number.isNaN(maxCountNum) || maxCountNum < 1)) {
        toast.error('모집 인원은 1 이상의 숫자여야 해요.');
        setSubmitting(false);
        return;
      }
      const payload = {
        program_id: form.programId,
        recruit_type: form.recruitType,
        title: form.title.trim(),
        description: form.description.trim() || null,
        requirements: form.requirements.trim() || null,
        benefits: form.benefits.trim() || null,
        deadline: form.deadline || null,
        max_count: maxCountNum,
        updated_at: new Date().toISOString(),
      };

      const { error } = isEdit && editTarget
        ? await supabase.from('recruit_forms').update(payload).eq('id', editTarget.id)
        : await supabase.from('recruit_forms').insert(payload);
      if (error) throw error;
      toast.success(isEdit ? '공고를 수정했어요.' : '공고를 등록했어요.');
      onSaved();
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[recruit-form] 저장 실패:', raw);
      toast.error('저장 중 오류가 발생했어요.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? '모집 공고 수정' : '모집 공고 등록'}
      description="공고 등록 후 form_token 으로 외부에 공유할 수 있어요."
      size="brand"
      closeOnBackdrop={!submitting}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submitting}>취소</Button>
          <Button type="submit" form="recruit-form" variant="primary" loading={submitting}>
            {isEdit ? '수정 완료' : '저장하기'}
          </Button>
        </>
      }
    >
      <form id="recruit-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-slate-700">연결 프로그램 <span className="text-rose-500">*</span></label>
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">모집 유형</label>
            <select
              value={form.recruitType}
              onChange={(e) => update('recruitType', e.target.value as RecruitType)}
              disabled={submitting}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              {(Object.keys(RECRUIT_TYPE_LABEL) as RecruitType[]).map((t) => (
                <option key={t} value={t}>{RECRUIT_TYPE_LABEL[t]}</option>
              ))}
            </select>
          </div>
          <Input type="number" label="모집 인원" value={form.maxCount} onChange={(e) => update('maxCount', e.target.value)} disabled={submitting} placeholder="예) 3" min={1} />
        </div>

        <Input label="공고 제목" required value={form.title} onChange={(e) => update('title', e.target.value)} disabled={submitting} placeholder="예) 2026년 봄학기 강사 모집" />

        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-slate-700">공고 설명</label>
          <textarea
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            disabled={submitting}
            rows={3}
            placeholder="공고 개요·일정·운영 방식 등을 적어주세요."
            className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">자격 요건</label>
            <textarea
              value={form.requirements}
              onChange={(e) => update('requirements', e.target.value)}
              disabled={submitting}
              rows={3}
              placeholder="예) 관련 분야 3년 이상 경력"
              className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">혜택·보상</label>
            <textarea
              value={form.benefits}
              onChange={(e) => update('benefits', e.target.value)}
              disabled={submitting}
              rows={3}
              placeholder="예) 강사료 시급 80,000원"
              className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
            />
          </div>
        </div>

        <Input type="date" label="마감일" value={form.deadline} onChange={(e) => update('deadline', e.target.value)} disabled={submitting} />
      </form>
    </Modal>
  );
}
