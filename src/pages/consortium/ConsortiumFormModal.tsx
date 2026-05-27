// bal24 v2 — 컨소시엄 등록·수정 모달 (STEP-CON-B: 수정 모드 추가)
// 신규: 기본정보 + 주관사 + 참여사 동적 추가/삭제 (consortium_members)
// 수정: 기본정보·주관사 UPDATE만 (참여사 변경은 후속 STEP-CON-C)

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Modal, Button, Input } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { CONSORTIUM_STATUS_VALUES } from './consortiumStatus';
import ConsortiumMembersField, {
  makeMember,
  type MemberDraft,
} from './ConsortiumMembersField';
import ConsortiumOperatorField from './ConsortiumOperatorField';
import ConsortiumLeadOrgField from './ConsortiumLeadOrgField';
import {
  fetchMemberDrafts, replaceMembers, createConsortiumWithMembers, translateConsortiumError,
  fetchOperatorDraft, makeEmptyOperator, buildClientLookup, validateOnlyOneSelf,
  type OperatorDraft,
} from './consortiumMembersUtils';
import { useToast } from '../../contexts/ToastContext';
import type {
  Client,
  ConsortiumStatus,
  Project,
} from '../../types/database';
// 박경수님 2026-05-27 STEP-CONSORTIUM-FORM-AI-AUTOFILL — 문서 업로드 → AI 자동채우기
import ConsortiumAutoFillSection from './components/ConsortiumAutoFillSection';
import { useConsortiumAutoFill } from './hooks/useConsortiumAutoFill';
import {
  buildFormPatch, buildMemberDrafts, buildOperatorDraft,
  countFilledFields, isOnlyEmptyDefault,
} from './consortiumAutoFillUtils';

// 박경수님 2026-05-27 STEP-CONSORTIUM-FORM-V2 — 자사 ⭐ 표시 위해 is_own_company 포함.
type ClientOption = Pick<Client, 'id' | 'name'> & { is_own_company?: boolean };
type ProjectOption = Pick<Project, 'id' | 'name'>;

// 박경수님 2026-05-27 STEP-CONSORTIUM-FORM-AI-AUTOFILL — 타입·초기값·fromInitial 분리.
import {
  EMPTY_CONSORTIUM_FORM as EMPTY, fromInitialConsortium as fromInitial,
  type ConsortiumForm, type ConsortiumInitialData,
} from './consortiumFormTypes';
export type { ConsortiumInitialData };

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  /** 수정 모드 — 값이 있으면 UPDATE 모드로 동작 */
  initialData?: ConsortiumInitialData;
};

export default function ConsortiumFormModal({ open, onClose, onCreated, initialData }: Props) {
  const toast = useToast();
  const isEditMode = !!initialData?.id;
  const [form, setForm] = useState<ConsortiumForm>(initialData ? fromInitial(initialData) : EMPTY);
  const [members, setMembers] = useState<MemberDraft[]>([makeMember()]);
  // 박경수님 2026-05-27 STEP-CONSORTIUM-FORM-V2 — 운영사(밸런스닷·총괄) 상태 분리
  const [operator, setOperator] = useState<OperatorDraft>(makeEmptyOperator());
  const [membersLoading, setMembersLoading] = useState(false);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loadingRefs, setLoadingRefs] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 박경수님 2026-05-27 STEP-CONSORTIUM-FORM-AI-AUTOFILL — 자동채우기 훅
  const { analyze, isAnalyzing, analyzeError, setAnalyzeError } = useConsortiumAutoFill();

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingRefs(true);
    // STEP-TRASH-FILTER-AUDIT — 휴지통 옵션 노출 차단
    // 박경수님 2026-05-27 — is_own_company 도 가져와서 자사 ⭐ 정렬
    Promise.all([
      supabase
        .from('clients')
        .select('id, name, is_own_company')
        .is('deleted_at', null)
        .order('is_own_company', { ascending: false })
        .order('name', { ascending: true }),
      supabase.from('projects').select('id, name').is('deleted_at', null).order('created_at', { ascending: false }),
    ]).then(([cRes, pRes]) => {
      if (cancelled) return;
      if (cRes.error) console.error('[consortium] 고객사 조회 실패:', cRes.error.message);
      else setClients((cRes.data ?? []) as ClientOption[]);
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
      setOperator(makeEmptyOperator());
      setNameError(null);
      setErrorMsg(null);
      return;
    }
    setForm(initialData ? fromInitial(initialData) : EMPTY);
    setMembers([makeMember()]);
    setOperator(makeEmptyOperator());
    setNameError(null);
    setErrorMsg(null);
  }, [open, initialData]);

  // 수정 모드에서 기존 운영사 + 참여사 fetch
  useEffect(() => {
    if (!open || !isEditMode || !initialData?.id) return;
    let cancelled = false;
    setMembersLoading(true);
    void (async () => {
      const [op, mem] = await Promise.all([
        fetchOperatorDraft(initialData.id),
        fetchMemberDrafts(initialData.id),
      ]);
      if (cancelled) return;
      if (mem.error) {
        toast.error('참여사 정보를 불러오지 못했어요.');
      } else {
        setMembers(mem.drafts);
      }
      setOperator(op);
      setMembersLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, isEditMode, initialData?.id, toast]);

  const update = <K extends keyof ConsortiumForm>(key: K, value: ConsortiumForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // 박경수님 2026-05-27 STEP-CONSORTIUM-FORM-AI-AUTOFILL — AI 결과 → 폼 매칭.
  // 매칭 규칙. 기존 입력값이 비어 있을 때만 덮어쓰기, 채워진 값은 보존.
  const handleAutoFill = async (file: File) => {
    setErrorMsg(null);
    const result = await analyze(file);
    if (!result) return;
    setForm((prev) => ({ ...prev, ...buildFormPatch(prev, result, clients) }));
    // 운영사 — 비어 있을 때만 AI 결과로 채움
    if (!operator.clientId) {
      const opDraft = buildOperatorDraft(result, clients);
      if (opDraft.clientId || opDraft.contactName) setOperator(opDraft);
    }
    if (isOnlyEmptyDefault(members)) {
      const drafts = buildMemberDrafts(result, clients);
      if (drafts.length > 0) setMembers(drafts);
    }
    toast.success(`AI 가 ${countFilledFields(result)}개 항목을 채웠어요. 확인 후 수정해 주세요.`);
  };

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
    // 박경수님 2026-05-27 — 자사 행은 운영사 또는 참여사 중 한 곳에만 1개
    const lookup = buildClientLookup(clients);
    const selfErr = validateOnlyOneSelf(operator.clientId, members, lookup);
    if (selfErr) {
      setErrorMsg(selfErr);
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!validate()) return;

    setSubmitting(true);
    try {
      const totalBudgetNum = form.totalBudget.trim() ? Number(form.totalBudget.replace(/[^0-9.-]/g, '')) : null;
      if (isEditMode && initialData) {
        // 수정 모드 — consortiums UPDATE → 참여사 일괄 DELETE+INSERT (Q4=A)
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
            total_budget: totalBudgetNum,
            updated_at: new Date().toISOString(),
          })
          .eq('id', initialData.id);
        if (uErr) {
          console.error('[consortium] 수정 실패:', uErr.message);
          setErrorMsg(translateConsortiumError(uErr.message, 'update'));
          return;
        }

        const lookup = buildClientLookup(clients);
        const replaceRes = await replaceMembers({
          consortiumId: initialData.id,
          operator,
          drafts: members,
          lookup,
        });
        if (replaceRes.error) {
          const msg = replaceRes.stage === 'delete'
            ? '참여사 초기화에 실패했어요. 잠시 후 다시 시도해 주세요.'
            : '참여사 저장에 실패했어요. (기본 정보는 수정됐어요. 다시 저장해 주세요.)';
          setErrorMsg(msg);
          return;
        }
        toast.success('컨소시엄이 수정됐어요.');
        onCreated();
        onClose();
        return;
      }

      // 신규 등록 — utils 위임
      const lookup = buildClientLookup(clients);
      const res = await createConsortiumWithMembers({
        payload: {
          name: form.name.trim(),
          project_id: form.projectId || null,
          status: form.status,
          lead_client_id: form.leadClientId || null,
          description: form.description.trim() || null,
          start_date: form.startDate || null,
          end_date: form.endDate || null,
          total_budget: totalBudgetNum,
        },
        operator,
        drafts: members,
        lookup,
      });
      if (res.error) {
        setErrorMsg(translateConsortiumError(res.error, res.ctx ?? 'insert'));
        if (res.ctx !== 'member') return; // 컨소시엄 등록 자체 실패
      }
      onCreated();
      onClose();
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[consortium] 등록 실패:', raw);
      setErrorMsg(translateConsortiumError(raw, 'insert'));
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
      description={isEditMode ? '기본 정보·의뢰기관·운영사·참여사를 수정해요.' : '컨소시엄명만 필수예요. 의뢰기관·운영사(밸런스닷)·참여사를 단계별로 입력하세요.'}
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
        {/* 박경수님 2026-05-27 STEP-CONSORTIUM-FORM-AI-AUTOFILL — 신규 등록 시 문서 업로드 자동채우기 */}
        {!isEditMode && (
          <ConsortiumAutoFillSection
            isAnalyzing={isAnalyzing}
            disabled={submitting}
            analyzeError={analyzeError}
            onFile={(file) => void handleAutoFill(file)}
            onClearError={() => setAnalyzeError(null)}
          />
        )}

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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input type="date" label="시작일" value={form.startDate} onChange={(e) => update('startDate', e.target.value)} disabled={submitting} />
            <Input type="date" label="종료일" value={form.endDate} onChange={(e) => update('endDate', e.target.value)} disabled={submitting} />
            <Input
              type="text" inputMode="numeric" label="총사업비 (원)"
              value={form.totalBudget}
              onChange={(e) => update('totalBudget', e.target.value)}
              disabled={submitting}
              placeholder="예) 50000000"
              helperText="컨소시엄 전체 예산. 참여사별 배분은 아래 지분율로 자동 계산"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="consortium-desc" className="text-sm font-semibold text-slate-700">사업 개요 · 세부내용</label>
            <textarea
              id="consortium-desc"
              rows={5}
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              disabled={submitting}
              placeholder="목표·배경·기간·기대효과·주요 사업내용 등을 자유롭게 작성하세요."
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60 resize-y"
            />
          </div>
        </section>

        {/* 박경수님 2026-05-27 STEP-CONSORTIUM-FORM-V2 — 의뢰기관(발주처) — 역할은 감수·검수만 */}
        <ConsortiumLeadOrgField
          leadClientId={form.leadClientId}
          leadRole={form.leadRole}
          onClientChange={(id) => update('leadClientId', id)}
          onRoleChange={(role) => update('leadRole', role)}
          clients={clients}
          loadingRefs={loadingRefs}
          submitting={submitting}
        />

        {/* 박경수님 2026-05-27 STEP-CONSORTIUM-FORM-V2 — 운영사(밸런스닷·총괄) 섹션 */}
        <ConsortiumOperatorField
          value={operator}
          onChange={setOperator}
          clients={clients}
          loadingRefs={loadingRefs}
          submitting={submitting}
        />

        {membersLoading ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
            참여사 정보를 불러오는 중…
          </div>
        ) : (
          <ConsortiumMembersField
            value={members}
            onChange={setMembers}
            clients={clients}
            loadingRefs={loadingRefs}
            submitting={submitting}
          />
        )}

        {errorMsg && (
          <div role="alert" className="rounded-xl bg-danger/10 border border-danger/20 px-4 py-2.5 text-sm text-danger">{errorMsg}</div>
        )}
      </form>
    </Modal>
  );
}
