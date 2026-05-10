// bal24 v2 — 프로그램 신규 등록 모달
// 공통 Modal + Input + Button. programs 테이블 INSERT.
// STEP-PROGRAM-TYPE: program_type(13종) + display_order + modules + 템플릿 선택 통합.

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Modal, Button, Input } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { PROGRAM_STATUS_VALUES } from './programStatus';
import type { ExtendedProgramType } from './programTypeConfig';
import ProgramTemplateSelector from './detail/ProgramTemplateSelector';
import ProgramApplicationFields, { validateApplication } from './ProgramApplicationFields';
import ProgramOrgFields, { EMPTY_ORG_VALUES, type ProgramOrgValues } from './ProgramOrgFields';
import ProgramVisibilityField, { type ProgramVisibility } from './ProgramVisibilityField';
import ProgramAutofillSection from './ProgramAutofillSection';
import ProgramDescriptionField from './ProgramDescriptionField';
import PendingSessionsPreview from './PendingSessionsPreview';
import ProgramTypeSelector from './ProgramTypeSelector';
import { applyExtractedProgram, insertPendingSessions, type ExtractedProgram, type ExtractedProgramType, type ExtractedSession } from '../../lib/programAutoFill';
import { useToast } from '../../contexts/ToastContext';
import type { Project, ProgramStatus, ProgramType } from '../../types/database';

/** program_type(14종 영문) → 기존 programs.type(4종 한글) 매핑 — type 컬럼 NOT NULL 호환용 */
function toLegacyType(pt: ExtendedProgramType): ProgramType {
  if (pt === 'education') return '교육';
  if (pt === 'event') return '행사';
  return '기타';
}

type ProjectOption = Pick<Project, 'id' | 'name'>;
type ConsortiumOption = { id: string; name: string };

type Props = { open: boolean; onClose: () => void; onCreated: () => void; defaultProjectId?: string };

export default function ProgramFormModal({ open, onClose, onCreated, defaultProjectId }: Props) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [programType, setProgramType] = useState<ExtendedProgramType>('education');
  const [status, setStatus] = useState<ProgramStatus>('준비');
  const [projectId, setProjectId] = useState(defaultProjectId ?? '');
  const [consortiumId, setConsortiumId] = useState('');
  const [displayOrder, setDisplayOrder] = useState('0');
  const [modules, setModules] = useState<string[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [venue, setVenue] = useState('');
  const [capacity, setCapacity] = useState('');
  const [description, setDescription] = useState('');
  // STEP-PROGRAM-BUNDLE — 기관·부서·교육대상·정원 (분리 컴포넌트)
  const [orgValues, setOrgValues] = useState<ProgramOrgValues>(EMPTY_ORG_VALUES);
  // STEP-PROGRAM-DASHBOARD — AI 추출 차시 (저장 시 program_curriculum bulk INSERT)
  const [pendingSessions, setPendingSessions] = useState<ExtractedSession[]>([]);
  const [visibility, setVisibility] = useState<ProgramVisibility>('internal');
  // STEP-PROGRAM-CREATION-WIZARD — 신청·지원금 6 필드
  const [applicationType, setApplicationType] = useState<'open' | 'evaluation'>('open');
  const [applicationStartDate, setApplicationStartDate] = useState('');
  const [applicationEndDate, setApplicationEndDate] = useState('');
  const [maxApplicants, setMaxApplicants] = useState('');
  const [grantEnabled, setGrantEnabled] = useState(false);
  const [grantBudget, setGrantBudget] = useState('');

  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [consortiums, setConsortiums] = useState<ConsortiumOption[]>([]);
  const [loadingRefs, setLoadingRefs] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoadingRefs(true);

    Promise.all([
      supabase.from('projects').select('id, name').order('created_at', { ascending: false }),
      supabase.from('consortiums').select('id, name').in('status', ['구성중', '진행']).order('name', { ascending: true }),
    ])
      .then(([projRes, conRes]) => {
        if (cancelled) return;
        if (projRes.error) {
          console.error('[programs] 프로젝트 조회 실패:', projRes.error.message);
        } else {
          setProjects(projRes.data ?? []);
        }
        if (conRes.error) {
          console.error('[programs] 컨소시엄 조회 실패:', conRes.error.message);
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
    setName('');
    setProgramType('education');
    setStatus('준비');
    setProjectId(defaultProjectId ?? '');
    setConsortiumId('');
    setDisplayOrder('0');
    setModules([]);
    setStartDate('');
    setEndDate('');
    setVenue('');
    setCapacity('');
    setDescription('');
    setOrgValues(EMPTY_ORG_VALUES);
    setPendingSessions([]);
    setVisibility('internal');
    setApplicationType('open');
    setApplicationStartDate('');
    setApplicationEndDate('');
    setMaxApplicants('');
    setGrantEnabled(false);
    setGrantBudget('');
    setNameError(null);
    setErrorMsg(null);
  }, [open]);

  const handleAutoApply = (prog: ExtractedProgram): number => applyExtractedProgram(prog, {
    setName, setDescription, setStartDate, setEndDate, setVenue,
    setProgramType: (v: ExtractedProgramType) => setProgramType(v as ExtendedProgramType),
    setOrg: (patch) => setOrgValues((p) => ({
      clientOrg:       patch.client_org        ?? p.clientOrg,
      department:      patch.department        ?? p.department,
      targetAudience:  patch.target_audience   ?? p.targetAudience,
      maxParticipants: patch.max_participants != null ? String(patch.max_participants) : p.maxParticipants,
    })),
    setPendingSessions,
  });

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setNameError(null);
    setErrorMsg(null);

    if (!name.trim()) {
      setNameError('프로그램명을 입력해 주세요.');
      return;
    }
    if (startDate && endDate && startDate > endDate) {
      setErrorMsg('종료일이 시작일보다 빠를 수 없어요.');
      return;
    }

    const parsedCapacity = capacity.trim() ? Number(capacity.replace(/,/g, '')) : null;
    if (parsedCapacity !== null && (Number.isNaN(parsedCapacity) || parsedCapacity < 0)) {
      setErrorMsg('정원은 0 이상의 숫자로 입력해 주세요.');
      return;
    }

    // STEP-PROGRAM-CREATION-WIZARD — 평가형 신청·지원금 검증 (분리 함수)
    const av = validateApplication({ applicationType, applicationStartDate, applicationEndDate, maxApplicants, grantEnabled, grantBudget });
    if (av.error) { setErrorMsg(av.error); return; }
    const parsedMaxApplicants = av.parsedMaxApplicants;
    const parsedGrantBudget = av.parsedGrantBudget;

    setSubmitting(true);
    try {
      const orderNum = displayOrder.trim() ? Number(displayOrder.replace(/,/g, '')) : 0;
      const parsedMaxParticipants = orgValues.maxParticipants.trim()
        ? Number(orgValues.maxParticipants.replace(/,/g, ''))
        : null;
      const { data: createdProgram, error } = await supabase.from('programs').insert({
        project_id: projectId || null,
        consortium_id: consortiumId || null,
        name: name.trim(),
        type: toLegacyType(programType),  // 4종 enum 호환
        program_type: programType,        // STEP-PROGRAM-TYPE 14종 영문
        display_order: Number.isFinite(orderNum) ? orderNum : 0,
        modules,                           // jsonb 배열
        status,
        visibility,                        // STEP-PROGRAM-VISIBILITY
        start_date: startDate || null,
        end_date: endDate || null,
        venue: venue.trim() || null,
        capacity: parsedCapacity,
        description: description.trim() || null,
        // STEP-PROGRAM-BUNDLE
        client_org: orgValues.clientOrg.trim() || null,
        department: orgValues.department.trim() || null,
        target_audience: orgValues.targetAudience.trim() || null,
        max_participants: parsedMaxParticipants,
        // STEP-PROGRAM-CREATION-WIZARD 신청·지원금
        application_type: applicationType,
        application_start_date: applicationType === 'evaluation' ? (applicationStartDate || null) : null,
        application_end_date: applicationType === 'evaluation' ? (applicationEndDate || null) : null,
        max_applicants: applicationType === 'evaluation' ? parsedMaxApplicants : null,
        grant_enabled: grantEnabled,
        grant_budget: parsedGrantBudget,
      }).select('id').single();

      if (error) throw error;

      // STEP-CURRICULUM-AI-INLINE — 디버그 로그 (박경수님 콘솔 확인용)
      console.log('[program-form] pendingSessions=', pendingSessions, '| length=', pendingSessions.length, '| programId=', createdProgram?.id);
      if (pendingSessions.length > 0 && createdProgram?.id) {
        const r = await insertPendingSessions(createdProgram.id, pendingSessions);
        console.log('[program-form] insertPendingSessions 결과:', r);
        if (!r.ok) toast.error('프로그램은 등록됐지만 차시 자동 등록에 실패했어요. 직접 추가해 주세요.');
        else toast.success(`프로그램과 차시 ${pendingSessions.length}개가 등록됐어요.`);
      } else {
        toast.success('프로그램이 등록됐어요.');
      }

      onCreated();
      onClose();
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[programs] 등록 실패:', raw);
      const m = raw.toLowerCase();
      if (m.includes("could not find the table 'public.programs'") || m.includes('pgrst205')) {
        setErrorMsg('프로그램 테이블이 아직 적용되지 않았어요. Supabase에서 마이그레이션을 실행해 주세요.');
      } else if (m.includes('row-level security') || m.includes('permission denied')) {
        setErrorMsg('프로그램을 등록할 권한이 없어요. 관리자에게 문의해 주세요.');
      } else {
        setErrorMsg('프로그램 등록 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="프로그램 신규 등록"
      description="필수 항목은 프로그램명만 입력하면 돼요."
      size="lg"
      closeOnBackdrop={!submitting}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            취소
          </Button>
          <Button type="submit" form="program-form" variant="primary" loading={submitting}>
            저장하기
          </Button>
        </>
      }
    >
      <form id="program-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
        <ProgramAutofillSection onApply={handleAutoApply} disabled={submitting} />

        <Input
          label="프로그램명"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={submitting}
          error={nameError}
          placeholder="예) 2026 상반기 리더십 캠프"
        />

        <ProgramTypeSelector value={programType} onChange={setProgramType} disabled={submitting} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">상태</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ProgramStatus)}
              disabled={submitting}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
            >
              {PROGRAM_STATUS_VALUES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <Input
            type="number"
            inputMode="numeric"
            label="표시 순서"
            value={displayOrder}
            onChange={(e) => setDisplayOrder(e.target.value)}
            disabled={submitting}
            placeholder="0"
            helperText="작은 숫자가 먼저 표시돼요. 같은 프로젝트 안에서 정렬용."
          />
        </div>

        <ProgramTemplateSelector
          programType={programType}
          selectedModules={modules}
          onModulesChange={setModules}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">연결 프로젝트</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              disabled={submitting || loadingRefs}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
            >
              <option value="">{loadingRefs ? '불러오는 중…' : '선택 없음'}</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="장소"
            value={venue}
            onChange={(e) => setVenue(e.target.value)}
            disabled={submitting}
            placeholder="예) 서울 강남구 ○○빌딩 3층"
          />
          <Input
            label="정원"
            inputMode="numeric"
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            disabled={submitting}
            placeholder="예) 30"
            helperText="비워두면 무제한"
          />
        </div>

        {/* STEP-PROGRAM-BUNDLE — 기관·부서·교육대상·정원 (분리 컴포넌트) */}
        <ProgramOrgFields values={orgValues} onChange={setOrgValues} disabled={submitting} />

        <ProgramVisibilityField value={visibility} onChange={setVisibility} disabled={submitting} />

        {/* STEP-PROGRAM-CREATION-WIZARD — 신청·지원금 (별도 컴포넌트) */}
        <ProgramApplicationFields
          applicationType={applicationType} setApplicationType={setApplicationType}
          applicationStartDate={applicationStartDate} setApplicationStartDate={setApplicationStartDate}
          applicationEndDate={applicationEndDate} setApplicationEndDate={setApplicationEndDate}
          maxApplicants={maxApplicants} setMaxApplicants={setMaxApplicants}
          grantEnabled={grantEnabled} setGrantEnabled={setGrantEnabled}
          grantBudget={grantBudget} setGrantBudget={setGrantBudget}
          submitting={submitting}
        />

        <ProgramDescriptionField value={description} onChange={setDescription} disabled={submitting} />
        <PendingSessionsPreview sessions={pendingSessions} onClear={() => setPendingSessions([])} />
        {errorMsg && (
          <div role="alert" className="rounded-xl bg-danger/10 border border-danger/20 px-4 py-2.5 text-sm text-danger">
            {errorMsg}
          </div>
        )}
      </form>
    </Modal>
  );
}
