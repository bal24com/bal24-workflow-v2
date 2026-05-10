// bal24 v2 — 프로젝트 신규 등록 모달
// 공통 Modal + Input + Button 사용. Supabase에서 직접 fetch (clients/profiles).

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Modal, Button, Input } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { PROJECT_STATUS_VALUES } from './projectStatus';
import type {
  Client,
  Profile,
  ProjectStatus,
  ProjectType,
} from '../../types/database';
import {
  OUR_ROLE_VALUES, OUR_ROLE_LABELS, OUR_ROLE_DESCRIPTIONS,
  type OurRole,
} from '../../constants/projectRoles';

const PROJECT_TYPES: ProjectType[] = ['교육', '컨설팅', '이벤트'];

type ClientOption = Pick<Client, 'id' | 'name'>;
type ProfileOption = Pick<Profile, 'id' | 'name'>;
type ConsortiumOption = { id: string; name: string };

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
};

export default function ProjectFormModal({ open, onClose, onCreated }: Props) {
  const [name, setName] = useState('');
  const [type, setType] = useState<ProjectType>('교육');
  const [status, setStatus] = useState<ProjectStatus>('제안');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [budget, setBudget] = useState('');
  const [clientId, setClientId] = useState('');
  const [pmId, setPmId] = useState('');
  const [consortiumId, setConsortiumId] = useState('');
  const [description, setDescription] = useState('');
  // STEP-PROJECT-ROLE-UNIFIED-TS — 자사 수행 역할
  const [ourRole, setOurRole] = useState<OurRole>('operator');

  const [clients, setClients] = useState<ClientOption[]>([]);
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [consortiums, setConsortiums] = useState<ConsortiumOption[]>([]);
  const [loadingRefs, setLoadingRefs] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoadingRefs(true);

    Promise.all([
      supabase.from('clients').select('id, name').order('name', { ascending: true }),
      supabase.from('profiles').select('id, name').eq('is_active', true).order('name', { ascending: true }),
      supabase.from('consortiums').select('id, name').in('status', ['구성중', '진행']).order('name', { ascending: true }),
    ])
      .then(([clientsRes, profilesRes, conRes]) => {
        if (cancelled) return;
        if (clientsRes.error) {
          console.error('[projects] 고객사 조회 실패:', clientsRes.error.message);
        } else {
          setClients(clientsRes.data ?? []);
        }
        if (profilesRes.error) {
          console.error('[projects] 담당자 조회 실패:', profilesRes.error.message);
        } else {
          setProfiles(profilesRes.data ?? []);
        }
        if (conRes.error) {
          console.error('[projects] 컨소시엄 조회 실패:', conRes.error.message);
        } else {
          setConsortiums((conRes.data as ConsortiumOption[] | null) ?? []);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingRefs(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (open) return;
    // 모달 닫히면 폼 초기화
    setName('');
    setType('교육');
    setStatus('제안');
    setStartDate('');
    setEndDate('');
    setBudget('');
    setClientId('');
    setPmId('');
    setConsortiumId('');
    setDescription('');
    setOurRole('operator');
    setErrorMsg(null);
    setNameError(null);
  }, [open]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);
    setNameError(null);

    if (!name.trim()) {
      setNameError('프로젝트명을 입력해 주세요.');
      return;
    }
    if (startDate && endDate && startDate > endDate) {
      setErrorMsg('종료일이 시작일보다 빠를 수 없어요.');
      return;
    }

    const parsedBudget = budget.trim() ? Number(budget.replace(/,/g, '')) : null;
    if (parsedBudget !== null && (Number.isNaN(parsedBudget) || parsedBudget < 0)) {
      setErrorMsg('예산은 0 이상의 숫자로 입력해 주세요.');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('projects').insert({
        name: name.trim(),
        type: [type],
        status,
        start_date: startDate || null,
        end_date: endDate || null,
        budget: parsedBudget,
        description: description.trim() || null,
        client_id: clientId || null,
        pm_id: pmId || null,
        consortium_id: consortiumId || null,
        our_role: ourRole,
      });

      if (error) throw error;

      onCreated();
      onClose();
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[projects] 등록 실패:', raw);
      setErrorMsg('프로젝트 등록 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="프로젝트 신규 등록"
      description="필수 항목은 프로젝트명만 입력하면 돼요."
      size="lg"
      closeOnBackdrop={!submitting}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            취소
          </Button>
          <Button
            type="submit"
            form="project-form"
            variant="primary"
            loading={submitting}
          >
            저장하기
          </Button>
        </>
      }
    >
      <form id="project-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Input
          label="프로젝트명"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={submitting}
          error={nameError}
          placeholder="예) 2026 상반기 리더십 워크샵"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">유형</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as ProjectType)}
              disabled={submitting}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
            >
              {PROJECT_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">상태</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ProjectStatus)}
              disabled={submitting}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
            >
              {PROJECT_STATUS_VALUES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            type="date"
            label="시작일"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            disabled={submitting}
          />
          <Input
            type="date"
            label="종료일"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            disabled={submitting}
          />
        </div>

        <Input
          type="text"
          inputMode="numeric"
          label="예산 (원)"
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
          disabled={submitting}
          placeholder="예) 5,000,000"
          helperText="비워두면 미정으로 저장돼요."
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">담당자</label>
            <select
              value={pmId}
              onChange={(e) => setPmId(e.target.value)}
              disabled={submitting || loadingRefs}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
            >
              <option value="">{loadingRefs ? '불러오는 중…' : '선택 없음'}</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">고객사</label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              disabled={submitting || loadingRefs}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
            >
              <option value="">{loadingRefs ? '불러오는 중…' : '선택 없음'}</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">
              컨소시엄 <span className="text-xs font-normal text-slate-400">(선택)</span>
            </label>
            <select
              value={consortiumId}
              onChange={(e) => setConsortiumId(e.target.value)}
              disabled={submitting || loadingRefs}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
            >
              <option value="">연결 안 함 (자체 사업)</option>
              {consortiums.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* STEP-PROJECT-ROLE-UNIFIED-TS — 자사 수행 역할 */}
          <div className="space-y-1.5">
            <label htmlFor="project-our-role" className="text-sm font-semibold text-slate-700">
              수행 역할
            </label>
            <select
              id="project-our-role"
              value={ourRole}
              onChange={(e) => setOurRole(e.target.value as OurRole)}
              disabled={submitting}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
            >
              {OUR_ROLE_VALUES.map((r) => (
                <option key={r} value={r}>
                  {OUR_ROLE_LABELS[r]} ({OUR_ROLE_DESCRIPTIONS[r]})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="project-desc" className="text-sm font-semibold text-slate-700">설명</label>
          <textarea
            id="project-desc"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={submitting}
            placeholder="프로젝트 개요·목표·특이사항을 적어 주세요."
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60 resize-none"
          />
        </div>

        {errorMsg && (
          <div role="alert" className="rounded-xl bg-danger/10 border border-danger/20 px-4 py-2.5 text-sm text-danger">
            {errorMsg}
          </div>
        )}
      </form>
    </Modal>
  );
}
