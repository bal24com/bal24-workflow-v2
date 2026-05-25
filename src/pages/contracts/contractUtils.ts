// 수입/계약 fetch · 통계 유틸 — ContractsPage·DetailDrawer 공용
// STEP-ACCOUNTING-ALL P2

import { supabase } from '../../lib/supabase';
import type { IncomeContract, ContractStatus, BillingScheduleItem } from '../../types/database';

export type ContractRow = IncomeContract & {
  project?: { id: string; name: string; deleted_at: string | null } | null;
  program?: { id: string; name: string; deleted_at: string | null } | null;
  consortium?: { id: string; name: string; deleted_at: string | null } | null;
  client?: { id: string; name: string; department: string | null; deleted_at: string | null } | null;
  // STEP-ACCOUNTING-FOLLOWUP6 — 세금계산서 담당자 (client_contacts FK)
  billing_contact?: { id: string; name: string; position: string | null; email: string | null; phone_office: string | null; phone_mobile: string | null } | null;
};

const SELECT_COLUMNS =
  '*, project:projects(id, name, deleted_at), program:programs(id, name, deleted_at), consortium:consortiums(id, name, deleted_at), client:clients(id, name, department, deleted_at), billing_contact:client_contacts(id, name, position, email, phone_office, phone_mobile)';

/** 휴지통 join row 제외 헬퍼 */
function isLiveContract(c: ContractRow): boolean {
  if (c.project?.deleted_at) return false;
  if (c.program?.deleted_at) return false;
  if (c.consortium?.deleted_at) return false;
  if (c.client?.deleted_at) return false;
  return true;
}

/** 계약 목록 fetch (휴지통 join 자동 제외) */
export async function fetchContracts(filter?: ContractStatus | 'all'): Promise<ContractRow[]> {
  let q = supabase
    .from('income_contracts')
    .select(SELECT_COLUMNS)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (filter && filter !== 'all') q = q.eq('status', filter);
  const { data, error } = await q;
  if (error) {
    console.error('[contracts] 목록 조회 실패:', error.message);
    throw new Error('계약 목록을 불러오지 못했어요.');
  }
  return ((data ?? []) as unknown as ContractRow[]).filter(isLiveContract);
}

/** 단건 fetch (휴지통 자동 차단) */
export async function fetchContract(id: string): Promise<ContractRow | null> {
  const { data, error } = await supabase
    .from('income_contracts')
    .select(SELECT_COLUMNS)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) {
    console.error('[contracts] 단건 조회 실패:', error.message);
    throw new Error('계약 정보를 불러오지 못했어요.');
  }
  if (!data) return null;
  return data as unknown as ContractRow;
}

/** soft-delete (휴지통 보내기) */
export async function softDeleteContract(id: string): Promise<string | null> {
  const { error } = await supabase
    .from('income_contracts')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) {
    console.error('[contracts] 삭제 실패:', error.message);
    return '삭제 중 오류가 발생했어요.';
  }
  return null;
}

/** 입금 확인 처리 — deposited_at + status='완료' */
export async function markContractDeposited(id: string): Promise<string | null> {
  const { error } = await supabase
    .from('income_contracts')
    .update({ deposited_at: new Date().toISOString(), status: '완료' })
    .eq('id', id);
  if (error) {
    console.error('[contracts] 입금 확인 실패:', error.message);
    return '입금 확인 처리에 실패했어요.';
  }
  return null;
}

/** 청구 단계 진행률 표시용 — "1/3차 완료" */
export function billingProgressLabel(schedule: BillingScheduleItem[]): string {
  if (!Array.isArray(schedule) || schedule.length === 0) return '청구 미설정';
  const paidCount = schedule.filter((s) => s.status === 'paid').length;
  return `${paidCount}/${schedule.length}차 완료`;
}

/** KPI 계산 — 진행중 합계·완료 건수·미입금 건수 */
export interface ContractKpis {
  inProgressTotal: number;
  completedCount: number;
  notDepositedCount: number;
}
export function calcContractKpis(rows: ContractRow[]): ContractKpis {
  return rows.reduce<ContractKpis>(
    (acc, r) => {
      if (r.status === '진행중') acc.inProgressTotal += Number(r.contract_amount || 0);
      if (r.status === '완료') acc.completedCount += 1;
      if (!r.deposited_at && r.status !== '취소') acc.notDepositedCount += 1;
      return acc;
    },
    { inProgressTotal: 0, completedCount: 0, notDepositedCount: 0 },
  );
}

// STEP-ACCOUNTING-FOLLOWUP4 — 통합 연결 대상 검색
// STEP-ACCOUNTING-FOLLOWUP5 — amount/clientId/clientName/startDate 메타 추가 (자동 채움용)
export type LinkType = 'project' | 'program' | 'consortium';
export interface LinkOption {
  key: string;
  type: LinkType;
  id: string;
  name: string;
  display: string;
  projectId?: string | null;
  // 자동 채움 메타 — 콤보박스 표시 + 선택 시 form 으로 prefill
  amount?: number | null;
  clientId?: string | null;
  clientName?: string | null;
  startDate?: string | null;
}
export const LINK_TYPE_LABEL: Record<LinkType, string> = {
  project: '프로젝트',
  program: '프로그램',
  consortium: '컨소시엄',
};

// FOLLOWUP5 — 통합 옵션 빌드 (메타 포함). ContractFormModal 슬림화.
interface ProjectLinkRow { id: string; name: string; contract_amount: number | null; client_id: string | null; start_date: string | null }
interface ProgramLinkRow { id: string; name: string; project_id: string | null; start_date: string | null }
interface ConsortiumLinkRow { id: string; name: string; total_budget: number | null; lead_client_id: string | null }

export function buildLinkOptions(
  projects: ProjectLinkRow[],
  programs: ProgramLinkRow[],
  consortiums: ConsortiumLinkRow[],
  clientNameMap: Map<string, string>,
): LinkOption[] {
  const opts: LinkOption[] = [];
  for (const p of projects) {
    opts.push({
      key: `project:${p.id}`, type: 'project', id: p.id, name: p.name,
      display: `프로젝트: ${p.name}`,
      amount: p.contract_amount,
      clientId: p.client_id,
      clientName: p.client_id ? clientNameMap.get(p.client_id) ?? null : null,
      startDate: p.start_date,
    });
  }
  for (const g of programs) {
    const parent = g.project_id ? projects.find((pp) => pp.id === g.project_id) : null;
    opts.push({
      key: `program:${g.id}`, type: 'program', id: g.id, name: g.name,
      display: `프로그램: ${g.name}`,
      projectId: g.project_id,
      amount: parent?.contract_amount ?? null,
      clientId: parent?.client_id ?? null,
      clientName: parent?.client_id ? clientNameMap.get(parent.client_id) ?? null : null,
      startDate: g.start_date,
    });
  }
  for (const c of consortiums) {
    opts.push({
      key: `consortium:${c.id}`, type: 'consortium', id: c.id, name: c.name,
      display: `컨소시엄: ${c.name}`,
      amount: c.total_budget,
      clientId: c.lead_client_id,
      clientName: c.lead_client_id ? clientNameMap.get(c.lead_client_id) ?? null : null,
      startDate: null,
    });
  }
  return opts;
}

// STEP-CONTRACT-AUTO — 'draft' 추가 (자동 생성 row 의 대기 상태)
export const CONTRACT_STATUS_VALUES: ContractStatus[] = ['draft', '진행중', '완료', '취소', '보류'];

export const CONTRACT_STATUS_STYLE: Record<ContractStatus, string> = {
  draft:  'bg-slate-100 text-slate-600 border-slate-200',
  진행중: 'bg-violet-50 text-violet-700 border-violet-200',
  완료:   'bg-emerald-50 text-emerald-700 border-emerald-200',
  취소:   'bg-rose-50 text-rose-700 border-rose-200',
  보류:   'bg-amber-50 text-amber-700 border-amber-200',
};

export const CONTRACT_STATUS_LABEL: Record<ContractStatus, string> = {
  draft:  '대기',
  진행중: '진행중',
  완료:   '완료',
  취소:   '취소',
  보류:   '보류',
};

// STEP-CONTRACT-AUTO — 라이프사이클 단계 라벨·컬러
export const LIFECYCLE_LABEL: Record<'proposal'|'contract'|'operation'|'closing', string> = {
  proposal: '견적·제안',
  contract: '계약',
  operation: '운영',
  closing:  '종료',
};
export const LIFECYCLE_STYLE: Record<'proposal'|'contract'|'operation'|'closing', string> = {
  proposal: 'bg-slate-100 text-slate-600 border-slate-200',
  contract: 'bg-violet-100 text-violet-700 border-violet-200',
  operation: 'bg-blue-100 text-blue-700 border-blue-200',
  closing:  'bg-emerald-100 text-emerald-700 border-emerald-200',
};

// ============================================================
// STEP-CONTRACT-AUTO — 프로젝트/프로그램 생성 시 income_contracts 자동 생성
// 자동 생성 실패해도 본 INSERT 차단 X. 호출 측에서 try/catch 로 경고 토스트만.
// ============================================================

/** 프로젝트 생성 시 견적·제안 단계 계약 자동 생성 */
export async function autoCreateContractForProject(params: {
  projectId: string;
  projectName: string;
  clientId: string | null;
  userId: string;
}): Promise<void> {
  const { error } = await supabase.from('income_contracts').insert({
    project_id: params.projectId,
    program_id: null,
    contract_name: params.projectName,
    client_id: params.clientId,
    contract_amount: 0,
    status: 'draft',
    lifecycle_stage: 'proposal',
    auto_created: true,
    doc_request_pending: false,
    memo: '프로젝트 생성 시 자동 등록됨. 견적·계약금액·계약일을 채워주세요.',
    created_by: params.userId,
  });
  if (error) {
    console.error('[ContractAuto] 프로젝트 계약 자동 생성 실패:', error.message);
    throw new Error('수입/계약 자동 등록 중 오류가 발생했어요. 직접 등록해 주세요.');
  }
}

/** ProjectFormModal 에서 한 줄 호출용 wrapper — 자동 생성 실패해도 toast 안내만 */
export async function safeAutoContractForProject(
  project: { id: string; name: string; client_id: string | null } | null,
  userId: string | undefined,
  onSuccess: (msg: string) => void,
): Promise<void> {
  if (!project || !userId) return;
  try {
    await autoCreateContractForProject({ projectId: project.id, projectName: project.name, clientId: project.client_id, userId });
    onSuccess('프로젝트가 생성됐어요. 수입/계약에 대기 항목이 추가됐어요.');
  } catch (err) {
    console.warn('[ContractAuto] safe wrapper:', err instanceof Error ? err.message : '');
    onSuccess('프로젝트가 생성됐어요. (수입/계약은 직접 등록해 주세요)');
  }
}

/** 프로그램 생성 시 계약 단계 계약 자동 생성 — 부모 프로젝트의 client_id 자동 prefill.
 *  박경수님 요청: 같은 프로젝트의 자동 계약이 이미 있으면 중복 INSERT 안 함.
 *  (계약은 프로젝트 단위로 관리. 프로그램별 계약이 필요하면 수동 [+ 신규 계약]) */
export async function autoCreateContractForProgram(params: {
  programId: string;
  programName: string;
  projectId: string | null;
  userId: string;
}): Promise<void> {
  // 1) 부모 프로젝트의 자동 생성 계약이 이미 있으면 skip (중복 방지)
  if (params.projectId) {
    const { data: existing } = await supabase.from('income_contracts')
      .select('id').eq('project_id', params.projectId).eq('auto_created', true)
      .is('deleted_at', null).limit(1).maybeSingle();
    if (existing) {
      console.info('[ContractAuto] 프로그램 생성 — 부모 프로젝트의 자동 계약이 이미 있어 skip');
      return;
    }
  }
  // 2) 부모 프로젝트의 client_id 자동 조회
  let clientId: string | null = null;
  if (params.projectId) {
    const { data } = await supabase.from('projects').select('client_id').eq('id', params.projectId).maybeSingle();
    clientId = (data as { client_id: string | null } | null)?.client_id ?? null;
  }
  const { error } = await supabase.from('income_contracts').insert({
    project_id: params.projectId, program_id: params.programId,
    contract_name: params.programName, client_id: clientId,
    contract_amount: 0, status: 'draft', lifecycle_stage: 'contract',
    auto_created: true, doc_request_pending: true,
    memo: '프로그램 생성 시 자동 등록됨. 계약서·세금계산서·서류 요청 링크를 처리해 주세요.',
    created_by: params.userId,
  });
  if (error) {
    console.error('[ContractAuto] 프로그램 계약 자동 생성 실패:', error.message);
    throw new Error('수입/계약 자동 등록 중 오류가 발생했어요. 직접 등록해 주세요.');
  }
}

/** ProgramFormModal 에서 한 줄 호출용 wrapper */
export async function safeAutoContractForProgram(
  programId: string | null | undefined,
  programName: string,
  projectId: string | null,
  userId: string | undefined,
  onSuccess: (msg: string) => void,
): Promise<void> {
  if (!programId || !userId) return;
  try {
    await autoCreateContractForProgram({ programId, programName, projectId, userId });
    onSuccess('수입/계약에 계약 단계 항목이 추가됐어요. 계약서·서류 요청 링크를 처리해 주세요.');
  } catch (err) {
    console.warn('[ContractAuto] safe wrapper:', err instanceof Error ? err.message : '');
  }
}

// ============================================================
// 계약 파일 업로드 — Storage `contracts` 버킷
// kind: 'contract' (계약서) / 'tax_invoice' (세금계산서)
// ============================================================
export interface ContractFileMeta {
  url: string;
  name: string;
}

export async function uploadContractFile(
  file: File,
  kind: 'contract' | 'tax_invoice',
): Promise<ContractFileMeta> {
  const ts = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9가-힣._-]/g, '_');
  const path = `${kind}/${ts}_${safeName}`;
  const { error: upErr } = await supabase.storage
    .from('contracts')
    .upload(path, file, { upsert: false, contentType: file.type || undefined });
  if (upErr) {
    const m = upErr.message.toLowerCase();
    if (m.includes('bucket not found')) throw new Error('contracts 저장소가 없어요. P1 마이그레이션 실행을 확인해 주세요.');
    if (m.includes('mime') || m.includes('not allowed')) throw new Error('지원하지 않는 파일 형식이에요. PDF·이미지만 가능합니다.');
    if (m.includes('payload too large') || m.includes('exceeded')) throw new Error('파일 크기가 너무 커요. (최대 20MB)');
    if (m.includes('row-level security')) throw new Error('업로드 권한이 없어요.');
    throw new Error('파일 업로드에 실패했어요. 다시 시도해 주세요.');
  }
  const { data: urlData } = supabase.storage.from('contracts').getPublicUrl(path);
  return { url: urlData.publicUrl, name: file.name };
}
