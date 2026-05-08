// bal24 v2 — 컨소시엄 등록·수정 모달 (STEP-CON-B: 수정 모드 추가)
// 신규: 기본정보 + 주관사 + 참여사 동적 추가/삭제 (consortium_members)
// 수정: 기본정보·주관사 UPDATE만 (참여사 변경은 후속 STEP-CON-C)

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Modal, Button, Input } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import {
  CONSORTIUM_STATUS_VALUES,
  CONSORTIUM_ROLE_VALUES,
} from './consortiumStatus';
import ConsortiumMembersField, {
  makeMember,
  type MemberDraft,
} from './ConsortiumMembersField';
import type {
  Client,
  ConsortiumRole,
  ConsortiumStatus,
  Project,
} from '../../types/database';

type ClientOption = Pick<Client, 'id' | 'name'>;
type ProjectOption = Pick<Project, 'id' | 'name'>;

export interface ConsortiumInitialData {
  id: string;
  name: string;
  description: string;
  lead_client_id: string | null;
  project_id: string | null;
  status: ConsortiumStatus;
  start_date: string;
  end_date: string;
}

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  /** 수정 모드 — 값이 있으면 UPDATE 모드로 동작 */
  initialData?: ConsortiumInitialData;
};

type ConsortiumForm = {
  name: string;
  projectId: string;
  status: ConsortiumStatus;
  leadClientId: string;
  leadRole: ConsortiumRole;
  description: string;
  startDate: string;
  endDate: string;
};

const EMPTY: ConsortiumForm = {
  name: '', projectId: '', status: '구성중',
  leadClientId: '', leadRole: '주관',
  description: '',
  startDate: '', endDate: '',
};

function fromInitial(d: ConsortiumInitialData): ConsortiumForm {
  return {
    name: d.name,
    projectId: d.project_id ?? '',
    status: d.status,
    leadClientId: d.lead_client_id ?? '',
    leadRole: '주관',
    description: d.description,
    startDate: d.start_date,
    endDate: d.end_date,
  };
}

function translateError(raw: string, ctx: 'insert' | 'update' | 'member'): string {
  const m = raw.toLowerCase();
  if (m.includes('column') && m.includes('does not exist')) {
    return '컨소시엄 테이블 컬럼이 아직 적용되지 않았어요. Supabase에서 마이그레이션을 실행해 주세요.';
  }
  if (m.includes('row-level security') || m.includes('permission denied')) {
    return '저장 권한이 없어요. 관리자에게 문의해 주세요.';
  }
  if (ctx === 'member') return '참여사 저장 중 오류가 발생했어요. (컨소시엄은 등록되었어요)';
  if (ctx === 'update') return '컨소시엄 수정 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.';
  return '컨소시엄 등록 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.';
}

export default function ConsortiumFormModal({ open, onClose, onCreated, initialData }: Props) {
  const isEditMode = !!initialData?.id;
  const [form, setForm] = useState<ConsortiumForm>(initialData ? fromInitial(initialData) : EMPTY);
  const [members, setMembers] = useState<MemberDraft[]>([makeMember()]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loadingRefs, setLoadingRefs] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingRefs(true);
    Promise.all([
      supabase.from('clients').select('id, name').order('name', { ascending: true }),
      supabase.from('projects').select('id, name').order('created_at', { ascending: false }),
    ]).then(([cRes, pRes]) => {
      if (cancelled) return;
      if (cRes.error) console.error('[consortium] 고객사 조회 실패:', cRes.error.message);
      else setClients(cRes.data ?? []);
      if (pRes.error) console.error('[consortium] 프로젝트 조회 실패:', pRes.error.message);
      else setProjects(pRes.data ?? []);
      setLoadingRefs(false);
    });
    return () => { cancelled = true; };
  }, [open]);

  // 모달 열릴 때마다 폼 초기값 동기화 (initialData 가 바뀌면 pre-fill)
  useEffect(() => {
    if (!open) {
      setForm(EMPTY);
      setMembers([makeMember()]);
      setNameError(null);
      setErrorMsg(null);
      return;
    }
    setForm(initialData ? fromInitial(initialData) : EMPTY);
    setMembers([makeMember()]);
    setNameError(null);
    setErrorMsg(null);
  }, [open, initialData]);

  const update = <K extends keyof ConsortiumForm>(key: K, value: ConsortiumForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateMember = (uid: string, patch: Partial<MemberDraft>) => {
    setMembers((prev) => prev.map((m) => (m.uid === uid ? { ...m, ...patch } : m)));
  };

  const addMember = () => setMembers((prev) => [...prev, makeMember()]);
  const removeMember = (uid: string) =>
    setMembers((prev) => (prev.length > 1 ? prev.filter((m) => m.uid !== uid) : prev));

  const validate = (): boolean => {
    if (!form.name.trim()) {
      setNameError('컨소시엄명을 입력해 주세요.');
      return false;
    }
    setNameError(null);
    for (const mem of members) {
      if (!mem.clientId) continue; // 비어있는 행은 무시
      if (mem.shareRatio.trim()) {
        const n = Number(mem.shareRatio);
        if (Number.isNaN(n) || n < 0 || n > 100) {
          setErrorMsg('지분율은 0 ~ 100 사이 숫자로 입력해 주세요.');
          return false;
        }
      }
    }
    return true;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!validate()) return;

    setSubmitting(true);
    try {
      if (isEditMode && initialData) {
        // 수정 모드 — consortiums UPDATE만 (참여사 변경은 STEP-CON-C)
        const { error: uErr } = await supabase
          .from('consortiums')
          .update({
            name: form.name.trim(),
            project_id: form.projectId || null,
            status: form.status,
            lead_client_id: form.leadClientId || null,
            description: form.description.trim() || null,
            start_date: form.startDate || null,
            end_date: form.endDate || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', initialData.id);
        if (uErr) {
          console.error('[consortium] 수정 실패:', uErr.message);
          setErrorMsg(translateError(uErr.message, 'update'));
          return;
        }
        onCreated();
        onClose();
        return;
      }

      // 신규 등록
      const { data: cData, error: cErr } = await supabase
        .from('consortiums')
        .insert({
          name: form.name.trim(),
          project_id: form.projectId || null,
          status: form.status,
          lead_client_id: form.leadClientId || null,
          description: form.description.trim() || null,
          start_date: form.startDate || null,
          end_date: form.endDate || null,
        })
        .select('id')
        .single();
      if (cErr) throw cErr;

      // 주관사 + 참여사 행을 consortium_members에 일괄 INSERT
      const memberRows: Array<Record<string, unknown>> = [];
      if (form.leadClientId) {
        const lead = clients.find((c) => c.id === form.leadClientId);
        memberRows.push({
          consortium_id: cData.id,
          client_id: form.leadClientId,
          org_name: lead?.name ?? '주관사',
          role: form.leadRole,
        });
      }
      for (const mem of members) {
        if (!mem.clientId) continue;
        const target = clients.find((c) => c.id === mem.clientId);
        memberRows.push({
          consortium_id: cData.id,
          client_id: mem.clientId,
          org_name: target?.name ?? '참여사',
          role: mem.role || null,
          budget_ratio: mem.shareRatio.trim() ? Number(mem.shareRatio) : null,
          responsibilities: mem.responsibilities.trim() || null,
        });
      }

      if (memberRows.length > 0) {
        const { error: mErr } = await supabase.from('consortium_members').insert(memberRows);
        if (mErr) {
          console.error('[consortium] 참여사 저장 실패:', mErr.message);
          setErrorMsg(translateError(mErr.message, 'member'));
        }
      }

      onCreated();
      onClose();
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[consortium] 등록 실패:', raw);
      setErrorMsg(translateError(raw, 'insert'));
    } finally {
      setSubmitting(false);
    }
  };

  const SELECT_CLASS =
    'w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditMode ? '컨소시엄 수정' : '컨소시엄 신규 등록'}
      description={isEditMode ? '기본 정보·주관사를 수정해요. 참여사 변경은 후속 기능에서 가능해요.' : '컨소시엄명만 필수예요. 참여사는 여러 곳 추가할 수 있어요.'}
      size="lg"
      closeOnBackdrop={!submitting}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submitting}>취소</Button>
          <Button type="submit" form="consortium-form" variant="primary" loading={submitting}>
            {isEditMode ? '수정 완료' : '저장하기'}
          </Button>
        </>
      }
    >
      <form id="consortium-form" onSubmit={handleSubmit} className="space-y-5" noValidate>
        <section className="space-y-3">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">기본 정보</h3>
          <Input label="컨소시엄명" required value={form.name} onChange={(e) => update('name', e.target.value)} disabled={submitting} error={nameError} placeholder="예) 2026 청년 리더십 컨소시엄" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">상태</label>
              <select
                value={form.status}
                onChange={(e) => update('status', e.target.value as ConsortiumStatus)}
                disabled={submitting}
                className={SELECT_CLASS}
              >
                {CONSORTIUM_STATUS_VALUES.map((s) => (<option key={s} value={s}>{s}</option>))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">연결 프로젝트</label>
              <select
                value={form.projectId}
                onChange={(e) => update('projectId', e.target.value)}
                disabled={submitting || loadingRefs}
                className={SELECT_CLASS}
              >
                <option value="">{loadingRefs ? '불러오는 중…' : '선택 없음'}</option>
                {projects.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              type="date"
              label="시작일"
              value={form.startDate}
              onChange={(e) => update('startDate', e.target.value)}
              disabled={submitting}
            />
            <Input
              type="date"
              label="종료일"
              value={form.endDate}
              onChange={(e) => update('endDate', e.target.value)}
              disabled={submitting}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="consortium-desc" className="text-sm font-semibold text-slate-700">설명</label>
            <textarea
              id="consortium-desc"
              rows={2}
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              disabled={submitting}
              placeholder="목표·배경·기간 등"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60 resize-none"
            />
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">주관사</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">주관사 (clients 선택)</label>
              <select
                value={form.leadClientId}
                onChange={(e) => update('leadClientId', e.target.value)}
                disabled={submitting || loadingRefs}
                className={SELECT_CLASS}
              >
                <option value="">{loadingRefs ? '불러오는 중…' : '선택 없음'}</option>
                {clients.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
              </select>
            </div>
            {!isEditMode && (
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">역할</label>
                <select
                  value={form.leadRole}
                  onChange={(e) => update('leadRole', e.target.value as ConsortiumRole)}
                  disabled={submitting || !form.leadClientId}
                  className={SELECT_CLASS}
                >
                  {CONSORTIUM_ROLE_VALUES.map((r) => (<option key={r} value={r}>{r}</option>))}
                </select>
              </div>
            )}
          </div>
          {!isEditMode && (
            <p className="text-xs text-muted">선택한 주관사는 참여사 목록에도 자동 추가돼요.</p>
          )}
        </section>

        {!isEditMode && (
          <ConsortiumMembersField
            members={members}
            clients={clients}
            loadingRefs={loadingRefs}
            submitting={submitting}
            onAdd={addMember}
            onRemove={removeMember}
            onUpdate={updateMember}
          />
        )}

        {isEditMode && (
          <p className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-2.5 text-xs text-slate-500">
            ⓘ 참여사 추가/변경은 후속 기능에서 지원돼요. 현재는 기본 정보·주관사만 수정할 수 있어요.
          </p>
        )}

        {errorMsg && (
          <div role="alert" className="rounded-xl bg-danger/10 border border-danger/20 px-4 py-2.5 text-sm text-danger">{errorMsg}</div>
        )}
      </form>
    </Modal>
  );
}
