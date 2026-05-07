// bal24 v2 — 고객사 폼 공통 타입·상수·헬퍼
// ClientFormModal 400줄 제한 준수를 위해 분리.

import type { Client, ClientContact, ClientType } from '../../types/database';
import { type ContactDraft } from './ContactRow';

export const STORAGE_BUCKET = 'client-files';

export type ClientForm = {
  name: string;
  businessName: string;
  ceoName: string;
  clientType: ClientType;
  representative: string;
  businessNumber: string;
  businessType: string;
  businessItem: string;
  bankName: string;
  bankAccount: string;
  bankHolder: string;
  address: string;
  phone: string;
  email: string;
  note: string;
};

export const EMPTY_CLIENT: ClientForm = {
  name: '',
  businessName: '',
  ceoName: '',
  clientType: 'client',
  representative: '',
  businessNumber: '',
  businessType: '',
  businessItem: '',
  bankName: '',
  bankAccount: '',
  bankHolder: '',
  address: '',
  phone: '',
  email: '',
  note: '',
};

export function clientToForm(c: Client): ClientForm {
  return {
    name: c.name ?? '',
    businessName: c.business_name ?? '',
    ceoName: c.ceo_name ?? '',
    clientType: (c.client_type ?? 'client') as ClientType,
    representative: c.representative ?? '',
    businessNumber: c.business_number ?? '',
    businessType: c.business_type ?? '',
    businessItem: c.business_item ?? '',
    bankName: c.bank_name ?? '',
    bankAccount: c.bank_account ?? '',
    bankHolder: c.bank_holder ?? '',
    address: c.address ?? '',
    phone: c.phone ?? '',
    email: c.email ?? '',
    note: c.note ?? '',
  };
}

export function contactRowToDraft(row: ClientContact): ContactDraft {
  return {
    uid: row.id,
    name: row.name ?? '',
    position: row.position ?? '',
    mainDuties: row.main_duties ?? '',
    phoneMobile: row.phone_mobile ?? '',
    phoneOffice: row.phone_office ?? '',
    email: row.email ?? '',
    linkedProfileId: row.linked_profile_id ?? '',
  };
}

export function formatBusinessNumber(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 10);
  if (d.length < 4) return d;
  if (d.length < 6) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
}

export function translateClientError(raw: string, ctx: 'upload' | 'insert' | 'contact'): string {
  const m = raw.toLowerCase();
  if (ctx === 'upload') {
    if (m.includes('bucket not found')) return `파일 저장소(${STORAGE_BUCKET})가 없어요. Supabase에서 버킷을 먼저 만들어 주세요.`;
    if (m.includes('payload too large') || m.includes('exceeded')) return '파일 용량이 너무 커요.';
    if (m.includes('row-level security') || m.includes('permission denied')) return '파일을 올릴 권한이 없어요. 관리자에게 문의해 주세요.';
    return '파일 업로드 중 오류가 발생했어요.';
  }
  if (m.includes("could not find the table 'public.client_contacts'") || m.includes('pgrst205')) {
    return '담당자 테이블이 아직 적용되지 않았어요. Supabase에서 마이그레이션을 실행해 주세요.';
  }
  if (m.includes('column') && m.includes('does not exist')) {
    return '거래처 테이블 컬럼이 아직 적용되지 않았어요. Supabase에서 마이그레이션을 실행해 주세요.';
  }
  if (m.includes('row-level security') || m.includes('permission denied')) return '저장 권한이 없어요. 관리자에게 문의해 주세요.';
  return ctx === 'contact'
    ? '담당자 저장 중 오류가 발생했어요. (고객사는 등록되었어요)'
    : '거래처 등록 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.';
}
