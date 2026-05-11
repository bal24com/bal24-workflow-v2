// bal24 v2 — STEP-V1-SPLIT-FULL
// ExpertFormModal에서 분리한 순수 함수 + 이력서 업로드 유틸 (기능 변경 없음)

import { supabase } from '../../lib/supabase';
import type { CareerItem, CertItem, EducationItem, StaffPool, StaffType } from '../../types/database';

export const EXPERT_STORAGE_BUCKET = 'expert-files';
export const RESUME_STORAGE_BUCKET = 'staff-files';

export interface ExpertFormState {
  name: string;
  organization: string;
  position: string;
  specialty: string;     // 콤마 구분 입력 → 배열로 저장
  phoneMobile: string;
  phoneOffice: string;
  email: string;
  mainDuties: string;
  careerSummary: string;
  bankName: string;
  bankAccount: string;
  bankHolder: string;
  idNumber: string;
}

export const EMPTY_EXPERT_FORM: ExpertFormState = {
  name: '', organization: '', position: '', specialty: '',
  phoneMobile: '', phoneOffice: '', email: '',
  mainDuties: '', careerSummary: '',
  bankName: '', bankAccount: '', bankHolder: '',
  idNumber: '',
};

export function expertToForm(s: StaffPool): ExpertFormState {
  return {
    name: s.name ?? '', organization: s.organization ?? '', position: s.position ?? '',
    specialty: (s.specialty ?? []).join(', '),
    phoneMobile: s.phone_mobile ?? '', phoneOffice: s.phone_office ?? '', email: s.email ?? '',
    mainDuties: s.main_duties ?? '', careerSummary: s.career_summary ?? '',
    bankName: s.bank_name ?? '', bankAccount: s.bank_account ?? '', bankHolder: s.bank_holder ?? '',
    idNumber: s.id_number ?? '',
  };
}

export function maskIdNumber(raw: string): string {
  const d = raw.replace(/\D/g, '');
  if (d.length < 7) return d;
  return `${d.slice(0, 6)}-${d[6]}******`;
}

export function translateInsertError(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes('column') && m.includes('does not exist')) {
    return '전문가 테이블 컬럼이 아직 적용되지 않았어요. Supabase에서 마이그레이션을 실행해 주세요.';
  }
  if (m.includes('row-level security') || m.includes('permission denied')) {
    return '전문가를 등록할 권한이 없어요. 관리자에게 문의해 주세요.';
  }
  return '전문가 등록 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.';
}

export function translateUploadError(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes('bucket not found')) return `파일 저장소(${EXPERT_STORAGE_BUCKET})가 없어요. Supabase에서 버킷을 먼저 만들어 주세요.`;
  if (m.includes('payload too large') || m.includes('exceeded')) return '파일 용량이 너무 커요.';
  if (m.includes('row-level security') || m.includes('permission denied')) return '파일을 올릴 권한이 없어요.';
  return '파일 업로드 중 오류가 발생했어요.';
}

export interface ResumeUploadResult {
  ok: true; url: string;
}
export interface ResumeUploadFailure {
  ok: false; reason: 'size' | 'storage';
}

/** 이력서 파일을 staff-files 버킷에 업로드. file=null이면 기존 URL을 그대로 반환(no-op) */
export async function uploadResume(file: File | null, fallbackUrl: string): Promise<ResumeUploadResult | ResumeUploadFailure | { ok: true; url: string | null }> {
  if (!file) return { ok: true, url: fallbackUrl || null };
  if (file.size > 10 * 1024 * 1024) return { ok: false, reason: 'size' };
  const ext = file.name.includes('.') ? file.name.split('.').pop() : 'pdf';
  const safeBase = file.name.replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 60);
  const path = `resumes/${Date.now()}_${safeBase}.${ext}`;
  const up = await supabase.storage.from(RESUME_STORAGE_BUCKET).upload(path, file, { upsert: false, contentType: file.type || undefined });
  if (up.error) {
    console.error('[experts] 이력서 업로드 실패:', up.error.message);
    return { ok: false, reason: 'storage' };
  }
  return { ok: true, url: supabase.storage.from(RESUME_STORAGE_BUCKET).getPublicUrl(path).data.publicUrl };
}

/** 학력·경력·자격증 빈 항목 제거 (저장 noise 제거) */
export function cleanExpertArrays(eds: EducationItem[], cs: CareerItem[], certs: CertItem[]) {
  return {
    educations: eds.filter((e) => e.school.trim() || e.major.trim() || e.year.trim()),
    careers:    cs.filter((c) => c.company.trim() || c.role.trim() || c.period.trim()),
    certifications: certs.filter((c) => c.name.trim() || c.issuer.trim() || c.year.trim()),
  };
}

export interface BuildPayloadInput {
  form: ExpertFormState;
  photoUrl: string | null;
  staffType: StaffType | '';
  resumeUrl: string | null;
  educations: EducationItem[];
  careers: CareerItem[];
  certs: CertItem[];
}

export function buildExpertPayload(input: BuildPayloadInput) {
  const { form, photoUrl, staffType, resumeUrl, educations, careers, certs } = input;
  const specialtyArr = form.specialty.split(',').map((s) => s.trim()).filter(Boolean);
  const idDigits = form.idNumber.replace(/\D/g, '');
  const cleaned = cleanExpertArrays(educations, careers, certs);
  return {
    name: form.name.trim(),
    organization: form.organization.trim() || null,
    position: form.position.trim() || null,
    specialty: specialtyArr.length ? specialtyArr : null,
    phone_mobile: form.phoneMobile.trim() || null,
    phone_office: form.phoneOffice.trim() || null,
    email: form.email.trim() || null,
    main_duties: form.mainDuties.trim() || null,
    career_summary: form.careerSummary.trim() || null,
    bank_name: form.bankName.trim() || null,
    bank_account: form.bankAccount.trim() || null,
    bank_holder: form.bankHolder.trim() || null,
    id_number: idDigits || null,
    profile_image_url: photoUrl,
    staff_type: staffType || null,
    resume_url: resumeUrl,
    education_history: cleaned.educations,
    career_history: cleaned.careers,
    certifications: cleaned.certifications,
  };
}
