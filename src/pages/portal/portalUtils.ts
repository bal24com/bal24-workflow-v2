// 박경수님 2026-05-29 STEP-PORTAL-MULTI-ROLE — 포털 역할 판별 + 토큰 유틸리티.

import { supabase } from '../../lib/supabase';

export type PortalRole =
  | 'admin' | 'operator' | 'supporter' | 'beneficiary_org' | 'participant';

export const ROLE_LABEL: Record<PortalRole, string> = {
  admin:           '관리자',
  operator:        '운영사 담당자',
  supporter:       '지원기관',
  beneficiary_org: '수혜기관',
  participant:     '수혜자(팀)',
};

export interface ProjectPortal {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  is_active: boolean;
  operator_token: string | null;
  supporter_token: string | null;
  beneficiary_token: string | null;
  participant_token: string | null;
  beneficiary_pin: string | null;
}

export interface PortalWithRole {
  portal: ProjectPortal;
  role: PortalRole;
  customPin?: string | null;
  beneficiaryOrg?: {
    id: string;
    org_name: string;
    contact_name: string | null;
    contact_phone: string | null;
    status: string;
  };
}

/** 토큰 한 개로 4가지 역할 중 어느 것인지 식별. */
export async function resolvePortalRole(token: string): Promise<PortalWithRole | null> {
  // 1) 수혜기관 개별 토큰 먼저 확인 (가장 구체적인 정보)
  const { data: bData } = await supabase
    .from('portal_beneficiary_orgs')
    .select(`
      id, org_name, contact_name, contact_phone, status, pin, portal_id,
      portal:project_portals (*)
    `)
    .eq('token', token)
    .maybeSingle();

  if (bData && bData.portal) {
    return {
      portal: bData.portal as unknown as ProjectPortal,
      role: 'beneficiary_org',
      customPin: bData.pin,
      beneficiaryOrg: {
        id: bData.id,
        org_name: bData.org_name,
        contact_name: bData.contact_name,
        contact_phone: bData.contact_phone,
        status: bData.status,
      },
    };
  }

  // 2) project_portals 4종 공통 토큰 매칭
  const { data, error } = await supabase
    .from('project_portals')
    .select('id, project_id, title, description, is_active, operator_token, supporter_token, beneficiary_token, participant_token, beneficiary_pin')
    .or([
      `operator_token.eq.${token}`,
      `supporter_token.eq.${token}`,
      `beneficiary_token.eq.${token}`,
      `participant_token.eq.${token}`,
    ].join(','))
    .eq('is_active', true)
    .maybeSingle();
  if (error || !data) {
    if (error) console.warn('[portalUtils] resolvePortalRole 실패:', error.message);
    return null;
  }
  const p = data as ProjectPortal;
  let role: PortalRole = 'participant';
  if (p.operator_token    === token) role = 'operator';
  if (p.supporter_token   === token) role = 'supporter';
  if (p.beneficiary_token === token) role = 'beneficiary_org';
  if (p.participant_token === token) role = 'participant';
  return { portal: p, role };
}

/** 항목 노출 권한 필터. */
export function filterByRole<T extends { visible_roles?: string[] | null }>(
  items: T[], role: PortalRole,
): T[] {
  return items.filter((i) => {
    const roles = i.visible_roles ?? ['admin','operator','supporter','beneficiary_org','participant'];
    return roles.includes(role);
  });
}

/** 항목 액션(제출·다운로드 등) 권한 확인. */
export function canAct(
  item: { actionable_roles?: string[] | null }, role: PortalRole,
): boolean {
  const roles = item.actionable_roles ?? ['admin','operator','supporter','beneficiary_org','participant'];
  return roles.includes(role);
}

export const ITEM_TYPE_LABEL: Record<string, string> = {
  file_download: '파일 다운로드',
  file_upload:   '파일 제출',
  text_info:     '텍스트 안내',
  feedback:      '의견 입력',
  approval:      '동의·승인',
  auto_data:     '자동 데이터',
  tax_invoice:   '세금계산서',
};

/** 외부 토큰 URL 생성 (base URL = current origin). */
export function buildPortalUrl(token: string): string {
  return `${window.location.origin}/portal/${token}`;
}
