// 프로젝트 수정 모달 — 박경수님 요청 1번 (ProjectDetailPage 헤더 [수정] 버튼)
// ProjectFormModal 은 신규 only 라 수정 모드 별도 작성. 핵심 필드만 (이름·유형·상태·기간·예산·담당자·고객사·설명).

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Modal, Button, Input } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';
import { PROJECT_STATUS_VALUES } from './projectStatus';
import type { Client, Profile, ProjectStatus, ProjectType } from '../../types/database';

const PROJECT_TYPES: ProjectType[] = ['교육', '컨설팅', '이벤트'];

interface DetailProject {
  id: string;
  name: string;
  type?: string[] | string | null;
  status: ProjectStatus;
  start_date?: string | null;
  end_date?: string | null;
  budget?: number | null;
  description?: string | null;
  client_id?: string | null;
  pm_id?: string | null;
}

type Props = {
  open: boolean;
  project: DetailProject;
  onClose: () => void;
  onSaved: () => void;
};

export default function ProjectEditModal({ open, project, onClose, onSaved }: Props) {
  const toast = useToast();
  const [name, setName] = useState(project.name);
  const [type, setType] = useState<ProjectType>(
    Array.isArray(project.type) ? (project.type[0] as ProjectType) || '교육' : (project.type as ProjectType) || '교육',
  );
  const [status, setStatus] = useState<ProjectStatus>(project.status);
  const [startDate, setStartDate] = useState(project.start_date ?? '');
  const [endDate, setEndDate] = useState(project.end_date ?? '');
  const [budget, setBudget] = useState(project.budget != null ? String(project.budget) : '');
  const [description, setDescription] = useState(project.description ?? '');
  const [clientId, setClientId] = useState(project.client_id ?? '');
  const [pmId, setPmId] = useState(project.pm_id ?? '');
  const [clients, setClients] = useState<Pick<Client, 'id' | 'name'>[]>([]);
  const [profiles, setProfiles] = useState<Pick<Profile, 'id' | 'name'>[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(project.name);
    setType(Array.isArray(project.type) ? (project.type[0] as ProjectType) || '용역' : (project.type as ProjectType) || '용역');
    setStatus(project.status);
    setStartDate(project.start_date ?? '');
    setEndDate(project.end_date ?? '');
    setBudget(project.budget != null ? String(project.budget) : '');
    setDescription(project.description ?? '');
    setClientId(project.client_id ?? '');
    setPmId(project.pm_id ?? '');
    setErrorMsg(null);

    let cancelled = false;
    void (async () => {
      // STEP-TRASH-FILTER-AUDIT — 휴지통 제외
      const [cRes, pRes] = await Promise.all([
        supabase.from('clients').select('id, name').is('deleted_at', null).order('name'),
        supabase.from('profiles').select('id, name').eq('is_active', true).order('name'),
      ]);
      if (cancelled) return;
      if (cRes.data) setClients(cRes.data as Pick<Client, 'id' | 'name'>[]);
      if (pRes.data) setProfiles(pRes.data as Pick<Profile, 'id' | 'name'>[]);
    })();
    return () => { cancelled = true; };
  }, [open, project]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setErrorMsg('프로젝트명을 입력해 주세요.'); return; }
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const parsedBudget = budget.trim() ? Number(budget.replace(/[^0-9.-]/g, '')) : null;
      const { error } = await supabase.from('projects').update({
        name: name.trim(),
        type: [type],
        status,
        start_date: startDate || null,
        end_date: endDate || null,
        budget: parsedBudget,
        description: description.trim() || null,
        client_id: clientId || null,
        pm_id: pmId || null,
        updated_at: new Date().toISOString(),
      }).eq('id', project.id);
      if (error) throw error;
      toast.success('프로젝트를 수정했어요.');
      onSaved();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      console.error('[ProjectEditModal] 저장 오류:', msg);
      setErrorMsg('수정 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="프로젝트 수정"
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>취소</Button>
          <Button type="submit" form="project-edit-form" variant="primary" loading={submitting}>저장하기</Button>
        </>
      }
    >
      <form id="project-edit-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Input label="프로젝트명" required value={name} onChange={(e) => setName(e.target.value)} disabled={submitting} error={errorMsg} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">유형</label>
            <select value={type} onChange={(e) => setType(e.target.value as ProjectType)} disabled={submitting}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60">
              {PROJECT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">상태</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)} disabled={submitting}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60">
              {PROJECT_STATUS_VALUES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input type="date" label="시작일" value={startDate} onChange={(e) => setStartDate(e.target.value)} disabled={submitting} />
          <Input type="date" label="종료일" value={endDate} onChange={(e) => setEndDate(e.target.value)} disabled={submitting} />
        </div>

        <Input type="text" inputMode="numeric" label="예산 (원)" value={budget} onChange={(e) => setBudget(e.target.value)} disabled={submitting} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">담당자 (PM)</label>
            <select value={pmId} onChange={(e) => setPmId(e.target.value)} disabled={submitting}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60">
              <option value="">미지정</option>
              {profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">고객사</label>
            <select value={clientId} onChange={(e) => setClientId(e.target.value)} disabled={submitting}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60">
              <option value="">미지정</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-slate-700">설명</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} disabled={submitting} rows={3}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
            placeholder="프로젝트 개요·메모" />
        </div>
      </form>
    </Modal>
  );
}
